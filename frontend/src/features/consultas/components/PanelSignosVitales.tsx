import React from 'react';
import { Activity } from 'lucide-react';
import type { Consulta, SignosVitales } from '../../../types';
import { CAMPOS_SIGNOS_VITALES } from '../types';

// Panel de signos vitales: form editable en borrador, tabla de solo lectura si no.
interface Props {
  consulta: Consulta;
  signosVitales: SignosVitales;
  onChange: (signosVitales: SignosVitales) => void;
}

const Fila: React.FC<{ label: string; valor: string; alt?: boolean }> = ({ label, valor, alt }) => (
  <tr className={alt ? 'bg-slate-50/50' : ''}>
    <th className="px-3 py-2 text-slate-500 font-medium w-1/2">{label}</th>
    <td className="px-3 py-2 font-bold text-slate-700">{valor}</td>
  </tr>
);

const PanelSignosVitales: React.FC<Props> = ({ consulta, signosVitales, onChange }) => {
  const sv = consulta.signosVitales;
  const hayVitales = sv && Object.values(sv).some((v) => v);
  if (consulta.estado !== 'borrador' && !hayVitales) return null;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
        <Activity className="h-4 w-4 text-accent" />
        Signos Vitales
      </h3>

      {consulta.estado === 'borrador' ? (
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS_SIGNOS_VITALES.map(({ field, label, step }) => (
            <div key={field}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
              <input
                type="number"
                step={step}
                value={(signosVitales[field] as number | undefined) ?? ''}
                onChange={(e) =>
                  onChange({
                    ...signosVitales,
                    [field]: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="w-full px-2.5 py-1.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:border-accent outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-slate-100">
              {sv?.peso != null && <Fila label="Peso" valor={`${sv.peso} kg`} alt />}
              {sv?.talla != null && <Fila label="Talla" valor={`${sv.talla} cm`} />}
              {sv?.temperatura != null && <Fila label="Temperatura" valor={`${sv.temperatura} °C`} alt />}
              {sv?.frecuenciaCardiaca != null && (
                <Fila label="F. Cardíaca" valor={`${sv.frecuenciaCardiaca} lpm`} />
              )}
              {sv?.frecuenciaRespiratoria != null && (
                <Fila label="F. Respiratoria" valor={`${sv.frecuenciaRespiratoria} rpm`} alt />
              )}
              {sv?.condicionCorporal != null && (
                <Fila label="Cond. Corporal" valor={`${sv.condicionCorporal}/5`} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PanelSignosVitales;
