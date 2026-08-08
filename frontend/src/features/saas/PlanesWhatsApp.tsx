import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, MessageCircle } from 'lucide-react';
import { listarPlanes, type Plan } from './api';

// Numero de WhatsApp de Vethos AI para gestionar pagos/activacion manual (Fase 1:
// sin pasarela de pago integrada, Eliza confirma el pago y activa la cuenta desde aca).
const WHATSAPP_NUMERO = '573019188657';

const linkWhatsApp = (nombrePlan: string): string =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(`Quiero obtener el plan ${nombrePlan}`)}`;

const formatCOP = (valor: number): string => `$${valor.toLocaleString('es-CO')}`;

// Copy comercial fijo (tomado del infografico de precios): la API solo trae los
// datos numericos del plan, esta tabla completa la ficha visual por nombre.
interface PlanCopy {
  tier: string;
  descripcion: string;
  features: string[];
  recomendado?: boolean;
}

const PLAN_COPY: Record<string, PlanCopy> = {
  'Veterinario Individual': {
    tier: 'Individual',
    descripcion: 'Ideal para veterinarios independientes.',
    features: ['Historia clínica automática SOAP', 'Extracción de datos del paciente', 'Envío por WhatsApp o correo'],
  },
  'Clínica Start': {
    tier: 'Clínica',
    descripcion: 'Consultorios y clínicas pequeñas.',
    features: ['Gestión de múltiples veterinarios', 'Panel administrativo centralizado', 'Historial compartido de pacientes'],
    recomendado: true,
  },
  'Clínica Pro': {
    tier: 'Clínica',
    descripcion: 'Clínicas medianas.',
    features: ['Estadísticas y reportes avanzados', 'Filtros y búsqueda avanzada', 'Roles y permisos personalizables'],
  },
  'Clínica Enterprise': {
    tier: 'Enterprise',
    descripcion: 'Hospitales y grandes clínicas.',
    features: ['Soporte prioritario dedicado', 'Onboarding personalizado', 'Capacitación para tu equipo'],
  },
};

const TIER_COLOR: Record<string, string> = {
  Individual: 'text-[var(--accent)]',
  Clínica: 'text-teal-600',
  Enterprise: 'text-[var(--ink)]',
};

const copyPara = (plan: Plan): PlanCopy =>
  PLAN_COPY[plan.nombre] ?? { tier: 'Plan', descripcion: '', features: [] };

export const PlanesWhatsAppGrid: React.FC<{ className?: string; dark?: boolean }> = ({
  className = '',
  dark = true,
}) => {
  const planes = useQuery({ queryKey: ['planes-checkout'], queryFn: listarPlanes });
  const activos = (planes.data ?? []).filter((p) => p.activo);
  const mutedClass = dark ? 'text-white/60' : 'text-[var(--muted)]';

  if (planes.isLoading) {
    return <p className={`text-sm ${mutedClass}`}>Cargando planes...</p>;
  }
  if (planes.isError || activos.length === 0) {
    return (
      <p className={`text-sm ${mutedClass}`}>
        No pudimos cargar los planes. Escríbenos por WhatsApp al{' '}
        <a href={linkWhatsApp('')} className="font-bold text-[var(--clinical-cyan)] underline">
          +57 301 9188657
        </a>
        .
      </p>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {activos.map((plan) => {
        const copy = copyPara(plan);
        const tierColor = dark ? 'text-cyan-200' : TIER_COLOR[copy.tier] ?? 'text-[var(--accent)]';
        return (
          <div
            key={plan.id}
            className={
              (dark
                ? 'relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm'
                : 'relative flex flex-col rounded-2xl border p-5 shadow-sm ' +
                  (copy.recomendado
                    ? 'border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[var(--surface)]'
                    : 'border-[var(--border)] bg-[var(--surface)]')) as string
            }
          >
            {copy.recomendado && (
              <span className="absolute -top-3 left-5 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                Más elegido
              </span>
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${tierColor}`}>
              {copy.tier}
            </span>
            <h3 className={`mt-0.5 text-sm font-black ${dark ? 'text-white' : 'text-[var(--text)]'}`}>
              {plan.nombre}
            </h3>
            <p className={`mt-2 text-2xl font-black ${dark ? 'text-white' : 'text-[var(--text)]'}`}>
              {formatCOP(plan.precioMensualCOP)}
              <span className={`text-xs font-medium ${mutedClass}`}>/mes</span>
            </p>
            {copy.descripcion && <p className={`mt-1 text-xs ${mutedClass}`}>{copy.descripcion}</p>}
            <p className={`mt-1 text-xs font-semibold ${dark ? 'text-white/75' : 'text-[var(--text-secondary)]'}`}>
              Hasta {plan.asientosMax} veterinario{plan.asientosMax === 1 ? '' : 's'} ·{' '}
              {plan.limiteHistoriasMes.toLocaleString('es-CO')} pacientes/mes
            </p>
            {copy.features.length > 0 && (
              <ul className="mt-3 flex-1 space-y-1.5">
                {copy.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-1.5 text-xs ${dark ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}
                  >
                    <Check className={`mt-0.5 h-3 w-3 shrink-0 ${dark ? 'text-emerald-300' : 'text-emerald-600'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <a
              href={linkWhatsApp(plan.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-95 active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" />
              Escribir por WhatsApp
            </a>
          </div>
        );
      })}
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { linkWhatsApp, WHATSAPP_NUMERO };
export default PlanesWhatsAppGrid;
