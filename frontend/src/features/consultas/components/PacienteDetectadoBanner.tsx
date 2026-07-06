import React from 'react';
import { Sparkles, UserCheck, UserPlus } from 'lucide-react';
import type { DatosDetectadosConsulta, Paciente } from '../../../types';

interface Props {
  datosDetectados: DatosDetectadosConsulta;
  pacienteCoincidente: Paciente | null;
  isVinculando: boolean;
  isConfirmando: boolean;
  onVincular: () => void;
  onConfirmarNuevo: () => void;
}

// Consulta rapida (Opcion B): la IA detecto datos de paciente/propietario en el audio de una
// consulta que empezo sin paciente preseleccionado. Si el nombre coincide con un paciente ya
// registrado, ofrecemos vincular en vez de dejar un paciente placeholder duplicado.
const PacienteDetectadoBanner: React.FC<Props> = ({
  datosDetectados,
  pacienteCoincidente,
  isVinculando,
  isConfirmando,
  onVincular,
  onConfirmarNuevo,
}) => {
  const { nombrePaciente, especie, raza, nombrePropietario, telefonoPropietario } = datosDetectados;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <Sparkles className="h-5 w-5 shrink-0 text-accent mt-0.5" />
      <div className="flex-1 text-xs text-slate-700 space-y-2.5">
        <p>
          <span className="font-bold">La IA detectó estos datos en el audio:</span>{' '}
          {nombrePaciente && <>Mascota <b>{nombrePaciente}</b>{especie ? ` (${especie}${raza ? `, ${raza}` : ''})` : ''}. </>}
          {nombrePropietario && <>Dueño <b>{nombrePropietario}</b>{telefonoPropietario ? `, tel. ${telefonoPropietario}` : ''}. </>}
        </p>

        {pacienteCoincidente ? (
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
                disabled={isConfirmando}
                onClick={onConfirmarNuevo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Es una mascota nueva
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p>No encontramos una mascota registrada con ese nombre. ¿Guardamos estos datos en la ficha?</p>
            <button
              type="button"
              disabled={isConfirmando}
              onClick={onConfirmarNuevo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {isConfirmando ? 'Guardando...' : 'Guardar datos del paciente'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PacienteDetectadoBanner;
