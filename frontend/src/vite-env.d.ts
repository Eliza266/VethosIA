/// <reference types="vite/client" />

// Tipamos las env vars que usa el front. Asi `import.meta.env.VITE_*` deja de
// ser `any` y el compilador nos avisa si escribimos mal el nombre de un flag.
interface ImportMetaEnv {
  // Firebase
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;

  // IA: la clave de proveedores vive SOLO server-side. NINGUNA clave de IA en VITE_*.

  // Strangler Fig: API que se monta por encima de Firebase
  readonly VITE_API_BASE_URL?: string;

  // Feature flags (apagados por defecto -> comportamiento legacy identico)
  readonly VITE_USE_API_HC?: string;
  readonly VITE_USE_API_IA?: string;
  readonly VITE_USE_API_DOCS?: string;
  readonly VITE_USE_API_CRUD?: string;

  // Codigo de pais por defecto para los links de WhatsApp (antes '57' hardcodeado)
  readonly VITE_WHATSAPP_COUNTRY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
