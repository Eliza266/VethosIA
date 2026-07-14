import React from 'react';
import { Sparkles, Pill, AlertTriangle, FilePlus } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';
import type { Consulta, MedicamentoSugerido } from '../../../types';

interface Props {
  consulta: Consulta;
  onAddMedToPlan: (med: MedicamentoSugerido) => void;
}

const CAMPOS: { label: string; key: keyof MedicamentoSugerido }[] = [
  { label: 'Dosis', key: 'dosis' },
  { label: 'Vía', key: 'via' },
  { label: 'Frecuencia', key: 'frecuencia' },
  { label: 'Duración', key: 'duracion' },
];

const PanelMedicamentos: React.FC<Props> = ({ consulta, onAddMedToPlan }) => {
  const meds = consulta.soap?.medicamentosSugeridos;
  const visible =
    meds && meds.length > 0 && (consulta.estado === 'borrador' || consulta.estado === 'aprobada');
  if (!visible) return null;

  return (
    <div className="premium-card space-y-3.5 p-4">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Sugerencia de IA</p>
          <h3 className="text-sm font-black text-[var(--text)]">Medicamentos sugeridos</h3>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warn)_25%,var(--border))] bg-[var(--warn-soft)] p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" />
        <span className="text-xs font-medium leading-relaxed text-[var(--warn)]">
          Esto es un borrador de la IA, no el registro oficial. Valida cada medicamento y usa{' '}
          <FilePlus className="inline h-3 w-3 -translate-y-px" aria-hidden /> para agregarlo al Plan (P) — solo lo
          que quede ahí se imprime, envía por correo o WhatsApp.
        </span>
      </div>

      <div className="space-y-2.5">
        {meds.map((med, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[var(--border)] bg-white p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Pill className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="font-black text-[var(--text)]">{med.nombre}</span>
              </div>
              {consulta.estado === 'borrador' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAddMedToPlan(med)}
                  title="Agregar al Plan"
                  aria-label={`Agregar ${med.nombre} al plan`}
                  className="shrink-0"
                >
                  <FilePlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar al Plan</span>
                </Button>
              )}
            </div>

            {med.indicacion && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{med.indicacion}</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {CAMPOS.map(({ label, key }) => (
                <div key={key}>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
                  <p className="mt-0.5 text-xs font-semibold leading-snug text-[var(--text-secondary)]">
                    {med[key] || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PanelMedicamentos;
