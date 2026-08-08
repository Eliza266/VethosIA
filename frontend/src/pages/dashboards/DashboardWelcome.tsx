import React from 'react';
import { Link } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { displayUserLabel } from '../../lib/displayUser';

const primerNombre = (etiqueta: string): string => {
  if (etiqueta.includes('@')) return etiqueta;
  return etiqueta.trim().split(/\s+/)[0] ?? etiqueta;
};

const FECHA_HOY = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

// Franja de bienvenida compacta al tope del dashboard: mismo lenguaje visual (degradado
// oscuro + acento cian) que la tarjeta "Tu plan actual" de Suscripcion. No es un hero de
// video como en login/registro: un dashboard se opera, no se mira como una landing.
export const DashboardWelcome: React.FC<{
  nombre?: string | null;
  email?: string | null;
  veterinaria?: string | null;
}> = ({ nombre, email, veterinaria }) => {
  const saludo = primerNombre(displayUserLabel({ nombre, email }));
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg [background:linear-gradient(120deg,var(--ink,#0e1116)_0%,#16233f_55%,var(--accent)_130%)]">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(45%_80%_at_95%_0%,color-mix(in_srgb,var(--clinical-cyan)_22%,transparent),transparent_70%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black">Hola, {saludo} 👋</p>
          <p className="mt-0.5 text-sm text-white/70">
            {veterinaria ? `${veterinaria} · ` : ''}
            {FECHA_HOY}
          </p>
        </div>
        <Link
          to="/consultas/nueva-rapida"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--clinical-cyan)] px-4 py-2.5 text-sm font-black text-[#05242e] transition hover:brightness-95"
        >
          <Mic className="h-4 w-4" />
          Nueva consulta
        </Link>
      </div>
    </div>
  );
};

export default DashboardWelcome;
