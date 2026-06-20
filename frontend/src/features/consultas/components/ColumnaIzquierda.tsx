import React from 'react';
import { Stethoscope, FileAudio, FileText } from 'lucide-react';
import type { Consulta } from '../../../types';
import { PRIORIDAD_COLORS, PRIORIDAD_LABELS, type EditDataConsulta } from '../types';
import PanelSignosVitales from './PanelSignosVitales';

interface Props {
  consulta: Consulta;
  editData: EditDataConsulta;
  onChangeEditData: (data: EditDataConsulta) => void;
}

const panelClass = 'premium-card space-y-3 p-5';
const panelTitleClass =
  'flex items-center justify-between border-b border-[var(--border)] pb-2.5 text-sm font-bold text-[var(--text)]';

const ColumnaIzquierda: React.FC<Props> = ({ consulta, editData, onChangeEditData }) => (
  <div className="space-y-5 lg:col-span-1">
    <div className={panelClass}>
      <h3 className={panelTitleClass}>
        <span className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-[var(--accent)]" />
          Motivo de Consulta
        </span>
      </h3>
      {consulta.estado === 'borrador' ? (
        <textarea
          value={editData.motivo}
          onChange={(e) => onChangeEditData({ ...editData, motivo: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
          placeholder="Motivo principal..."
        />
      ) : (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          {consulta.motivo || 'No reportado'}
        </p>
      )}
    </div>

    {consulta.estado === 'borrador' && (
      <div className={panelClass}>
        <h3 className={panelTitleClass}>Prioridad clínica</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRIORIDAD_LABELS).map((pKey) => (
            <button
              key={pKey}
              type="button"
              onClick={() =>
                onChangeEditData({ ...editData, prioridad: pKey as EditDataConsulta['prioridad'] })
              }
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                editData.prioridad === pKey
                  ? PRIORIDAD_COLORS[pKey] + ' ring-1 ring-current'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]'
              }`}
            >
              {PRIORIDAD_LABELS[pKey]}
            </button>
          ))}
        </div>
      </div>
    )}

    <PanelSignosVitales
      consulta={consulta}
      signosVitales={editData.signosVitales}
      onChange={(signosVitales) => onChangeEditData({ ...editData, signosVitales })}
    />

    {consulta.audioUrl && (
      <div className={panelClass}>
        <h3 className={panelTitleClass}>
          <span className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-[var(--accent)]" />
            Grabación de Audio
          </span>
        </h3>
        <audio src={consulta.audioUrl} controls className="h-10 w-full focus:outline-none" />
      </div>
    )}

    <div className={panelClass}>
      <h3 className={panelTitleClass}>
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--accent)]" />
          Transcripción Original
        </span>
      </h3>
      <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        {consulta.transcripcion ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--text-secondary)]">
            {consulta.transcripcion}
          </p>
        ) : (
          <p className="text-xs italic text-[var(--muted)]">No hay transcripción disponible para esta consulta.</p>
        )}
      </div>
    </div>
  </div>
);

export default ColumnaIzquierda;
