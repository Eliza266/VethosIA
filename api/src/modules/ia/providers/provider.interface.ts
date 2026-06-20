// Adaptadores intercambiables de IA. La API no se ata a un vendor: define interfaces y
// el modulo elige los proveedores por env (STT_PROVIDER / LLM_PROVIDER), con fallback.

// Speech-to-Text: recibe el audio en base64 + mimeType y devuelve la transcripcion.
export interface SttProvider {
  readonly nombre: string;
  transcribir(audioBase64: string, mimeType: string): Promise<string>;
}

// LLM: recibe un prompt y devuelve el texto crudo del modelo (que luego parseamos a SOAP).
export interface LlmProvider {
  readonly nombre: string;
  completar(prompt: string): Promise<string>;
}

// Tokens de inyeccion (NestJS no inyecta por interfaz). Cada uno resuelve a un ARRAY de
// proveedores en orden de preferencia: [primario, fallback...].
export const STT_PROVIDERS = Symbol('STT_PROVIDERS');
export const LLM_PROVIDERS = Symbol('LLM_PROVIDERS');
