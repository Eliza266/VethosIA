import React, { useState } from 'react';
import type { SOAP } from '../types';
import { Edit2, Save, X, BookOpen, Activity, FileSearch, Calendar, ChevronDown } from 'lucide-react';

// Un texto largo (parrafo dictado, analisis extenso) no debe hacer crecer la tarjeta sin
// limite: mas alla de este umbral se recorta con line-clamp y se ofrece "Ver mas/menos".
const UMBRAL_TEXTO_LARGO = 220;

interface SoapViewerProps {
  soap?: SOAP;
  onSave?: (updatedSoap: SOAP) => Promise<void>;
}

const toEditableSoap = (soap?: SOAP): SOAP => ({
  ...soap,
  subjetivo: soap?.subjetivo || '',
  objetivo: soap?.objetivo || '',
  analisis: soap?.analisis || '',
  plan: soap?.plan || '',
});

const SoapViewer: React.FC<SoapViewerProps> = ({ soap, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editSoap, setEditSoap] = useState<SOAP>(() => toEditableSoap(soap));
  const [isSaving, setIsSaving] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const visibleSoap = isEditing ? editSoap : toEditableSoap(soap);

  if (!soap && !isEditing) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
        <FileSearch className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">No hay notas SOAP generadas para esta consulta.</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
          Cuando exista una nota clínica, se mostrará aquí en formato Subjetivo, Objetivo, Análisis y Plan.
        </p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditSoap((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editSoap);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving SOAP:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditSoap(toEditableSoap(soap));
    setIsEditing(false);
  };

  const soapSections = [
    {
      key: 'subjetivo' as keyof SOAP,
      title: 'Subjetivo (S)',
      subtitle: 'Motivo de consulta, síntomas y anamnesis',
      icon: <BookOpen className="h-5 w-5 text-teal-600" />,
      bgColor: 'bg-teal-50/50',
      borderColor: 'border-teal-100',
    },
    {
      key: 'objetivo' as keyof SOAP,
      title: 'Objetivo (O)',
      subtitle: 'Examen físico, constantes vitales y peso',
      icon: <Activity className="h-5 w-5 text-indigo-600" />,
      bgColor: 'bg-indigo-50/50',
      borderColor: 'border-indigo-100',
    },
    {
      key: 'analisis' as keyof SOAP,
      title: 'Análisis (A)',
      subtitle: 'Diagnósticos presuntivos y diferenciales',
      icon: <FileSearch className="h-5 w-5 text-amber-600" />,
      bgColor: 'bg-amber-50/50',
      borderColor: 'border-amber-100',
    },
    {
      key: 'plan' as keyof SOAP,
      title: 'Plan (P)',
      subtitle: 'Tratamiento, recetas, pruebas y control',
      icon: <Calendar className="h-5 w-5 text-sky-600" />,
      bgColor: 'bg-sky-50/50',
      borderColor: 'border-sky-100',
    },
  ];

  return (
    <div className="soap-intelligence-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-950 via-[#073f36] to-[#173b73] px-4 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Expediente inteligente</p>
          <h3 className="mt-1 font-black text-white">Nota Medica SOAP</h3>
          <p className="text-xs text-white/70">Estructura clínica editable, compatible con texto existente.</p>
        </div>
        {onSave && (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--accent-strong)] transition-colors hover:brightness-95 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setEditSoap(toEditableSoap(soap));
                  setIsEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar Nota
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {soapSections.map((sec) => {
          const texto = visibleSoap[sec.key] as string;
          const esLargo = texto.length > UMBRAL_TEXTO_LARGO;
          const verMas = expandido[sec.key] ?? false;
          return (
          <div
            key={sec.key}
            className={`flex flex-col rounded-2xl border p-3.5 transition-all shadow-[0_18px_40px_-34px_rgba(7,17,31,0.55)] ${sec.bgColor} ${sec.borderColor}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
                {sec.icon}
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{sec.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium">{sec.subtitle}</p>
              </div>
            </div>

            {isEditing ? (
              <textarea
                name={sec.key}
                value={editSoap[sec.key] as string}
                onChange={handleChange}
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-secondary)] outline-none transition-shadow focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                placeholder={`Detalles para el apartado ${sec.title}...`}
              />
            ) : (
              <div className="mt-2 flex-1 rounded-xl border border-white/80 bg-white/70 p-3">
                <p
                  className={`whitespace-pre-line text-sm leading-relaxed text-slate-600 ${
                    esLargo && !verMas ? 'line-clamp-4' : ''
                  }`}
                >
                  {texto || <span className="italic text-slate-400">Sin registrar</span>}
                </p>
                {esLargo && (
                  <button
                    type="button"
                    onClick={() => setExpandido((prev) => ({ ...prev, [sec.key]: !verMas }))}
                    className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline"
                  >
                    {verMas ? 'Ver menos' : 'Ver más'}
                    <ChevronDown className={`h-3 w-3 transition-transform ${verMas ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default SoapViewer;
export { SoapViewer };
