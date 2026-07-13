import React, { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { DiagnosticoEstructurado } from '../../../types';
import {
  DIAGNOSTICO_ESTADOS,
  DIAGNOSTICO_TIPOS,
  crearDiagnosticoManual,
  descripcionDiagnostico,
} from '../diagnosticos';

interface Props {
  value?: DiagnosticoEstructurado[];
  analisisTexto: string;
  editable?: boolean;
  onChange?: (value: DiagnosticoEstructurado[]) => void;
}

const emptyList = (value?: DiagnosticoEstructurado[]): DiagnosticoEstructurado[] =>
  Array.isArray(value) ? value : [];

const pillClass = 'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase';

const DiagnosticoEstructuradoPanel: React.FC<Props> = ({
  value,
  analisisTexto,
  editable = false,
  onChange,
}) => {
  const diagnosticos = emptyList(value);
  // Colapsado por defecto: cada diagnostico es una fila compacta que se despliega al
  // hacer clic, en vez de una tarjeta larga siempre abierta (la lista completa de
  // diagnosticos sugeridos por la IA no debia obligar a hacer scroll para llegar al
  // plan terapeutico).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emit = (next: DiagnosticoEstructurado[]) => onChange?.(next);

  const updateAt = (index: number, patch: Partial<DiagnosticoEstructurado>) => {
    emit(
      diagnosticos.map((item, i) =>
        i === index ? { ...item, ...patch, actualizadoEn: new Date().toISOString() } : item,
      ),
    );
  };

  const add = () => {
    if (diagnosticos.length >= 10) return;
    const nuevo = crearDiagnosticoManual();
    emit([...diagnosticos, nuevo]);
    setExpandedId(nuevo.id);
  };

  const remove = (index: number, id: string) => {
    emit(diagnosticos.filter((_, i) => i !== index));
    setExpandedId((prev) => (prev === id ? null : prev));
  };

  return (
    <section className="premium-card p-4">
      <div className="flex flex-col gap-3 border-b border-emerald-100/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Analisis asistido</p>
          <h3 className="mt-1 text-sm font-black text-slate-900">Diagnostico estructurado</h3>
          <p className="text-xs text-slate-500">
            La IA sugiere; el veterinario confirma o edita antes de aprobar.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={add}
            disabled={diagnosticos.length >= 10}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/20 bg-white px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
        )}
      </div>

      {editable ? (
        <div className="mt-4 space-y-2">
          {diagnosticos.length === 0 && (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-3 text-xs text-slate-500">
              Sin diagnosticos estructurados. Puedes agregar uno manualmente si aplica.
            </div>
          )}

          {diagnosticos.map((diagnostico, index) => {
            const abierto = expandedId === diagnostico.id;
            return (
              <div key={diagnostico.id} className="rounded-2xl border border-white/80 bg-white shadow-sm">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(abierto ? null : diagnostico.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(abierto ? null : diagnostico.id);
                    }
                  }}
                  aria-expanded={abierto}
                  className="flex w-full items-center gap-2 p-3 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                    {diagnostico.nombre || 'Sin nombre'}
                  </span>
                  <span className={`${pillClass} shrink-0 bg-emerald-100 text-accent`}>{diagnostico.tipo}</span>
                  <span className={`${pillClass} shrink-0 bg-slate-100 text-slate-600`}>{diagnostico.estado}</span>
                  <button
                    type="button"
                    aria-label={`Eliminar diagnostico ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(index, diagnostico.id);
                    }}
                    className="shrink-0 rounded-lg border border-red-100 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {abierto && (
                  <div className="border-t border-slate-100 p-3 pt-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Nombre
                        </label>
                        <input
                          aria-label={`Nombre diagnostico ${index + 1}`}
                          value={diagnostico.nombre}
                          onChange={(e) => updateAt(index, { nombre: e.target.value.slice(0, 120) })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                          placeholder="Ej. Gastroenteritis"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                            Tipo
                          </label>
                          <select
                            aria-label={`Tipo diagnostico ${index + 1}`}
                            value={diagnostico.tipo}
                            onChange={(e) =>
                              updateAt(index, { tipo: e.target.value as DiagnosticoEstructurado['tipo'] })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                          >
                            {DIAGNOSTICO_TIPOS.map((tipo) => (
                              <option key={tipo.value} value={tipo.value}>
                                {tipo.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                            Estado
                          </label>
                          <select
                            aria-label={`Estado diagnostico ${index + 1}`}
                            value={diagnostico.estado}
                            onChange={(e) =>
                              updateAt(index, { estado: e.target.value as DiagnosticoEstructurado['estado'] })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                          >
                            {DIAGNOSTICO_ESTADOS.map((estado) => (
                              <option key={estado.value} value={estado.value}>
                                {estado.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <input
                        aria-label={`Sistema diagnostico ${index + 1}`}
                        value={diagnostico.sistema ?? ''}
                        onChange={(e) => updateAt(index, { sistema: e.target.value.slice(0, 80) || undefined })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                        placeholder="Sistema"
                      />
                      <input
                        aria-label={`Codigo diagnostico ${index + 1}`}
                        value={diagnostico.codigo ?? ''}
                        onChange={(e) => updateAt(index, { codigo: e.target.value.slice(0, 64) || undefined })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                        placeholder="Codigo"
                      />
                      <input
                        aria-label={`Especie diagnostico ${index + 1}`}
                        value={diagnostico.especie ?? ''}
                        onChange={(e) => updateAt(index, { especie: e.target.value.slice(0, 80) || undefined })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                        placeholder="Especie"
                      />
                    </div>

                    <textarea
                      aria-label={`Notas diagnostico ${index + 1}`}
                      value={diagnostico.notas ?? ''}
                      onChange={(e) => updateAt(index, { notas: e.target.value.slice(0, 500) || undefined })}
                      rows={2}
                      className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                      placeholder="Notas clinicas breves"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {diagnosticos.length > 0 ? (
            diagnosticos.map((diagnostico) => (
              <div key={diagnostico.id} className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{diagnostico.nombre}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                    {diagnostico.tipo}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                    {diagnostico.estado}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 ring-1 ring-slate-100">
                    {diagnostico.origen}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {diagnostico.sistema && <span>Sistema: {diagnostico.sistema}</span>}
                  {diagnostico.codigo && <span>Codigo: {diagnostico.codigo}</span>}
                  {diagnostico.especie && <span>Especie: {diagnostico.especie}</span>}
                </div>
                {diagnostico.notas && (
                  <p className="mt-2 text-xs leading-5 text-slate-600">{diagnostico.notas}</p>
                )}
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs leading-5 text-slate-600">
              <span className="font-bold text-slate-700">Diagnostico textual:</span>{' '}
              {descripcionDiagnostico(undefined, analisisTexto)}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default DiagnosticoEstructuradoPanel;
export { DiagnosticoEstructuradoPanel };
