import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IaService } from '../../src/modules/ia/ia.service';
import { SttService } from '../../src/modules/ia/stt.service';
import { SoapService } from '../../src/modules/ia/soap.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { IaJob, IaQueue } from '../../src/modules/ia/queue/queue.interface';
import { SoapResult } from '../../src/modules/ia/interfaces/gemini.interface';

// SOAP de ejemplo (mismo shape que devuelve la IA real). Lo reusamos en todos los casos.
const soapFake = (): SoapResult => ({
  motivo: 'control',
  prioridad: 'rutina',
  signosVitales: {
    peso: 10,
    temperatura: 38.5,
    frecuenciaCardiaca: 90,
    frecuenciaRespiratoria: 20,
    condicionCorporal: 5,
  },
  subjetivo: 'S',
  objetivo: 'O',
  analisis: 'A',
  plan: 'P',
  diagnosticoEstructurado: [],
  medicamentosSugeridos: [],
});

// Captura las llamadas a update/mergeRaw para aseverar la maquina de estados.
interface RepoCalls {
  updates: Array<{ id: string; campos: Record<string, unknown> }>;
  merges: Array<{ id: string; raw: Record<string, unknown> }>;
}

function build(opts: {
  transcribir?: jest.Mock;
  generarSoap?: jest.Mock;
  descargar?: jest.Mock;
  getById?: jest.Mock;
} = {}) {
  const calls: RepoCalls = { updates: [], merges: [] };

  const stt = {
    transcribir:
      opts.transcribir ?? jest.fn(async (_b: string, _m: string) => 'texto transcrito'),
  } as unknown as SttService;

  const soap = {
    generarSoap: opts.generarSoap ?? jest.fn(async (_t: string) => soapFake()),
  } as unknown as SoapService;

  const storage = {
    descargar:
      opts.descargar ??
      jest.fn(async (_p: string) => ({
        buffer: Buffer.from('PCM'),
        contentType: 'audio/mpeg',
      })),
  } as unknown as StorageService;

  const consultas = {
    update: jest.fn(async (id: string, campos: Record<string, unknown>) => {
      calls.updates.push({ id, campos });
    }),
    mergeRaw: jest.fn(async (id: string, raw: Record<string, unknown>) => {
      calls.merges.push({ id, raw });
    }),
    getById: opts.getById ?? jest.fn(async (_id: string) => ({ veterinarioId: 'vet1' })),
  } as unknown as ConsultasRepository;

  const queue = { enqueue: jest.fn(async (_j: IaJob) => undefined) } as unknown as IaQueue;

  const service = new IaService(stt, soap, storage, consultas, queue);
  return { service, stt, soap, storage, consultas, queue, calls };
}

describe('IaService.procesar (worker)', () => {
  it('une varias transcripciones (audioPaths) con doble salto y salta vacías', async () => {
    const transcribir = jest
      .fn()
      .mockResolvedValueOnce('Bloque uno.')
      .mockResolvedValueOnce('   ') // vacío -> se descarta
      .mockResolvedValueOnce('Bloque tres.');
    const { service, storage, soap, calls } = build({ transcribir });

    const job: IaJob = {
      consultaId: 'c1',
      orgId: 'orgA',
      veterinarioId: 'vet1',
      mimeType: 'audio/mp3',
      audioPaths: [
        'audios/vet1/c1-0.mp3',
        'audios/vet1/c1-1.mp3',
        'audios/vet1/c1-2.mp3',
      ],
    };

    await service.procesar(job);

    expect(storage.descargar).toHaveBeenCalledTimes(3);
    // el job.mimeType pisa al contentType de Storage
    expect((transcribir.mock.calls[0] as unknown[])[1]).toBe('audio/mp3');
    expect(transcribir.mock.calls[0][0]).toBe(Buffer.from('PCM').toString('base64'));

    expect(soap).toBeDefined();
    const merge = calls.merges.find((m) => m.id === 'c1');
    expect(merge?.raw.transcripcion).toBe('Bloque uno.\n\nBloque tres.');
    expect(merge?.raw.estado).toBe('borrador');
    // primero hubo un update de transcripcion antes del SOAP
    expect(calls.updates.some((u) => u.campos.transcripcion === 'Bloque uno.\n\nBloque tres.')).toBe(
      true,
    );
  });

  it('soporta audioPath legacy (un solo bloque)', async () => {
    const { service, storage, calls } = build();
    await service.procesar({
      consultaId: 'c2',
      veterinarioId: 'vet1',
      audioPath: 'audios/vet1/c2-0.webm',
    });
    expect(storage.descargar).toHaveBeenCalledTimes(1);
    expect(calls.merges[0].raw.estado).toBe('borrador');
  });

  it('soporta audioBase64 inline (sin Storage)', async () => {
    const { service, storage, stt, calls } = build();
    await service.procesar({
      consultaId: 'c3',
      veterinarioId: 'vet1',
      audioBase64: 'QkFTRTY0',
      mimeType: 'audio/webm',
    });
    expect(storage.descargar).not.toHaveBeenCalled();
    expect(stt.transcribir).toHaveBeenCalledWith('QkFTRTY0', 'audio/webm');
    expect(calls.merges[0].raw.estado).toBe('borrador');
  });

  it('resuelve el veterinarioId desde la consulta cuando el job no lo trae', async () => {
    const getById = jest.fn(async () => ({ veterinarioId: 'vetDelDoc' }));
    const { service } = build({ getById });

    await service.procesar({
      consultaId: 'c4',
      orgId: 'orgA',
      audioPath: 'audios/vetDelDoc/c4-0.webm',
    });
    expect(getById).toHaveBeenCalledWith('c4');
  });

  it('rechaza audio de OTRO tenant (cross-tenant) y deja la consulta en error', async () => {
    const { service, calls } = build();
    await expect(
      service.procesar({
        consultaId: 'c5',
        orgId: 'orgA',
        veterinarioId: 'vet1',
        // path de otro uid -> ForbiddenException
        audioPath: 'audios/otroVet/c5-0.webm',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls.updates.some((u) => u.campos.estado === 'error')).toBe(true);
  });

  it('si no hay audio lanza BadRequest y marca error', async () => {
    const { service, calls } = build();
    await expect(
      service.procesar({ consultaId: 'c6', veterinarioId: 'vet1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls.updates.some((u) => u.campos.estado === 'error')).toBe(true);
  });

  it('si el SOAP truena, re-lanza y deja la consulta en error (no huérfana en procesando)', async () => {
    const generarSoap = jest.fn(async () => {
      throw new Error('LLM caido');
    });
    const { service, calls } = build({ generarSoap });
    await expect(
      service.procesar({
        consultaId: 'c7',
        veterinarioId: 'vet1',
        audioPath: 'audios/vet1/c7-0.webm',
      }),
    ).rejects.toThrow('LLM caido');
    expect(calls.updates.some((u) => u.campos.estado === 'error')).toBe(true);
    // nunca llegó a mergeRaw (no quedó SOAP a medias)
    expect(calls.merges).toHaveLength(0);
  });
});

describe('IaService sincrónicos y encolado', () => {
  it('transcribir() usa mimeType por defecto audio/webm con base64', async () => {
    const { service, stt } = build();
    const out = await service.transcribir({ audioBase64: 'QQ==' });
    expect(out).toEqual({ transcripcion: 'texto transcrito' });
    expect(stt.transcribir).toHaveBeenCalledWith('QQ==', 'audio/webm');
  });

  it('transcribir() exige contexto de tenant si viene audioPath', async () => {
    const { service } = build();
    await expect(service.transcribir({ audioPath: 'audios/vet1/x.webm' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('generarSoap() delega en SoapService', async () => {
    const { service, soap } = build();
    const r = await service.generarSoap('hola');
    expect(soap.generarSoap).toHaveBeenCalledWith('hola');
    expect(r.motivo).toBe('control');
  });

  it('encolarProcesamiento marca procesando y encola el job', async () => {
    const { service, queue, calls } = build();
    const job: IaJob = { consultaId: 'c8', veterinarioId: 'vet1', audioPaths: ['audios/vet1/a.webm'] };
    await service.encolarProcesamiento(job);
    expect(calls.updates[0]).toEqual({ id: 'c8', campos: { estado: 'procesando' } });
    expect(queue.enqueue).toHaveBeenCalledWith(job);
  });
});
