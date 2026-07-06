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
import { ClaudeLlmProvider } from './providers/claude-llm.provider';

const MARCA_CONTINUACION = '\n\n--- Continuación (nuevo bloque de grabación) ---\n\n';

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
    private readonly claude: ClaudeLlmProvider,
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

  // Resumen clinico corto de un PDF de resultados de examen. Usa Claude directamente
  // (lee el PDF nativo); no pasa por el arreglo de proveedores con fallback de generarSoap.
  async resumirExamenPdf(pdfBase64: string, nombreExamen: string): Promise<string> {
    const prompt =
      `Este PDF contiene los resultados del examen "${nombreExamen}" de una mascota. ` +
      'Resume en español, en máximo 5 líneas, los hallazgos clínicamente relevantes ' +
      '(valores fuera de rango, diagnósticos o recomendaciones). No repitas el PDF completo.';
    return this.claude.resumirDocumentoPdf(pdfBase64, prompt);
  }

  // Encola el procesamiento y marca la consulta como 'procesando'. El cliente sube el audio
  // a Storage y manda audioPath: nada de base64 gigante en el request para audios largos.
  async encolarProcesamiento(job: IaJob): Promise<void> {
    await this.consultas.update(job.consultaId, { estado: 'procesando' });
    await this.queue.enqueue(job);
  }

  // Worker. Worker. Idempotente-ish: si algo truena, deja la consulta en 'error' (no huerfana en
  // 'procesando' para siempre). Cloud Tasks / la cola in-memory reintentan antes de rendirse.
  async procesar(job: IaJob): Promise<void> {
    const { consultaId } = job;
    try {
      let vetId = job.veterinarioId;
      if (!vetId) {
        const c = await this.consultas.getById(consultaId);
        vetId = c.veterinarioId;
      }
      
      const audioContext = vetId ? { uid: vetId, orgId: job.orgId } : undefined;
      let transcripcion = '';

      const paths = job.audioPaths?.length ? job.audioPaths : (job.audioPath ? [job.audioPath] : []);
      
      if (paths.length > 0) {
        const transcripcionesArr: string[] = [];
        for (const path of paths) {
          const { base64, mimeType } = await this.resolverAudio({
            audioPath: path,
            mimeType: job.mimeType,
            audioContext,
          });
          const tx = await this.stt.transcribir(base64, mimeType);
          if (tx.trim()) {
            transcripcionesArr.push(tx);
          }
        }
        transcripcion = transcripcionesArr.join('\n\n');
      } else if (job.audioBase64) {
        const { base64, mimeType } = await this.resolverAudio({
          audioBase64: job.audioBase64,
          mimeType: job.mimeType,
          audioContext,
        });
        transcripcion = await this.stt.transcribir(base64, mimeType);
      } else {
        throw new BadRequestException('Debes enviar audioPath, audioPaths o audioBase64.');
      }

      if (job.modo === 'agregar') {
        const consultaActual = await this.consultas.getById(consultaId);
        const previa = consultaActual.transcripcion?.trim();
        transcripcion = previa ? `${previa}${MARCA_CONTINUACION}${transcripcion}` : transcripcion;
      }

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
        generadoPorIA: true,
      },
      diagnosticoEstructurado: soap.diagnosticoEstructurado,
      datosDetectados: {
        nombrePaciente: soap.datosPaciente?.nombre ?? null,
        especie: soap.datosPaciente?.especie ?? null,
        raza: soap.datosPaciente?.raza ?? null,
        nombrePropietario: soap.datosPropietario?.nombre ?? null,
        telefonoPropietario: soap.datosPropietario?.telefono ?? null,
      },
    };
  }
}
