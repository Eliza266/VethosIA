import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/hooks';
import { getErrorMessage } from '../../lib/errors';
import {
  listarBrigadas,
  obtenerBrigada,
  crearBrigada,
  actualizarBrigadaDoc,
} from './api';
import type { Brigada } from '../../types';

const ordenarPorFecha = (list: Brigada[]): Brigada[] =>
  [...list].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

export const useBrigadas = () => {
  const { user } = useAuth();
  const [brigadas, setBrigadas] = useState<Brigada[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listar = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const list = await listarBrigadas(user.uid);
      setBrigadas(list);
      return list;
    } catch (err) {
      console.error('Error listing brigadas:', err);
      setError('Error al cargar la lista de brigadas.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (user) void listar();
      else setBrigadas([]);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [user, listar]);

  const getBrigada = async (id: string): Promise<Brigada | null> => {
    setError(null);
    try {
      return await obtenerBrigada(id, user?.uid || '');
    } catch (err) {
      console.error('Error fetching single brigada:', err);
      setError(getErrorMessage(err, 'Error al cargar los datos de la brigada.'));
      return null;
    }
  };

  const crear = async (nuevaBrigada: Omit<Brigada, 'creadoEn'>): Promise<string | null> => {
    if (!user) {
      setError('Debes iniciar sesión para crear brigadas.');
      return null;
    }
    setError(null);
    try {
      const creada = await crearBrigada(user.uid, nuevaBrigada);
      // insertamos local y reordenamos por fecha, en vez de refetch total
      setBrigadas((prev) => ordenarPorFecha([creada, ...prev]));
      return creada.id ?? null;
    } catch (err) {
      console.error('Error adding brigada:', err);
      setError('Error al agregar la brigada.');
      return null;
    }
  };

  const actualizar = async (
    id: string,
    camposActualizados: Partial<Brigada>
  ): Promise<boolean> => {
    setError(null);
    try {
      await actualizarBrigadaDoc(id, camposActualizados);
      setBrigadas((prev) =>
        ordenarPorFecha(prev.map((b) => (b.id === id ? { ...b, ...camposActualizados } : b)))
      );
      return true;
    } catch (err) {
      console.error('Error updating brigada:', err);
      setError('Error al actualizar los datos de la brigada.');
      return false;
    }
  };

  return {
    brigadas,
    loading,
    error,
    listarBrigadas: listar,
    getBrigada,
    crearBrigada: crear,
    actualizarBrigada: actualizar,
  };
};
