import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Home, Info } from 'lucide-react';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  targetLabel?: string;
  targetPath?: string;
}

const pageClass =
  'command-hero mx-auto flex min-h-[46vh] max-w-4xl flex-col justify-center p-7 shadow-[0_30px_80px_-52px_rgba(7,17,31,0.78)] sm:p-9';

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  description,
  targetLabel = 'Volver al dashboard',
  targetPath = '/',
}) => (
  <section className={pageClass} aria-label={title}>
    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-white">
      <Info className="h-5 w-5" />
    </div>
    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Operación centralizada</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
      {description} Gestión administrada por soporte plataforma.
    </p>
    <div className="mt-6">
      <Link
        to={targetPath}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-black text-[var(--accent-strong)] shadow-lg transition hover:brightness-95"
      >
        {targetLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </section>
);

export const NotFound: React.FC = () => (
  <section className={pageClass} aria-label="Ruta no encontrada">
    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-amber-100">
      <AlertTriangle className="h-5 w-5" />
    </div>
    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">404</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Ruta no encontrada</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
      Esta dirección no existe o no está disponible para el rol actual.
    </p>
    <div className="mt-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-black text-[var(--accent-strong)] shadow-lg transition hover:brightness-95"
      >
        <Home className="h-4 w-4" />
        Volver al dashboard
      </Link>
    </div>
  </section>
);

export default NotFound;
