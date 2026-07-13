import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  PlusCircle,
  Settings,
  ShieldCheck,
  Syringe,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getModuleStatusLabel } from '../../lib/roleNavigation';
import type { NavIcon, RoleModule } from '../../lib/rbac';
import { SectionHeader } from '../../components/ui/Primitives';

const MODULE_ICON: Record<NavIcon, LucideIcon> = {
  dashboard: FileText,
  pacientes: Users,
  agenda: Calendar,
  vacunas: Syringe,
  brigadas: Activity,
  nuevo: PlusCircle,
  entidad: Building2,
  veterinaria: Building2,
  suscripcion: CreditCard,
  soporte: ShieldCheck,
  configuracion: Settings,
};

export const CommandCenterShell: React.FC<
  React.PropsWithChildren<{ testId: string; className?: string }>
> = ({ testId, className = '', children }) => (
  <div data-testid={testId} className={`space-y-8 animate-fade-in ${className}`}>
    {children}
  </div>
);

export const CommandHero: React.FC<{
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant: 'clinical' | 'clinic' | 'entity' | 'platform';
}> = ({ eyebrow, title, action }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <span className="text-xs font-bold uppercase tracking-wider text-accent">{eyebrow}</span>
      <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{title}</h1>
    </div>
    {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
  </div>
);

type ModuleGridVariant = 'default' | 'primary' | 'secondary' | 'document';

const GRID_CLASS: Record<ModuleGridVariant, string> = {
  default: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3',
  primary: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3',
  secondary: 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
  document: 'grid grid-cols-1 gap-3 sm:grid-cols-3',
};

const CARD_CLASS: Record<ModuleGridVariant, string> = {
  default: 'group premium-card premium-card-hover relative min-h-[156px] overflow-hidden p-5',
  primary: 'group premium-card premium-card-hover relative min-h-[168px] overflow-hidden p-5 ring-1 ring-[color-mix(in_srgb,var(--accent)_12%,transparent)]',
  secondary: 'group premium-card premium-card-hover relative min-h-[156px] overflow-hidden p-5',
  document: 'group premium-card premium-card-hover relative min-h-[128px] overflow-hidden p-4 bg-[color-mix(in_srgb,var(--surface)_88%,var(--accent-soft))]',
};

export const ModuleGrid: React.FC<{
  title: string;
  description: string;
  modules: RoleModule[];
  emptyText?: string;
  variant?: ModuleGridVariant;
  resolveHref?: (module: RoleModule) => string;
}> = ({
  title,
  description,
  modules,
  emptyText = 'No hay módulos habilitados para este rol.',
  variant = 'default',
  resolveHref,
}) => (
  <section aria-label={title} className="space-y-4">
    <SectionHeader title={title} description={description} />
    {modules.length === 0 ? (
      <div className="premium-card p-5 text-sm text-slate-500">{emptyText}</div>
    ) : (
      <div className={GRID_CLASS[variant]}>
        {modules.map((module) => {
          const Icon = MODULE_ICON[module.icon];
          const statusLabel = getModuleStatusLabel(module);
          const href = resolveHref?.(module) ?? module.path;
          return (
            <Link
              key={module.id}
              to={href}
              className={CARD_CLASS[variant]}
            >
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_14%,transparent)] sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-[var(--text)] group-hover:text-[var(--accent)]">
                        {module.label}
                      </h3>
                      {module.badge ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {module.badge}
                        </span>
                      ) : null}
                      {module.status !== 'active' ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-500">{module.description}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--accent)]">
                  {moduleActionLabel(module)}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    )}
  </section>
);

export const InsightPanel: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, children, action }) => (
  <section className="premium-card p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const PRIMARY_LINK_VARIANT_CLASS = {
  primary: 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--shadow-accent)] hover:brightness-95',
  secondary: 'border-2 text-[var(--clinical-cyan)] hover:bg-[color-mix(in_srgb,var(--clinical-cyan)_10%,transparent)]',
} as const;

export const PrimaryLink: React.FC<{
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: keyof typeof PRIMARY_LINK_VARIANT_CLASS;
  'data-tour'?: string;
}> = ({ to, children, icon, variant = 'primary', 'data-tour': dataTour }) => (
  <Link
    to={to}
    data-tour={dataTour}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${PRIMARY_LINK_VARIANT_CLASS[variant]}`}
    style={variant === 'secondary' ? { borderColor: 'var(--clinical-cyan)' } : undefined}
  >
    {icon}
    {children}
  </Link>
);

function moduleActionLabel(module: RoleModule): string {
  const byId: Record<string, string> = {
    soporte: 'Abrir consola',
    'entidades-global': 'Gestionar entidades',
    'veterinarias-global': 'Gestionar sedes',
    'usuarios-miembros': 'Revisar usuarios',
    'planes-globales': 'Configurar planes',
    'suscripciones-globales': 'Ver suscripciones',
    'pagos-cobros': 'Revisar pagos',
    'auditoria-global': 'Revisar auditoría',
    'configuracion-global': 'Ver configuración',
    entidad: 'Abrir entidad',
    'sedes-entidad': 'Gestionar sedes',
    'veterinarios-por-sede': 'Revisar equipo',
    'freelancers-entidad': 'Ver freelancers',
    'consumo-entidad': 'Ver consumo',
    'metricas-entidad': 'Ver métricas',
    'cobertura-territorial': 'Ver alcance',
    veterinarias: 'Gestionar clínica',
    'equipo-clinico': 'Gestionar equipo',
    pacientes: 'Revisar pacientes',
    agenda: 'Gestionar agenda',
    vacunas: 'Revisar vacunas',
    brigadas: 'Gestionar brigadas',
    'nueva-consulta': 'Iniciar consulta',
    'consulta-soap': 'Abrir SOAP',
    'nuevo-paciente': 'Crear paciente',
    'pdf-clinico': 'Ver PDF',
    'email-demo': 'Ver envío demo',
    'whatsapp-link': 'Abrir link seguro',
    suscripcion: 'Ver plan',
  };
  return byId[module.id] ?? `Abrir ${module.label}`;
}
