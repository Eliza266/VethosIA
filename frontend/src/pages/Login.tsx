import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Loader2, Sparkles, Lock, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { isFirebaseConfigured, missingFirebaseConfig } from '../lib/firebase';
import logoVethos from '../assets/logo-vethos.png';

const Login: React.FC = () => {
  const { user, loginWithGoogle, loginWithEmail, resetPassword, loading, accessDeniedMessage } =
    useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const navigate = useNavigate();
  const firebaseConfigMessage = isFirebaseConfigured
    ? null
    : `Configura ${missingFirebaseConfig.join(', ')} en frontend/.env.local para habilitar el acceso.`;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage);
      return;
    }
    setIsLoggingIn(true);
    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setInfo(null);
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage);
      return;
    }
    if (!email) {
      setError('Escribe tu email para enviarte el enlace de recuperación.');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Te enviamos un correo para restablecer tu contraseña.');
    } catch {
      setError('No se pudo enviar el correo de recuperación.');
    }
  };

  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage);
      setIsLoggingIn(false);
      return;
    }
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(getErrorMessage(err, 'Ocurrió un error al iniciar sesión con Google. Inténtalo de nuevo.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-shadow placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

  return (
    <div className="flex min-h-screen veth-page-shell">
      {/* Hero desktop */}
      <div className="command-hero relative hidden rounded-none border-0 lg:flex lg:w-[54%] flex-col justify-between overflow-hidden p-12 text-white">
        <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[55%] w-[55%] rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-[15%] -right-[15%] h-[70%] w-[70%] rounded-full bg-white/8 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
            <img src={logoVethos} alt="Vethos AI" className="h-8 w-8 object-contain" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Vethos<span className="text-cyan-200"> AI</span>
          </span>
          <span className="ml-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Clinical Command Center
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg animate-fade-in">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            IA clínica para veterinarios
          </div>
          <h1 className="mb-6 text-5xl font-black leading-[1.02] tracking-tight">
            Historias clínicas inteligentes para equipos veterinarios modernos.
          </h1>
          <p className="text-base leading-relaxed text-cyan-50/90">
            Graba el audio de tus consultas. Vethos transcribe, estructura SOAP y deja listo el expediente para
            aprobar, compartir PDF o WhatsApp en segundos.
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              'Ahorra hasta 2 horas diarias de papeleo',
              'Formato SOAP estándar (S / O / A / P)',
              'Historial digital seguro con control por rol',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-cyan-200 text-xs">
                  ✓
                </span>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-4 text-xs text-cyan-100/80">
          <span>&copy; {new Date().getFullYear()} Vethos AI</span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Sesión cifrada · datos clínicos protegidos
          </span>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex w-full flex-1 items-center justify-center bg-white/72 p-6 backdrop-blur-xl sm:p-8 lg:w-[46%]">
        <div className="w-full max-w-md animate-fade-in space-y-7">
          {/* Mobile hero compacto */}
          <div className="command-hero p-5 lg:hidden">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                <img src={logoVethos} alt="Vethos AI" className="h-6 w-6 object-contain" />
              </span>
              <span className="text-lg font-extrabold text-white">
                Vethos<span className="text-cyan-200"> AI</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/78">
              Plataforma clínica con IA: SOAP automático, expedientes digitales y flujo seguro por rol.
            </p>
          </div>

          <div className="premium-card p-6 text-center lg:text-left">
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text)] sm:text-3xl">
              Bienvenido de nuevo
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Accede a tu panel médico y gestiona expedientes clínicos.
            </p>
            <p className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              Entorno demo: usa las credenciales asignadas a tu rol. No compartas contraseñas fuera del equipo.
            </p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              ¿Eres nuevo en Vethos AI?{' '}
              <Link to="/registro" className="font-bold text-[var(--accent)]">
                Crea tu cuenta gratis
              </Link>
              .
            </p>
          </div>

          {accessDeniedMessage && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-[var(--warn-soft)] p-4 text-sm text-[var(--warn)]">
              <span className="font-bold">Acceso denegado:</span> {accessDeniedMessage}
            </div>
          )}

          {firebaseConfigMessage && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-[var(--warn-soft)] p-4 text-sm text-[var(--warn)]">
              <span className="font-bold">Configuración local pendiente:</span> {firebaseConfigMessage}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {info && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-[var(--success-soft)] p-4 text-sm text-[var(--success)]">
              {info}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="premium-card space-y-3 p-4">
            <input
              type="email"
              required
              aria-label="Correo electrónico"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                required
                minLength={6}
                aria-label="Contraseña"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
              >
                {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoggingIn || loading || !isFirebaseConfigured}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-accent)] transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-50"
            >
              Iniciar sesión
            </button>
            <div className="flex justify-end text-xs text-[var(--muted)]">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isFirebaseConfigured}
                className="font-medium hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" /> o <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn || loading || !isFirebaseConfigured}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-sm font-bold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--surface-2)] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.42 7.5l3.86 3C6.19 7.56 8.84 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.73-4.94 3.73-8.55z" />
                  <path fill="#FBBC05" d="M5.28 14.5c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.42 7.14C.51 8.97 0 11.01 0 13.18c0 2.17.51 4.21 1.42 6.04l3.86-3.04z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.16 0-5.81-2.52-6.72-5.46L1.42 15.9C3.37 19.75 7.35 22.4 12 22.4z" />
                </svg>
                Iniciar sesión con Google
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <span>Conexión cifrada SSL · acceso controlado por rol</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
export { Login };
