import axios, { type AxiosInstance, AxiosError } from 'axios';
import { auth } from './firebase';

// Evento global que el resto de la app puede escuchar para reaccionar a una sesion
// invalida (401) o a falta de permisos (403): por ejemplo, hacer logout y redirigir.
export const AUTH_ERROR_EVENT = 'vetia:auth-error';

export interface AuthErrorDetail {
  status: 401 | 403;
}

// Handler opcional inyectable (util en tests y para desacoplar del DOM).
let onAuthError: ((detail: AuthErrorDetail) => void) | null = null;
export const setAuthErrorHandler = (fn: ((detail: AuthErrorDetail) => void) | null): void => {
  onAuthError = fn;
};

// Tras login/logout o cambio de uid, el primer request debe forzar token fresco (claims).
let pendingIdTokenRefresh = false;

export const requestFreshIdToken = (): void => {
  pendingIdTokenRefresh = true;
};

// Cliente HTTP unico contra la API nueva (Strangler Fig). Mientras los feature
// flags esten apagados esto ni se usa, pero lo dejamos listo para enchufar.
//
// El interceptor agarra el Firebase ID token del usuario logueado y lo manda como
// Bearer en cada request. Asi la API puede validar identidad/permisos server-side
// (que es justo lo que el front hoy hace mal: checks de seguridad en cliente).

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  // currentUser puede ser null si todavia no resolvio el onAuthStateChanged;
  // en ese caso mandamos el request sin token y que la API responda 401.
  const currentUser = auth.currentUser;
  if (currentUser) {
    const forceRefresh = pendingIdTokenRefresh;
    if (forceRefresh) pendingIdTokenRefresh = false;
    const token = await currentUser.getIdToken(forceRefresh);
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Interceptor de respuesta: ante 401/403 notificamos (evento + handler) para que la
// app pueda cerrar sesion / redirigir. Reemitimos el error para que el caller lo maneje.
apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      const detail: AuthErrorDetail = { status };
      try {
        onAuthError?.(detail);
      } catch {
        /* el handler no debe romper la cadena de error */
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent<AuthErrorDetail>(AUTH_ERROR_EVENT, { detail }));
      }
    }
    return Promise.reject(error);
  },
);

/** Ping de salud de la API. Util para smoke tests / health checks. */
export const apiHealth = async (): Promise<boolean> => {
  try {
    const res = await apiClient.get('/v1/health');
    return res.status === 200;
  } catch {
    return false;
  }
};
