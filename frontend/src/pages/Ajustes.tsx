import React from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../components/ui/Primitives';

interface AjustesCard {
  titulo: string;
  descripcion: string;
  to: string;
  icon: LucideIcon;
}

const TARJETAS: AjustesCard[] = [
  {
    titulo: 'Mi perfil',
    descripcion: 'Datos personales, contacto y contraseña.',
    to: '/perfil',
    icon: User,
  },
];

const Ajustes: React.FC = () => {
  return (
    <div className="mx-auto grid max-w-5xl gap-6" data-tour="ajustes-panel">
      <section className="premium-card bg-white p-6 sm:p-8 border border-slate-200">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Configuración</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Administra tus preferencias personales desde aquí.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TARJETAS.map((tarjeta) => {
          const Icon = tarjeta.icon;
          return (
            <Link key={tarjeta.titulo} to={tarjeta.to} className="group">
              <Card className="h-full shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_45px_-32px_rgba(15,110,86,0.55)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-accent">
                      {tarjeta.titulo}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{tarjeta.descripcion}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
};

export default Ajustes;
export { Ajustes };
