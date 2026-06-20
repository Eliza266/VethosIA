// Abstraccion de cola para el pipeline de IA. La idea: la API NO corre la IA sincrona
// (transcribir + SOAP puede tardar y con audios largos revienta el request). En su lugar
// encola un job y responde al toque; un worker lo procesa aparte. Asi soportamos audios
// largos (el cliente sube a Storage y manda audioPath) y reintentos.
//
// Hay dos implementaciones detras de esta interfaz:
//  - InMemoryQueue: para dev/emulador/tests, procesa en background en el mismo proceso.
//  - CloudTasksQueue: para prod, encola en Cloud Tasks que hace POST al worker /v1/ia/procesar.

export interface IaJob {
  consultaId: string;
  orgId?: string;
  veterinarioId?: string;
  // preferido: ruta en Storage (audios/{uid}/...). Evita mandar el audio inline.
  audioPath?: string;
  // alternativa para audios cortos: base64 inline.
  audioBase64?: string;
  mimeType?: string;
  // para detectar y reintentar jobs; lo setea quien encola.
  intento?: number;
}

export interface IaQueue {
  enqueue(job: IaJob): Promise<void>;
}

// token de inyeccion (NestJS no puede inyectar por interfaz, necesita un token).
export const IA_QUEUE = Symbol('IA_QUEUE');
