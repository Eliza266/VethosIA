import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { getErrorMessage } from '../lib/errors';
import { AlertCircle } from 'lucide-react';

// Consulta rapida (Opcion B): el vet presiona "grabar" sin elegir mascota primero. Creamos
// un paciente placeholder (esPlaceholder: true) solo para satisfacer el flujo existente de
// NuevaConsulta.tsx (que requiere un pacienteId), y navegamos ahi de inmediato. Cuando la IA
// detecte los datos reales en el audio, DetalleConsulta.tsx ofrece confirmarlos o vincular la
// consulta a un paciente ya existente (ver PacienteDetectadoBanner).
const NuevaConsultaRapida: React.FC = () => {
  const navigate = useNavigate();
  const { agregarPaciente } = usePacientes();
  const [error, setError] = useState<string | null>(null);
  const yaCreado = useRef(false);

  useEffect(() => {
    if (yaCreado.current) return;
    yaCreado.current = true;

    const crearPlaceholderYContinuar = async () => {
      const pacienteId = await agregarPaciente({
        nombre: 'Paciente por confirmar',
        especie: 'otro',
        sexo: 'macho',
        estadoReproductivo: 'entero',
        esPlaceholder: true,
        propietario: { nombre: 'Por confirmar', telefono: '' },
      });
      if (!pacienteId) {
        setError('No se pudo iniciar la consulta rápida. Intenta de nuevo.');
        return;
      }
      navigate(`/pacientes/${pacienteId}/consultas/nueva`, { replace: true });
    };

    crearPlaceholderYContinuar().catch((err) => {
      console.error(err);
      setError(getErrorMessage(err, 'No se pudo iniciar la consulta rápida.'));
    });
  }, [agregarPaciente, navigate]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">No se pudo iniciar</h3>
        <p className="text-sm text-slate-500 mb-6">{error}</p>
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Preparando consulta rápida...</p>
      </div>
    </div>
  );
};

export default NuevaConsultaRapida;
export { NuevaConsultaRapida };
