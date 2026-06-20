import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'] as const;

export interface InactivityOptions {
  /** Horas de inactividad antes del logout. Default 8h (config del PDF). */
  hours?: number;
  /** Si es false, no arma el temporizador (ej. usuario no logueado). */
  enabled?: boolean;
}

// Cierra sesion tras N horas sin actividad del usuario. Cualquier interaccion
// (teclado, mouse, scroll, volver a la pestania) reinicia el contador.
export function useInactivityLogout(onTimeout: () => void, options: InactivityOptions = {}): void {
  const { hours = 8, enabled = true } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guardamos el callback en un ref para no re-armar listeners en cada render.
  const cbRef = useRef(onTimeout);

  useEffect(() => {
    cbRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;
    const ms = Math.max(1, hours) * 60 * 60 * 1000;

    const reset = (): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => cbRef.current(), ms);
    };

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [hours, enabled]);
}
