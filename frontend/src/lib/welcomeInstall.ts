export const WELCOME_INSTALL_SEEN_KEY = 'vethos_welcome_install_seen';
export const WELCOME_INSTALL_CLOSED_EVENT = 'vethos:welcome-install-closed';

// standalone = ya abierta como app instalada (no como pestaña de navegador).
// matchMedia puede no existir (jsdom en tests, navegadores muy viejos); se trata como "no instalada".
export const esStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const navegadorIOS = window.navigator as Navigator & { standalone?: boolean };
  const modoStandalone = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  return modoStandalone || navegadorIOS.standalone === true;
};

export const haVistoBienvenida = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(WELCOME_INSTALL_SEEN_KEY) === 'visto';
  } catch {
    return true;
  }
};

// true si el popup de bienvenida está a punto de mostrarse (para que otros overlays,
// como el tour guiado, esperen a que se cierre antes de arrancar).
export const seMostraraBienvenida = (): boolean => !esStandalone() && !haVistoBienvenida();
