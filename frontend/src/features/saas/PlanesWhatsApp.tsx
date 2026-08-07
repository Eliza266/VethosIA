import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { listarPlanes } from './api';

// Numero de WhatsApp de Vethos AI para gestionar pagos/activacion manual (Fase 1:
// sin pasarela de pago integrada, Eliza confirma el pago y activa la cuenta desde aca).
const WHATSAPP_NUMERO = '573019188657';

const linkWhatsApp = (nombrePlan: string): string =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(`Quiero obtener el plan ${nombrePlan}`)}`;

const formatCOP = (valor: number): string => `$${valor.toLocaleString('es-CO')}`;

export const PlanesWhatsAppGrid: React.FC<{ className?: string }> = ({ className = '' }) => {
  const planes = useQuery({ queryKey: ['planes-checkout'], queryFn: listarPlanes });
  const activos = (planes.data ?? []).filter((p) => p.activo);

  if (planes.isLoading) {
    return <p className="text-sm text-slate-400">Cargando planes...</p>;
  }
  if (planes.isError || activos.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No pudimos cargar los planes. Escríbenos por WhatsApp al{' '}
        <a href={linkWhatsApp('')} className="font-bold text-cyan-300 underline">
          +57 301 9188657
        </a>
        .
      </p>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {activos.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
        >
          <h3 className="text-sm font-black uppercase tracking-wide text-cyan-200">{plan.nombre}</h3>
          <p className="mt-2 text-2xl font-black text-white">
            {formatCOP(plan.precioMensualCOP)}
            <span className="text-xs font-medium text-white/60">/mes</span>
          </p>
          <p className="mt-1 text-xs text-white/60">
            Hasta {plan.asientosMax} veterinario{plan.asientosMax === 1 ? '' : 's'} ·{' '}
            {plan.limiteHistoriasMes.toLocaleString('es-CO')} pacientes/mes
          </p>
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
      ))}
    </div>
  );
};

export { linkWhatsApp, WHATSAPP_NUMERO };
export default PlanesWhatsAppGrid;
