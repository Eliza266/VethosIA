// Validacion fail-fast de las variables de entorno al boot. Si falta algo critico o
// un valor es invalido, la API NO arranca y dice exactamente que esta mal. Esto evita
// el clasico "arranco pero explota en runtime" cuando una env esta mal escrita.
//
// Filosofia: en dev/test/emulador somos permisivos (casi todo tiene default), pero en
// produccion exigimos las claves de los proveedores que de verdad vamos a usar segun
// STT_PROVIDER / LLM_PROVIDER / QUEUE_DRIVER. Asi el deploy falla temprano, no a mitad
// de una consulta clinica.
import { z } from 'zod';

export const DEV_INVITE_SECRET = 'vetia-dev-invite-secret-cambiar-en-prod';
export const MIN_INVITE_SECRET_LENGTH = 32;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(8080),
    API_PREFIX: z.string().min(1).default('v1'),
    CORS_ORIGIN: z.string().optional(),

    // Firebase / GCP
    GCLOUD_PROJECT: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
    STORAGE_EMULATOR_HOST: z.string().optional(),

    // Modo IA mock (solo dev/test). Activa proveedores locales sin claves reales.
    IA_MOCK: z
      .preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean())
      .default(false),

    // Seleccion de proveedores de IA (adaptadores intercambiables).
    STT_PROVIDER: z.enum(['openai', 'gemini', 'mock']).default('openai'),
    LLM_PROVIDER: z.enum(['anthropic', 'openai', 'gemini', 'mock']).default('anthropic'),

    // Claves de IA (SOLO server-side). Opcionales en dev/test; requeridas en prod segun proveedor.
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
    ANTHROPIC_MODEL_COMPLEX: z.string().default('claude-opus-4-8'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_STT_MODEL: z.string().default('gpt-4o-transcribe'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),

    // Email
    EMAIL_FROM: z.string().default('vetiasoporte@gmail.com'),
    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().positive().default(587),
    EMAIL_SECURE: z
      .preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean())
      .default(false),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    EMAIL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    EMAIL_MOCK: z
      .preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean())
      .default(false),

    // Cola IA asincrona
    QUEUE_DRIVER: z.enum(['inmemory', 'cloudtasks']).default('inmemory'),
    CLOUD_TASKS_LOCATION: z.string().default('us-central1'),
    CLOUD_TASKS_QUEUE: z.string().default('vetia-ia'),
    IA_WORKER_URL: z.string().optional(),
    CLOUD_TASKS_INVOKER_SA: z.string().optional(),
    IA_WORKER_SECRET: z.string().optional(),

    // Pagos Wompi (sandbox/prod). Opcionales hasta activar pagos.
    WOMPI_PUBLIC_KEY: z.string().optional(),
    WOMPI_PRIVATE_KEY: z.string().optional(),
    WOMPI_EVENTS_SECRET: z.string().optional(),
    WOMPI_INTEGRITY_SECRET: z.string().optional(),
    WOMPI_BASE_URL: z.string().url().default('https://sandbox.wompi.co/v1'),

    // Sesion
    SESSION_INACTIVITY_HOURS: z.coerce.number().positive().default(8),

    // Secreto para firmar tokens de invitacion (enlace unico 48h). En prod, secreto fuerte.
    INVITE_SECRET: z.string().default(DEV_INVITE_SECRET),
    INVITE_TTL_HORAS: z.coerce.number().positive().default(48),
  })
  .superRefine((env, ctx) => {
    const requerir = (cond: boolean, campo: string, motivo: string): void => {
      if (cond) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: motivo });
      }
    };

    if (env.NODE_ENV === 'production') {
      requerir(
        !env.INVITE_SECRET || env.INVITE_SECRET.trim().length === 0,
        'INVITE_SECRET',
        'obligatorio en produccion (min 32 chars; recomendado 48+).',
      );
      requerir(
        env.INVITE_SECRET === DEV_INVITE_SECRET,
        'INVITE_SECRET',
        'no puede usar el valor default de desarrollo en produccion.',
      );
      requerir(
        !!env.INVITE_SECRET && env.INVITE_SECRET.length < MIN_INVITE_SECRET_LENGTH,
        'INVITE_SECRET',
        'demasiado corto en produccion (min 32 chars; recomendado 48+).',
      );
    }

    // En produccion real (no emulador) exigimos las claves de los proveedores elegidos.
    const usaEmulador = !!env.FIRESTORE_EMULATOR_HOST;
    const esProd = env.NODE_ENV === 'production' && !usaEmulador;
    if (!esProd) return;

    requerir(env.IA_MOCK, 'IA_MOCK', 'no permitido en produccion (solo dev/test)');
    requerir(env.EMAIL_MOCK, 'EMAIL_MOCK', 'no permitido en produccion (solo dev/test)');
    requerir(env.STT_PROVIDER === 'mock', 'STT_PROVIDER', 'mock no permitido en produccion');
    requerir(env.LLM_PROVIDER === 'mock', 'LLM_PROVIDER', 'mock no permitido en produccion');

    const mockStt = env.IA_MOCK || env.STT_PROVIDER === 'mock';
    const mockLlm = env.IA_MOCK || env.LLM_PROVIDER === 'mock';

    requerir(!mockLlm && env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY', 'requerida porque LLM_PROVIDER=anthropic');
    requerir(!mockLlm && env.LLM_PROVIDER === 'openai' && !env.OPENAI_API_KEY, 'OPENAI_API_KEY', 'requerida porque LLM_PROVIDER=openai');
    requerir(!mockLlm && env.LLM_PROVIDER === 'gemini' && !env.GEMINI_API_KEY, 'GEMINI_API_KEY', 'requerida porque LLM_PROVIDER=gemini');
    requerir(!mockStt && env.STT_PROVIDER === 'openai' && !env.OPENAI_API_KEY, 'OPENAI_API_KEY', 'requerida porque STT_PROVIDER=openai');
    requerir(!mockStt && env.STT_PROVIDER === 'gemini' && !env.GEMINI_API_KEY, 'GEMINI_API_KEY', 'requerida porque STT_PROVIDER=gemini');
    requerir(env.QUEUE_DRIVER === 'cloudtasks' && !env.IA_WORKER_URL, 'IA_WORKER_URL', 'requerida porque QUEUE_DRIVER=cloudtasks');
    requerir(
      !env.IA_WORKER_SECRET || env.IA_WORKER_SECRET.length < 32,
      'IA_WORKER_SECRET',
      'obligatorio en produccion (min 32 chars). Cloud Run publico (--no-invoker-iam-check): no usar JWT estructural solo.',
    );
    requerir(
      env.QUEUE_DRIVER === 'cloudtasks' && !env.IA_WORKER_SECRET,
      'IA_WORKER_SECRET',
      'requerida porque QUEUE_DRIVER=cloudtasks',
    );
  });

export type Env = z.infer<typeof envSchema>;

// Parsea y valida. Lanza un Error claro y agregado si algo no cuadra.
export function validateEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuracion de entorno invalida -> ${detalle}`);
  }
  return parsed.data;
}
