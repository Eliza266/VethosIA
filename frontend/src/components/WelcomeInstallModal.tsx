import React, { useEffect, useState } from 'react';
import { X, Smartphone, Download } from 'lucide-react';
import { usePwa } from '../hooks/usePwa';
import logoVethos from '../assets/logo-vethos.png';
import { WELCOME_INSTALL_SEEN_KEY, WELCOME_INSTALL_CLOSED_EVENT, esStandalone } from '../lib/welcomeInstall';

const esIOS = (): boolean =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// Popover de bienvenida: se muestra una sola vez por navegador (tras iniciar sesion),
// invita a usar Vethos desde el celular y ofrece instalarla como app (icono en inicio).
const WelcomeInstallModal: React.FC = () => {
  const { instalable, promptInstall } = usePwa();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (esStandalone()) return;
    if (window.localStorage.getItem(WELCOME_INSTALL_SEEN_KEY) === 'visto') return;
    const t = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const cerrar = (): void => {
    setVisible(false);
    try {
      window.localStorage.setItem(WELCOME_INSTALL_SEEN_KEY, 'visto');
    } catch {
      /* almacenamiento no disponible */
    }
    // Avisa al tour guiado (useTourGuide) que ya puede arrancar: evita que ambos
    // popups se muestren encimados al mismo tiempo en la primera visita.
    window.dispatchEvent(new Event(WELCOME_INSTALL_CLOSED_EVENT));
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, cerrar]);

  const instalar = async (): Promise<void> => {
    await promptInstall();
    cerrar();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-install-title"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(7, 17, 31, 0.55)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="p-6 text-white" style={{ background: 'var(--gradient-hero)' }}>
          <div className="flex items-center justify-between">
            <img src={logoVethos} alt="Vethos AI" className="h-11 w-11 rounded-xl bg-white/12 p-1.5" />
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 id="welcome-install-title" className="mt-4 text-xl font-black tracking-tight">
            ¡Bienvenido a Vethos AI!
          </h2>
          <p className="mt-1.5 text-sm text-white/85">
            Graba, transcribe y documenta tus consultas desde donde estés.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Úsala desde el celular</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Vethos funciona igual de bien en tu teléfono que en el computador — ideal para
                grabar la consulta ahí mismo, en el consultorio.
              </p>
            </div>
          </div>

          {instalable && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Instálala como una app</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Agrega el ícono de Vethos a tu pantalla de inicio para abrirla directo, sin
                  buscarla en el navegador.
                </p>
              </div>
            </div>
          )}

          {instalable ? (
            <button
              type="button"
              onClick={() => void instalar()}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
            >
              Instalar Vethos AI
            </button>
          ) : esIOS() ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              Para agregar el ícono a tu pantalla de inicio: toca <b>Compartir</b> en Safari y
              elige <b>"Agregar a pantalla de inicio"</b>.
            </div>
          ) : null}

          <button
            type="button"
            onClick={cerrar}
            className="w-full text-center text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeInstallModal;
export { WelcomeInstallModal };
