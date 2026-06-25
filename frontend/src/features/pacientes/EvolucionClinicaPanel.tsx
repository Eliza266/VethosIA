import React from 'react';
import { Activity, HeartPulse, Ruler, Thermometer, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import type { Consulta } from '../../types';
import { construirEvolucionClinica } from './evolucion';

const formatValue = (value: number | string | undefined, unit: string): string | null =>
  value === undefined ? null : `${value}${unit ? ` ${unit}` : ''}`;

const tendenciaLabel = (estado: 'sube' | 'baja' | 'estable'): string => {
  if (estado === 'sube') return 'Sube';
  if (estado === 'baja') return 'Baja';
  return 'Estable';
};

const EvolucionClinicaPanel: React.FC<{ consultas: Consulta[] }> = ({ consultas }) => {
  const evolucion = construirEvolucionClinica(consultas);
  const ultimo = evolucion.ultimo;

  if (!ultimo) {
    return (
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Activity className="h-4 w-4 text-accent" />
            Constantes y signos
          </h3>
          <p className="text-xs text-slate-500">Evolución clínica basada solo en registros existentes.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-slate-500">
          <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium">Sin constantes registradas</p>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Cuando una consulta incluya peso, talla, temperatura, FC, FR o pulso, se mostrara aqui.
          </p>
        </div>
      </section>
    );
  }

  const cards = [
    { label: 'Ultimo peso', value: formatValue(ultimo.peso, 'kg'), icon: Activity },
    { label: 'Ultima talla', value: formatValue(ultimo.talla, 'cm'), icon: Ruler },
    { label: 'Temperatura', value: formatValue(ultimo.temperatura, 'C'), icon: Thermometer },
    { label: 'FC', value: formatValue(ultimo.frecuenciaCardiaca, 'lpm'), icon: HeartPulse },
    { label: 'FR', value: formatValue(ultimo.frecuenciaRespiratoria, 'rpm'), icon: Waves },
    { label: 'Pulso', value: ultimo.pulso, icon: HeartPulse },
  ].filter((card) => card.value);

  const TrendIcon = evolucion.tendenciaPeso?.estado === 'baja' ? TrendingDown : TrendingUp;

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 mb-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          Constantes y signos
        </h3>
        <p className="text-xs text-slate-500">
          Ultimo registro real capturado en consulta: {ultimo.fechaLabel}
          {ultimo.numeroHC ? ` - HC #${ultimo.numeroHC}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                <Icon className="h-3.5 w-3.5 text-accent" />
                {card.label}
              </div>
              <p className="mt-1 text-lg font-black text-slate-800">{card.value}</p>
            </div>
          );
        })}
      </div>

      {evolucion.tendenciaPeso && (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-sm text-slate-700">
          <div className="flex items-center gap-2 font-bold">
            <TrendIcon className="h-4 w-4 text-accent" />
            Tendencia peso: {tendenciaLabel(evolucion.tendenciaPeso.estado)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cambio entre los dos ultimos pesos registrados: {evolucion.tendenciaPeso.deltaKg} kg.
          </p>
        </div>
      )}

      {evolucion.puntos.length > 1 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Historial reciente</h4>
          <ol className="grid gap-2">
            {evolucion.puntos.slice(-3).reverse().map((punto) => (
              <li
                key={`${punto.consultaId ?? punto.fechaHora.toISOString()}-${punto.fechaLabel}`}
                className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
              >
                <span className="font-bold text-slate-800">{punto.fechaLabel}</span>
                {punto.peso !== undefined ? ` - Peso ${punto.peso} kg` : ''}
                {punto.temperatura !== undefined ? ` - Temp ${punto.temperatura} C` : ''}
                {punto.frecuenciaCardiaca !== undefined ? ` - FC ${punto.frecuenciaCardiaca}` : ''}
                {punto.frecuenciaRespiratoria !== undefined ? ` - FR ${punto.frecuenciaRespiratoria}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

export default EvolucionClinicaPanel;
export { EvolucionClinicaPanel };
