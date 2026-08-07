import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { ShieldCheck, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { isFirebaseConfigured, missingFirebaseConfig } from '../lib/firebase';
import { registrarCuenta } from '../features/tenant/api';
import logoVethos from '../assets/logo-vethos.png';

const Registro: React.FC = () => {
  const {
    user,
    loading,
    beginSelfRegistration,
    beginSelfRegistrationWithGoogle,
    finishSelfRegistration,
  } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [veterinariaNombre, setVeterinariaNombre] = useState('');
  const [matriculaProfesional, setMatriculaProfesional] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firebaseConfigMessage = isFirebaseConfigured
    ? null
    : `Configura ${missingFirebaseConfig.join(', ')} en frontend/.env.local para habilitar el registro.`;

  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const datosCompletos = (): string | null => {
    if (!nombre.trim()) return 'Escribe tu nombre completo.';
    if (!veterinariaNombre.trim()) return 'Escribe el nombre de tu veterinaria o consultorio.';
    if (!matriculaProfesional.trim()) return 'Escribe tu número de tarjeta profesional.';
    return null;
  };

  const provisionar = async () => {
    await registrarCuenta({
      nombre: nombre.trim(),
      veterinariaNombre: veterinariaNombre.trim(),
      matriculaProfesional: matriculaProfesional.trim(),
      telefono: telefono.trim() || undefined,
      ciudad: ciudad.trim() || undefined,
      pais: 'Colombia',
    });
  };

  const handleGoogleRegistro = async () => {
    const faltante = datosCompletos();
    if (faltante) {
      setError(faltante);
      return;
    }
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await beginSelfRegistrationWithGoogle();
      await provisionar();
      await finishSelfRegistration();
      navigate('/');
    } catch (err: unknown) {
      await finishSelfRegistration();
      await signOut(auth).catch(() => undefined);
      setError(getErrorMessage(err, 'No se pudo completar el registro. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const handleEmailRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    const faltante = datosCompletos();
    if (faltante) {
      setError(faltante);
      return;
    }
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await beginSelfRegistration(email.trim(), password);
      await provisionar();
      await finishSelfRegistration();
      navigate('/');
    } catch (err: unknown) {
      await finishSelfRegistration();
      await signOut(auth).catch(() => undefined);
      setError(getErrorMessage(err, 'No se pudo completar el registro. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-shadow placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

  return (
    <div className="flex min-h-screen veth-page-shell">
      <div className="command-hero relative hidden rounded-none border-0 lg:flex lg:w-[46%] flex-col justify-between overflow-hidden p-12 text-white">
        <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[55%] w-[55%] rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-[15%] -right-[15%] h-[70%] w-[70%] rounded-full bg-white/8 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
            <img src={logoVethos} alt="Vethos AI" className="h-8 w-8 object-contain" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Vethos<span className="text-cyan-200"> AI</span>
          </span>
        </div>
        <div className="relative z-10 my-auto max-w-lg animate-fade-in">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            7 días de prueba gratis
          </div>
          <h1 className="mb-6 text-4xl font-black leading-[1.05] tracking-tight">
            Crea tu cuenta y prueba Vethos AI sin costo.
          </h1>
          <p className="text-base leading-relaxed text-cyan-50/90">
            Al terminar tu prueba, elige un plan y activamos tu cuenta por WhatsApp. Sin tarjeta,
            sin compromiso.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-white/72 p-6 backdrop-blur-xl sm:p-8 lg:w-[54%]">
        <div className="w-full max-w-md animate-fade-in space-y-6">
          <div className="premium-card p-6 text-center lg:text-left">
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text)] sm:text-3xl">
              Crea tu cuenta
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Empieza tu prueba gratuita de 7 días. ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-bold text-[var(--accent)]">
                Inicia sesión
              </Link>
              .
            </p>
          </div>

          {firebaseConfigMessage && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-[var(--warn-soft)] p-4 text-sm text-[var(--warn)]">
              {firebaseConfigMessage}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleEmailRegistro} className="premium-card space-y-3 p-4">
            <input
              type="text"
              required
              aria-label="Nombre completo"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              required
              aria-label="Nombre de tu veterinaria o consultorio"
              placeholder="Nombre de tu veterinaria o consultorio"
              value={veterinariaNombre}
              onChange={(e) => setVeterinariaNombre(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              required
              aria-label="Número de tarjeta profesional"
              placeholder="Número de tarjeta profesional"
              value={matriculaProfesional}
              onChange={(e) => setMatriculaProfesional(e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              aria-label="Teléfono / WhatsApp (opcional)"
              placeholder="Teléfono / WhatsApp (opcional)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              aria-label="Ciudad (opcional)"
              placeholder="Ciudad (opcional)"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className={inputClass}
            />
            <div className="h-px bg-[var(--border)]" />
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
                placeholder="Contraseña (mínimo 6 caracteres)"
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
              disabled={enviando || loading || !isFirebaseConfigured}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-accent)] transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-50"
            >
              {enviando ? 'Creando tu cuenta...' : 'Crear cuenta con correo'}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" /> o <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <button
            onClick={handleGoogleRegistro}
            disabled={enviando || loading || !isFirebaseConfigured}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-sm font-bold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--surface-2)] active:scale-[0.99] disabled:opacity-50"
          >
            {enviando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
                Creando tu cuenta...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.42 7.5l3.86 3C6.19 7.56 8.84 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.73-4.94 3.73-8.55z" />
                  <path fill="#FBBC05" d="M5.28 14.5c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.42 7.14C.51 8.97 0 11.01 0 13.18c0 2.17.51 4.21 1.42 6.04l3.86-3.04z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.16 0-5.81-2.52-6.72-5.46L1.42 15.9C3.37 19.75 7.35 22.4 12 22.4z" />
                </svg>
                Registrarme con Google
              </>
            )}
          </button>

          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Completa tus datos arriba antes de continuar con Google: los usamos para crear tu
            veterinaria y tu perfil de veterinario.
          </p>

          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <span>Conexión cifrada SSL · datos clínicos protegidos</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registro;
export { Registro };
