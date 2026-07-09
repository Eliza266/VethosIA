import React, { useState } from 'react';
import { Sparkles, UserCheck, UserPlus } from 'lucide-react';
import type { DatosDetectadosConsulta, Paciente } from '../../../types';
import { mapEspecieDetectada } from '../../pacientes/matching';

export interface DatosPacienteNuevo {
  nombre: string;
  especie: Paciente['especie'];
  raza: string;
  nombrePropietario: string;
  telefonoPropietario: string;
}

interface Props {
  datosDetectados: DatosDetectadosConsulta;
  pacienteCoincidente: Paciente | null;
  isVinculando: boolean;
  isConfirmando: boolean;
  onVincular: () => void;
  onConfirmarNuevo: (datos: DatosPacienteNuevo) => void;
}

const ESPECIES: { value: Paciente['especie']; label: string }[] = [
  { value: 'perro', label: 'Perro' },
  { value: 'gato', label: 'Gato' },
  { value: 'ave', label: 'Ave' },
  { value: 'reptil', label: 'Reptil' },
  { value: 'otro', label: 'Otro' },
];

const inputClass =
  'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';
const labelClass = 'flex flex-col gap-1';
const labelTextClass = 'text-[10px] font-bold uppercase tracking-wide text-slate-500';

// Consulta rapida (Opcion B): la IA detecto datos de paciente/propietario en el audio de una
// consulta que empezo sin paciente preseleccionado. Si el nombre coincide con un paciente ya
// registrado, ofrecemos vincular en vez de dejar un paciente placeholder duplicado. Si es
// mascota nueva, el veterinario revisa/corrige los datos detectados antes de guardarlos —
// la IA puede transcribir mal un nombre o un numero, asi que no se guardan a ciegas.
const PacienteDetectadoBanner: React.FC<Props> = ({
  datosDetectados,
  pacienteCoincidente,
  isVinculando,
  isConfirmando,
  onVincular,
  onConfirmarNuevo,
}) => {
  const { nombrePaciente, especie, raza, nombrePropietario, telefonoPropietario } = datosDetectados;
  const [mostrarForm, setMostrarForm] = useState(!pacienteCoincidente);
  const [datos, setDatos] = useState<DatosPacienteNuevo>({
    nombre: nombrePaciente ?? '',
    especie: mapEspecieDetectada(especie),
    raza: raza ?? '',
    nombrePropietario: nombrePropietario ?? '',
    telefonoPropietario: telefonoPropietario ?? '',
  });

  const actualizarCampo = <K extends keyof DatosPacienteNuevo>(campo: K, valor: DatosPacienteNuevo[K]) => {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <Sparkles className="h-5 w-5 shrink-0 text-accent mt-0.5" />
      <div className="flex-1 text-xs text-slate-700 space-y-2.5">
        <p>
          <span className="font-bold">La IA detectó estos datos en el audio:</span>{' '}
          {nombrePaciente && <>Mascota <b>{nombrePaciente}</b>{especie ? ` (${especie}${raza ? `, ${raza}` : ''})` : ''}. </>}
          {nombrePropietario && <>Dueño <b>{nombrePropietario}</b>{telefonoPropietario ? `, tel. ${telefonoPropietario}` : ''}. </>}
        </p>

        {pacienteCoincidente && !mostrarForm && (
          <div className="space-y-2">
            <p>
              Ya existe un paciente llamado <b>{pacienteCoincidente.nombre}</b> (dueño:{' '}
              {pacienteCoincidente.propietario.nombre || 'sin dato'}). ¿Es la misma mascota?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isVinculando}
                onClick={onVincular}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {isVinculando ? 'Vinculando...' : `Sí, es ${pacienteCoincidente.nombre}`}
              </button>
              <button
                type="button"
                onClick={() => setMostrarForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-accent hover:text-accent"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Es una mascota nueva
              </button>
            </div>
          </div>
        )}

        {mostrarForm && (
          <div className="space-y-2.5">
            <p>Revisa y corrige si hace falta antes de guardar en la ficha (la IA puede transcribir mal un nombre o un número):</p>
            <div className="grid grid-cols-2 gap-2.5">
              <label className={labelClass}>
                <span className={labelTextClass}>Nombre de la mascota</span>
                <input
                  type="text"
                  value={datos.nombre}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Especie</span>
                <select
                  value={datos.especie}
                  onChange={(e) => actualizarCampo('especie', e.target.value as Paciente['especie'])}
                  className={inputClass}
                >
                  {ESPECIES.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Raza</span>
                <input
                  type="text"
                  value={datos.raza}
                  onChange={(e) => actualizarCampo('raza', e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Nombre del dueño</span>
                <input
                  type="text"
                  value={datos.nombrePropietario}
                  onChange={(e) => actualizarCampo('nombrePropietario', e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={`${labelClass} col-span-2`}>
                <span className={labelTextClass}>Teléfono del dueño</span>
                <input
                  type="tel"
                  value={datos.telefonoPropietario}
                  onChange={(e) => actualizarCampo('telefonoPropietario', e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isConfirmando || !datos.nombre.trim()}
                onClick={() => onConfirmarNuevo(datos)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {isConfirmando ? 'Guardando...' : 'Guardar datos del paciente'}
              </button>
              {pacienteCoincidente && (
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="text-xs font-bold text-slate-500 transition hover:text-slate-700"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PacienteDetectadoBanner;
