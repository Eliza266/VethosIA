// Manejo de errores unificado. Antes cada hook hacia su propio
// `catch (err: any) { setError('texto suelto') }` y se perdia el error original.
// Con AppError llevamos un mensaje apto para el usuario + la causa real para logs.

export class AppError extends Error {
  /** Codigo corto para discriminar (ej. 'auth/denied', 'consultas/save-failed') */
  readonly code: string;
  /** Error original que disparo esto (para logs / debugging), no para mostrar */
  readonly cause?: unknown;

  constructor(message: string, code = 'app/error', cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

// Saca un mensaje legible de cualquier cosa que un catch pueda agarrar.
// Firebase tira objetos con .code y .message; axios mete error.response.data.
export const getErrorMessage = (error: unknown, fallback = 'Ocurrio un error inesperado.'): string => {
  if (error instanceof AppError) return error.message;
  
  const anyError = error as { code?: string };
  if (anyError?.code === 'auth/email-already-in-use') {
    return 'Esta cuenta ya está registrada. Por favor, inicia sesión normalmente.';
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybe = error as {
      message?: unknown;
      error?: { message?: unknown };
      response?: { data?: { message?: unknown; error?: { message?: unknown } } };
    };
    const data = maybe.response?.data;
    if (data && typeof data.message === 'string') return data.message;
    if (data?.error && typeof data.error.message === 'string') return data.error.message;
    if (typeof maybe.message === 'string') return maybe.message;
    if (maybe.error && typeof maybe.error.message === 'string') return maybe.error.message;
  }
  return fallback;
};

// Envuelve un error crudo en un AppError sin perder la causa.
export const toAppError = (error: unknown, code: string, fallbackMessage: string): AppError => {
  if (error instanceof AppError) return error;
  const responseCode =
    error && typeof error === 'object'
      ? (error as { response?: { data?: { code?: unknown } } }).response?.data?.code
      : undefined;
  return new AppError(
    getErrorMessage(error, fallbackMessage),
    typeof responseCode === 'string' && responseCode ? responseCode : code,
    error,
  );
};
