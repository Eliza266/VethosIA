import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Building2, CreditCard, FileClock, Hospital, Settings, ShieldCheck, Users } from 'lucide-react';
import { Card } from '../../components/ui/Primitives';
import type { SuperAdminSection } from './types';

const NAV: Array<{ id: SuperAdminSection; label: string; to: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Dashboard', to: '/admin', icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'entidades', label: 'Entidades', to: '/admin?panel=entidades', icon: <Building2 className="h-4 w-4" /> },
  { id: 'veterinarias', label: 'Veterinarias', to: '/admin?panel=veterinarias', icon: <Hospital className="h-4 w-4" /> },
  { id: 'usuarios', label: 'Usuarios', to: '/admin?panel=usuarios', icon: <Users className="h-4 w-4" /> },
  { id: 'planes', label: 'Planes', to: '/planes', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'suscripciones', label: 'Suscripciones', to: '/suscripciones', icon: <Activity className="h-4 w-4" /> },
  { id: 'pagos', label: 'Pagos', to: '/admin?panel=pagos', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'auditoria', label: 'Auditoría', to: '/auditoria', icon: <FileClock className="h-4 w-4" /> },
  { id: 'configuracion', label: 'Configuración', to: '/configuracion', icon: <Settings className="h-4 w-4" /> },
];

export const SuperAdminShell: React.FC<React.PropsWithChildren<{ active: SuperAdminSection }>> = ({
  active,
  children,
}) => (
  <div className="mx-auto grid max-w-7xl gap-5" data-active-section={active}>
    <section className="command-hero p-6 sm:p-8" data-testid="superadmin-deep-shell">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <span className="inline-flex rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
            Soporte plataforma
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Operación plataforma
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
            Control global de entidades, sedes, usuarios, planes, suscripciones, cobros, auditoría y configuración segura.
          </p>
        </div>
        <div className="command-panel-dark p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Modo global</p>
          <strong className="mt-1 block text-2xl font-black text-white">Super Admin</strong>
          <p className="mt-2 text-xs leading-5 text-white/68">No opera clínica tenant ni ejecuta jobs reales.</p>
        </div>
      </div>
    </section>

    <Card className="premium-card" padding="sm">
      <nav aria-label="Módulos Super Admin" className="flex flex-wrap gap-2">
        {NAV.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            aria-current={item.id === active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${
              item.id === active ? 'nav-pill-active' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </Card>

    {children}
  </div>
);
