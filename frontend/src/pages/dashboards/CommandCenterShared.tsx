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
};

export interface CommandStat {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'accent' | 'success' | 'warn' | 'info' | 'neutral';
}

const TONE_CLASS: Record<NonNullable<CommandStat['tone']>, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  neutral: 'bg-slate-100 text-slate-600',
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
  description: string;
  action?: React.ReactNode;
  variant: 'clinical' | 'clinic' | 'entity' | 'platform';
}> = ({ eyebrow, title, description, action, variant }) => {
  const variantClass =
    variant === 'clinical'
      ? 'command-hero text-white'
      : variant === 'platform'
        ? 'premium-card border-slate-900/10 bg-slate-950 text-white'
        : 'premium-card bg-white';
  const textClass = variant === 'clinical' || variant === 'platform' ? 'text-white/78' : 'text-slate-600';
  const titleClass = variant === 'clinical' || variant === 'platform' ? 'text-white' : 'text-slate-950';
  const badgeClass =
    variant === 'clinical' || variant === 'platform'
      ? 'border-white/15 bg-white/10 text-white'
      : 'border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--accent-soft)] text-[var(--accent)]';

  return (
    <section className={`${variantClass} overflow-hidden p-6 sm:p-8`} aria-label={eyebrow}>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${badgeClass}`}>
            {eyebrow}
          </span>
          <h1 className={`mt-4 max-w-4xl text-3xl font-black leading-[1.04] tracking-tight sm:text-4xl ${titleClass}`}>
            {title}
          </h1>
          <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${textClass}`}>{description}</p>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
      </div>
    </section>
  );
};

export const StatStrip: React.FC<{ stats: CommandStat[] }> = ({ stats }) => (
  <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {stats.map((stat) => (
      <div key={stat.label} className="metric-tile p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
            <strong className="mt-1 block text-2xl font-black text-slate-950">{stat.value}</strong>
            {stat.hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{stat.hint}</p> : null}
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${TONE_CLASS[stat.tone ?? 'accent']}`} />
        </div>
      </div>
    ))}
  </section>
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

export const PrimaryLink: React.FC<{
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ to, children, icon }) => (
  <Link
    to={to}
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-[var(--accent-contrast)] shadow-[var(--shadow-accent)] transition-all hover:brightness-95"
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
