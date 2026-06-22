// Lectura central de config por env. Nada de leer process.env desperdigado por todo el codigo:
// si manana cambia una variable, se toca aca. Todo tipado, sin 'any'.

export type EmailProvider = 'sendgrid' | 'smtp';
export type QueueDriver = 'inmemory' | 'cloudtasks';

export interface AppConfig {
  port: number;
  // base path del contrato compartido con el frontend. NO cambiar sin avisar al front.
  apiPrefix: string;
  projectId: string;
  storageBucket: string;
  // si esta seteado, firebase-admin habla con los emuladores en vez de la nube real.
  useEmulators: boolean;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface EmailConfig {
  provider: EmailProvider;
  from: string;
  sendgridApiKey?: string;
  smtp: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
  // tope simple de envios por destinatario en una ventana, para no abusar del proveedor.
  rateLimitMax: number;
  rateLimitWindowMs: number;
  /** Solo dev/test: simula envio sin SendGrid/SMTP. */
  mock: boolean;
}

export interface QueueConfig {
  driver: QueueDriver;
  // datos para el adaptador de Cloud Tasks (solo se usan si driver=cloudtasks).
  location: string;
  queueName: string;
  // URL publica del worker (este mismo servicio) a la que Cloud Tasks hace POST.
  workerUrl: string;
  // service account que Cloud Tasks usa para firmar el OIDC token al worker.
  invokerServiceAccount?: string;
  // secreto compartido para autenticar el worker cuando no usamos OIDC (ej. emulador).
  workerSecret?: string;
}

function bool(v: string | undefined, def = false): boolean {
  if (v === undefined) return def;
  return v === 'true' || v === '1';
}

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function loadAppConfig(): AppConfig {
  return {
    port: num(process.env.PORT, 8080),
    apiPrefix: process.env.API_PREFIX ?? 'v1',
    projectId: process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'vethosia-5895b',
    storageBucket: process.env.STORAGE_BUCKET ?? 'vethosia-5895b.firebasestorage.app',
    // si hay host de emulador de firestore, asumimos modo emulador.
    useEmulators: !!process.env.FIRESTORE_EMULATOR_HOST,
  };
}

export function loadGeminiConfig(): GeminiConfig {
  return {
    // OJO: esta key vive SOLO server-side. Nunca se manda al cliente. Antes estaba
    // expuesta como VITE_GEMINI_API_KEY en el navegador (mala idea), eso se elimina.
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
  };
}

export function loadEmailConfig(): EmailConfig {
  const provider: EmailProvider = process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp';
  return {
    provider,
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? 'vetiasoporte@gmail.com',
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    smtp: {
      host: process.env.EMAIL_HOST,
      port: num(process.env.EMAIL_PORT, 587),
      secure: bool(process.env.EMAIL_SECURE, false),
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    rateLimitMax: num(process.env.EMAIL_RATE_LIMIT_MAX, 5),
    rateLimitWindowMs: num(process.env.EMAIL_RATE_LIMIT_WINDOW_MS, 60_000),
    mock: bool(process.env.EMAIL_MOCK, false),
  };
}

export function loadQueueConfig(): QueueConfig {
  const driver = (process.env.QUEUE_DRIVER as QueueDriver) ?? 'inmemory';
  return {
    driver: driver === 'cloudtasks' ? 'cloudtasks' : 'inmemory',
    location: process.env.CLOUD_TASKS_LOCATION ?? 'us-central1',
    queueName: process.env.CLOUD_TASKS_QUEUE ?? 'vetia-ia',
    workerUrl: process.env.IA_WORKER_URL ?? '',
    invokerServiceAccount: process.env.CLOUD_TASKS_INVOKER_SA,
    workerSecret: process.env.IA_WORKER_SECRET,
  };
}
