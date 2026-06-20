import React from 'react';
import { Sparkles, Pill, AlertTriangle, FilePlus } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';
import type { Consulta, MedicamentoSugerido } from '../../../types';

interface Props {
  consulta: Consulta;
  onAddMedToPlan: (med: MedicamentoSugerido) => void;
}

const PanelMedicamentos: React.FC<Props> = ({ consulta, onAddMedToPlan }) => {
  const meds = consulta.soap?.medicamentosSugeridos;
  const visible =
    meds && meds.length > 0 && (consulta.estado === 'borrador' || consulta.estado === 'aprobada');
  if (!visible) return null;

  return (
    <div className="premium-card space-y-5 p-6">
      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Plan terapeutico</p>
          <h3 className="text-sm font-black text-[var(--text)]">Medicamentos sugeridos por IA</h3>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warn)_25%,var(--border))] bg-[var(--warn-soft)] p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" />
        <span className="text-xs font-medium leading-relaxed text-[var(--warn)]">
          Sugerencias de IA. Validar antes de prescribir y agregar al plan terapéutico.
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Medicamento</th>
              <th className="px-4 py-3">Dosis</th>
              <th className="px-4 py-3">Vía</th>
              <th className="px-4 py-3">Frecuencia</th>
              <th className="px-4 py-3">Duración</th>
              {consulta.estado === 'borrador' && <th className="px-4 py-3 text-center">Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {meds.map((med, index) => (
              <tr key={index} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Pill className="h-3 w-3 text-[var(--accent)]" />
                    <span className="font-bold text-[var(--text)]">{med.nombre}</span>
                  </div>
                  <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[var(--muted)]" title={med.indicacion}>
                    {med.indicacion}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[var(--text-secondary)]">{med.dosis}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{med.via}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{med.frecuencia}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{med.duracion}</td>
                {consulta.estado === 'borrador' && (
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onAddMedToPlan(med)}
                      title="Agregar al Plan"
                      aria-label={`Agregar ${med.nombre} al plan`}
                    >
                      <FilePlus className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PanelMedicamentos;
