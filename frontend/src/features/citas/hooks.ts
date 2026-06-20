import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarCitas,
  crearCita,
  cambiarEstadoCita,
  vincularPacienteCita,
  type EstadoCita,
} from './api';

export function useCitas() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['citas'], queryFn: listarCitas });
  const crear = useMutation({
    mutationFn: crearCita,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['citas'] }),
  });
  const cambiarEstado = useMutation({
    mutationFn: (v: { id: string; estado: EstadoCita }) => cambiarEstadoCita(v.id, v.estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['citas'] }),
  });
  const vincularPaciente = useMutation({
    mutationFn: (v: { id: string; pacienteId: string }) => vincularPacienteCita(v.id, v.pacienteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['citas'] }),
  });
  return { ...query, crear, cambiarEstado, vincularPaciente };
}
