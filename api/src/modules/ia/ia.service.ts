import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SttService } from './stt.service';
import { SoapService } from './soap.service';
import { SoapResult } from './interfaces/gemini.interface';
import { StorageService } from '../storage/storage.service';
import { ConsultasRepository } from '../consultas/consultas.repository';
import { IA_QUEUE, IaJob, IaQueue } from './queue/queue.interface';
import { IaProcessor } from './queue/ia-processor';
import { InMemoryQueueService } from './queue/in-memory-queue.service';
import { assertAudioPathPermitido, AudioPathContext } from '../../common/storage/audio-path';

export interface TranscribirInput {
  audioPath?: string;
  audioBase64?: string;
  mimeType?: string;
  audioContext?: AudioPathContext;
}

// Orquesta la IA. Expone:
//  - transcribir/generarSoap: sincronos (contrato /v1/ia/transcribir y /v1/ia/soap).
//  - encolarProcesamiento: arranca el pipeline async (sube job a la cola).
//  - procesar: lo que corre el worker (transcribe -> SOAP -> guarda en la consulta).
@Injectable()
export class IaService implements IaProcessor, OnModuleInit {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly stt: SttService,
    private readonly soap: SoapService,
    private readonly storage: StorageService,
    private readonly consultas: ConsultasRepository,
    @Inject(IA_QUEUE) private readonly queue: IaQueue,
  ) {}

  // si la cola es la in-memory, nos registramos como su procesador. Esto rompe el ciclo
  // de DI: el service conoce la cola, y le pasa "this" como handler una vez listo.
  onModuleInit(): void {
    if (this.queue instanceof InMemoryQueueService) {
      this.queue.registerProcessor(this);
    }
  }

  // Resuelve el audio a base64: si viene audioPath lo baja de Storage, si viene inline lo usa.
  private async resolverAudio(input: TranscribirInput): Promise<{ base64: string; mimeType: string }> {
    if (input.audioPath) {
      if (!input.audioContext) {
        throw new BadRequestException('audioPath requiere contexto de tenant para validacion.');
      }
      assertAudioPathPermitido(input.audioPath, input.audioContext);
      const { buffer, contentType } = await this.storage.descargar(input.audioPath);
      return { base64: buffer.toString('base64'), mimeType: input.mimeType ?? contentType };
    }
    if (input.audioBase64) {
      return { base64: input.audioBase64, mimeType: input.mimeType ?? 'audio/webm' };
    }
    throw new BadRequestException('Debes enviar audioPath o audioBase64.');
  }

  async transcribir(input: TranscribirInput): Promise<{ transcripcion: string }> {
    const { base64, mimeType } = await this.resolverAudio(input);
    const transcripcion = await this.stt.transcribir(base64, mimeType);
    return { transcripcion };
  }

  async generarSoap(transcripcion: string): Promise<SoapResult> {
    return this.soap.generarSoap(transcripcion);
  }

  // Encola el procesamiento y marca la consulta como 'procesando'. El cliente sube el audio
  // a Storage y manda audioPath: nada de base64 gigante en el request para audios largos.
  async encolarProcesamiento(job: IaJob): Promise<void> {
    await this.consultas.update(job.consultaId, { estado: 'procesando' });
    await this.queue.enqueue(job);
  }

  // Worker. Idempotente-ish: si algo truena, deja la consulta en 'error' (no huerfana en
  // 'procesando' para siempre). Cloud Tasks / la cola in-memory reintentan antes de rendirse.
  async procesar(job: IaJob): Promise<void> {
    const { consultaId } = job;
    try {
      let vetId = job.veterinarioId;
      if (!vetId && job.audioPath) {
        const c = await this.consultas.getById(consultaId);
        vetId = c.veterinarioId;
      }
      if (job.audioPath && !vetId) {
        throw new BadRequestException('No se pudo validar el dueno del audio.');
      }
      const { base64, mimeType } = await this.resolverAudio({
        audioPath: job.audioPath,
        audioBase64: job.audioBase64,
        mimeType: job.mimeType,
        audioContext: vetId ? { uid: vetId, orgId: job.orgId } : undefined,
      });
      const transcripcion = await this.stt.transcribir(base64, mimeType);
      await this.consultas.update(consultaId, { transcripcion });

      const soap = await this.soap.generarSoap(transcripcion);
      // guardamos en el MISMO shape que espera el frontend (soap + campos sueltos).
      await this.consultas.mergeRaw(consultaId, {
        ...this.mapSoapAConsulta(soap),
        transcripcion,
        estado: 'borrador',
      });
      this.logger.log(`Consulta ${consultaId} procesada OK.`);
    } catch (err) {
      this.logger.error(`Error procesando consulta ${consultaId}: ${(err as Error).message}`);
      // re-lanzamos para que la cola reintente; el estado 'error' lo fija el ultimo intento.
      await this.consultas.update(consultaId, { estado: 'error' });
      throw err;
    }
  }

  private mapSoapAConsulta(soap: SoapResult): Record<string, unknown> {
    return {
      motivo: soap.motivo,
      prioridad: soap.prioridad,
      signosVitales: soap.signosVitales,
      soap: {
        subjetivo: soap.subjetivo,
        objetivo: soap.objetivo,
        analisis: soap.analisis,
        plan: soap.plan,
        medicamentosSugeridos: soap.medicamentosSugeridos,
      },
      diagnosticoEstructurado: soap.diagnosticoEstructurado,
    };
  }
}
