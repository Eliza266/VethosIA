// Lectura centralizada de feature flags. La idea (Strangler Fig) es que toda la
// app pregunte ACA si debe usar la API nueva o el camino legacy (Firestore/Gemini
// directo). Por defecto TODO esta apagado => comportamiento identico al actual.
//
// Centralizar esto evita el clasico "import.meta.env.VITE_USE_API_X === 'true'"
// repartido por medio repo, que es facil de tipear mal y dificil de mockear en tests.

const parseBool = (value: string | undefined): boolean => {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'yes';
};

export interface FeatureFlags {
  /** Generar numero de HC via API en vez de la Cloud Function callable */
  useApiHC: boolean;
  /** Transcripcion + SOAP via API en vez de pegarle a Gemini desde el navegador */
  useApiIA: boolean;
  /** Generacion/envio de documentos (PDF, email) via API */
  useApiDocs: boolean;
  /** CRUD (pacientes, citas, vacunas) via API /v1 en vez de Firestore directo */
  useApiCRUD: boolean;
  /** Envio real de correo al propietario (apagado por defecto en demo) */
  emailRealEnabled: boolean;
}

export const getFeatureFlags = (): FeatureFlags => ({
  useApiHC: parseBool(import.meta.env.VITE_USE_API_HC),
  useApiIA: parseBool(import.meta.env.VITE_USE_API_IA),
  useApiDocs: parseBool(import.meta.env.VITE_USE_API_DOCS),
  useApiCRUD: parseBool(import.meta.env.VITE_USE_API_CRUD),
  emailRealEnabled: parseBool(import.meta.env.VITE_EMAIL_REAL_ENABLED),
});

// Helpers puntuales por si en algun lado solo interesa un flag.
export const useApiHC = (): boolean => getFeatureFlags().useApiHC;
export const useApiIA = (): boolean => getFeatureFlags().useApiIA;
export const useApiDocs = (): boolean => getFeatureFlags().useApiDocs;
export const useApiCRUD = (): boolean => getFeatureFlags().useApiCRUD;
