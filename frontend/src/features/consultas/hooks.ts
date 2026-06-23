import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { getFeatureFlags } from '../../lib/featureFlags';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth/hooks';
import {
  listarConsultasPorPaciente,
  listarTodasConsultas,
  obtenerConsulta,
  crearConsultaDoc,
  actualizarConsultaDoc,
  aprobarConsultaDoc,
  eliminarConsultaDoc,
} from './data';
import { generarNumeroHC, transcribirAudio, generarSOAP, procesarConsultaConIA } from './api';
import type { Consulta } from '../../types';

export const useConsultas = () => {
  const { user } = useAuth();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsultasPorPaciente = useCallback(
    async (pacienteId: string) => {
      if (!user) return [];
      setLoading(true);
      setError(null);
      try {
        const list = await listarConsultasPorPaciente(user.uid, pacienteId);
        setConsultas(list);
        return list;
      } catch (err) {
        console.error('Error fetching consultations:', err);
        setError('Error al cargar las consultas.');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const fetchTodasConsultas = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    setError(null);
    try {
      const list = await listarTodasConsultas(user.uid);
      setConsultas(list);
      return list;
    } catch (err) {
      console.error('Error fetching all consultations:', err);
      setError('Error al cargar la lista general de consultas.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getConsulta = async (id: string): Promise<Consulta | null> => {
    setError(null);
    try {
      return await obtenerConsulta(id, user?.uid || '');
    } catch (err) {
      console.error('Error fetching single consultation:', err);
      setError(getErrorMessage(err, 'Error al obtener la consulta.'));
      return null;
    }
  };

  const crearConsulta = async (pacienteId: string, citaId?: string): Promise<string | null> => {
    if (!user) {
      setError('Debes iniciar sesión para crear consultas.');
      return null;
    }
    setError(null);
    try {
      const flags = getFeatureFlags();
      // Legacy: la callable de HC no necesita id de consulta, asi que pedimos el
      // numero ANTES y lo metemos en el addDoc (identico al comportamiento viejo).
      // API: necesitamos el id primero -> creamos y luego pedimos/parcheamos el HC.
      let numeroHC = '';
      if (!flags.useApiHC) {
        numeroHC = await generarNumeroHC('');
      }
      const id = await crearConsultaDoc(user.uid, pacienteId, numeroHC || undefined, citaId);
      if (flags.useApiHC) {
        const hc = await generarNumeroHC(id);
        if (hc) await actualizarConsultaDoc(id, { numeroHC: hc });
      }
      return id;
    } catch (err) {
      console.error('Error creating consultation:', err);
      setError('Error al iniciar la consulta.');
      return null;
    }
  };

  const actualizarConsulta = async (
    id: string,
    campos: Partial<Consulta>
  ): Promise<boolean> => {
    setError(null);
    try {
      await actualizarConsultaDoc(id, campos);
      // update optimista del estado local si la consulta esta cargada
      setConsultas((prev) => prev.map((c) => (c.id === id ? { ...c, ...campos } : c)));
      return true;
    } catch (err) {
      console.error('Error updating consultation:', err);
      setError('Error al guardar la consulta.');
      return false;
    }
  };

  const aprobarConsulta = async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await aprobarConsultaDoc(id);
      setConsultas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: 'aprobada' as const } : c))
      );
      return true;
    } catch (err) {
      console.error('Error approving consultation:', err);
      setError('Error al aprobar la consulta.');
      return false;
    }
  };

  const eliminarConsulta = async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await eliminarConsultaDoc(id);
      setConsultas((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting consultation:', err);
      setError('Error al eliminar la consulta.');
      return false;
    }
  };

  /**
   * Pipeline de audio: sube a Storage, transcribe y estructura SOAP.
   * Secuencia de estados: procesando -> (transcripcion) -> borrador (o error).
   * La transcripcion y el SOAP pasan por la capa api.ts, asi que respetan el flag
   * VITE_USE_API_IA (off = Gemini directo, identico a antes).
   */
  const procesarAudioConsulta = async (
    consultaId: string,
    audioBlobs: Blob[],
    onProgress?: (msg: string, pct: number) => void
  ): Promise<boolean> => {
    if (!user) {
      console.error('[VetIA] Error: usuario no autenticado');
      return false;
    }
    setError(null);

    try {
      onProgress?.('Preparando consulta...', 10);
      await actualizarConsultaDoc(consultaId, { estado: 'procesando' });

      // Subimos el audio a Storage siempre (para el reproductor en el detalle),
      // independientemente del flag de IA.
      onProgress?.('Subiendo audio...', 25);
      const mimeType = audioBlobs[0]?.type || 'audio/webm';
      
      const uploadPromises = audioBlobs.map(async (blob, i) => {
        const path = `audios/${user.uid}/${consultaId}-${i}.webm`;
        const uploadResult = await uploadBytes(ref(storage, path), blob);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        return { path, downloadUrl };
      });
      
      const uploadResults = await Promise.all(uploadPromises);
      const audioPaths = uploadResults.map(r => r.path);
      const audioUrls = uploadResults.map(r => r.downloadUrl);
      const downloadUrl = audioUrls[0] || '';

      await actualizarConsultaDoc(consultaId, { 
        audioUrl: downloadUrl,
      });

      // 1. Determinar si usamos la API asíncrona de IA (Fase 5) o el camino síncrono/legacy
      const flags = getFeatureFlags();
      if (flags.useApiIA) {
        onProgress?.('Iniciando procesamiento asíncrono con IA...', 50);
        try {
          await procesarConsultaConIA(consultaId, audioPaths, mimeType);
          onProgress?.('¡Procesamiento encolado!', 100);
          return true;
        } catch (apiIaErr) {
          console.error('[VetIA] Error encolando en API IA:', apiIaErr);
          await actualizarConsultaDoc(consultaId, {
            estado: 'error',
            transcripcion: 'Error al iniciar el procesamiento en la nube.',
          });
          throw apiIaErr;
        }
      }

      // 2. Camino síncrono/legacy: Transcribir cada bloque
      onProgress?.('Transcribiendo consulta...', 50);
      let transcriptionText = '';
      try {
        const transcriptions = await Promise.all(
          audioBlobs.map((blob, i) => transcribirAudio(blob, audioPaths[i]))
        );
        transcriptionText = transcriptions.filter(t => t.trim().length > 0).join('\n\n');
        await actualizarConsultaDoc(consultaId, { transcripcion: transcriptionText });
      } catch (txErr) {
        console.error('[VetIA] Error transcribiendo:', txErr);
        await actualizarConsultaDoc(consultaId, {
          estado: 'error',
          transcripcion: 'Error durante la transcripción del audio.',
        });
        throw txErr;
      }

      // 3. SOAP síncrono
      onProgress?.('Generando historia clínica con IA...', 75);
      try {
        const resultado = await generarSOAP(transcriptionText);
        await actualizarConsultaDoc(consultaId, {
          soap: {
            subjetivo: resultado.subjetivo,
            objetivo: resultado.objetivo,
            analisis: resultado.analisis,
            plan: resultado.plan,
            medicamentosSugeridos: resultado.medicamentosSugeridos || [],
            // si la IA fallo, esto queda en false y la UI lo marca como "no estructurado"
            generadoPorIA: resultado.generadoPorIA,
          },
          diagnosticoEstructurado: resultado.diagnosticoEstructurado ?? [],
          motivo: resultado.motivo || '',
          prioridad: resultado.prioridad || 'rutina',
          signosVitales: {
            peso: resultado.signosVitales?.peso ?? null,
            talla: resultado.signosVitales?.talla ?? null,
            temperatura: resultado.signosVitales?.temperatura ?? null,
            frecuenciaCardiaca: resultado.signosVitales?.frecuenciaCardiaca ?? null,
            frecuenciaRespiratoria: resultado.signosVitales?.frecuenciaRespiratoria ?? null,
            condicionCorporal: resultado.signosVitales?.condicionCorporal ?? null,
          } as Consulta['signosVitales'],
          estado: 'borrador',
        });
      } catch (soapErr) {
        console.error('[VetIA] Error generando SOAP:', soapErr);
        await actualizarConsultaDoc(consultaId, { estado: 'error' });
        throw soapErr;
      }

      onProgress?.('¡Historia clínica generada!', 100);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Error al procesar el audio e IA.'));
      return false;
    }
  };

  return {
    consultas,
    loading,
    error,
    fetchConsultasPorPaciente,
    fetchTodasConsultas,
    getConsulta,
    crearConsulta,
    actualizarConsulta,
    aprobarConsulta,
    eliminarConsulta,
    procesarAudioConsulta,
  };
};
