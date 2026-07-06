import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/hooks';
import { getErrorMessage } from '../../lib/errors';
import {
  listarPacientes,
  obtenerPaciente,
  crearPaciente,
  actualizarPacienteDoc,
  vincularConsultaAPaciente,
} from './api';
import type { Paciente } from '../../types';

export const usePacientes = () => {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacientes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setPacientes(await listarPacientes(user.uid));
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Error al cargar la lista de pacientes.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (user) void fetchPacientes();
      else setPacientes([]);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [user, fetchPacientes]);

  const getPaciente = useCallback(async (id: string): Promise<Paciente | null> => {
    setError(null);
    try {
      return await obtenerPaciente(id, user?.uid || '');
    } catch (err) {
      console.error('Error fetching single patient:', err);
      setError(getErrorMessage(err, 'Error al cargar los datos del paciente.'));
      return null;
    }
  }, [user]);

  const agregarPaciente = async (
    nuevoPaciente: Omit<Paciente, 'veterinarioId' | 'creadoEn'>
  ): Promise<string | null> => {
    if (!user) {
      setError('Debes iniciar sesión para agregar pacientes.');
      return null;
    }
    setError(null);
    try {
      const creado = await crearPaciente(user.uid, nuevoPaciente);
      // Antes esto hacia fetchPacientes() = releer TODA la coleccion en cada alta.
      // Con miles de pacientes es carisimo. Ahora insertamos el nuevo al tope del
      // estado local (la query venia ordenada por creadoEn desc, asi que va primero).
      setPacientes((prev) => [creado, ...prev]);
      return creado.id ?? null;
    } catch (err) {
      console.error('Error adding patient:', err);
      setError('Error al agregar el paciente.');
      return null;
    }
  };

  const actualizarPaciente = async (
    id: string,
    camposActualizados: Partial<Paciente>
  ): Promise<boolean> => {
    setError(null);
    try {
      await actualizarPacienteDoc(id, camposActualizados);
      // update optimista: parcheamos solo el item editado en vez de refetch total.
      setPacientes((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...camposActualizados } : p))
      );
      return true;
    } catch (err) {
      console.error('Error updating patient:', err);
      setError('Error al actualizar los datos del paciente.');
      return false;
    }
  };

  // Consulta rapida (Opcion B): vincula la consulta a un paciente ya existente y descarta
  // (soft delete) el placeholder que se creo para arrancar a grabar sin elegir paciente.
  const vincularConsulta = async (pacienteId: string, consultaId: string): Promise<boolean> => {
    setError(null);
    try {
      await vincularConsultaAPaciente(pacienteId, consultaId);
      return true;
    } catch (err) {
      console.error('Error linking consultation to patient:', err);
      setError(getErrorMessage(err, 'Error al vincular la consulta con el paciente.'));
      return false;
    }
  };

  return {
    pacientes,
    loading,
    error,
    fetchPacientes,
    getPaciente,
    agregarPaciente,
    actualizarPaciente,
    vincularConsulta,
  };
};
