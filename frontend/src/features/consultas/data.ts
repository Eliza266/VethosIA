import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { apiClient } from '../../lib/apiClient';
import { getFeatureFlags } from '../../lib/featureFlags';
import { toDate } from '../../lib/mappers';
import { AppError } from '../../lib/errors';
import { stripUndefinedFields } from '../../lib/firestoreData';
import type { Consulta } from '../../types';

// Acceso a datos de consultas (Firestore). La parte de IA/HC/docs (con feature flags)
// vive en api.ts; CRUD puro respeta VITE_USE_API_CRUD para multi-tenant (orgId).

const mapConsulta = (id: string, data: Record<string, unknown>): Consulta =>
  ({
    id,
    ...data,
    fechaHora: toDate(data.fechaHora),
    creadoEn: toDate(data.creadoEn),
  }) as Consulta;

export const listarConsultasPorPaciente = async (
  uid: string,
  pacienteId: string
): Promise<Consulta[]> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.get<Consulta[]>(`/v1/consultas?pacienteId=${encodeURIComponent(pacienteId)}`);
    return (res.data ?? []).map((c) => ({
      ...c,
      fechaHora: toDate(c.fechaHora),
      creadoEn: toDate(c.creadoEn),
    }));
  }
  const q = query(
    collection(db, 'consultas'),
    where('pacienteId', '==', pacienteId),
    where('veterinarioId', '==', uid),
    orderBy('fechaHora', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapConsulta(d.id, d.data()));
};

export const listarTodasConsultas = async (uid: string): Promise<Consulta[]> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.get<Consulta[]>('/v1/consultas');
    return (res.data ?? []).map((c) => ({
      ...c,
      fechaHora: toDate(c.fechaHora),
      creadoEn: toDate(c.creadoEn),
    }));
  }
  const q = query(
    collection(db, 'consultas'),
    where('veterinarioId', '==', uid),
    orderBy('fechaHora', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapConsulta(d.id, d.data()));
};

export const obtenerConsulta = async (id: string, uid: string): Promise<Consulta | null> => {
  if (getFeatureFlags().useApiCRUD) {
    try {
      const res = await apiClient.get<Consulta>(`/v1/consultas/${id}`);
      const c = res.data;
      if (!c) return null;
      return {
        ...c,
        fechaHora: toDate(c.fechaHora),
        creadoEn: toDate(c.creadoEn),
      };
    } catch {
      return null;
    }
  }
  const snap = await getDoc(doc(db, 'consultas', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.veterinarioId !== uid) {
    throw new AppError('No tienes permiso para acceder a esta consulta.', 'consultas/forbidden');
  }
  return mapConsulta(snap.id, data);
};

export const crearConsultaDoc = async (
  uid: string,
  pacienteId: string,
  numeroHC?: string,
  citaId?: string,
): Promise<string> => {
  if (getFeatureFlags().useApiCRUD) {
    const body: { pacienteId: string; numeroHC?: string; citaId?: string } = { pacienteId };
    if (numeroHC) body.numeroHC = numeroHC;
    if (citaId) body.citaId = citaId;
    const res = await apiClient.post<Consulta>('/v1/consultas', body);
    return res.data?.id ?? '';
  }
  const nuevaConsulta: Omit<Consulta, 'id'> = {
    pacienteId,
    veterinarioId: uid,
    fechaHora: new Date(),
    estado: 'borrador',
    creadoEn: new Date(),
  };
  if (numeroHC) nuevaConsulta.numeroHC = numeroHC;
  if (citaId) nuevaConsulta.citaId = citaId;
  const ref = await addDoc(collection(db, 'consultas'), nuevaConsulta);
  return ref.id;
};

/**
 * Actualiza una consulta. Si pasa a 'aprobada', propaga peso/talla al paciente
 * (ultimoPeso/ultimaTalla). BUGFIX: antes leia signosVitales.talla/altura pero ni
 * la IA ni el form lo producian, asi que ultimaTalla casi nunca se seteaba. Ahora
 * 'talla' es el campo canonico (lo captura el form) y dejamos 'altura' como fallback
 * para datos viejos.
 */
export const actualizarConsultaDoc = async (
  id: string,
  campos: Partial<Consulta>
): Promise<void> => {
  if (getFeatureFlags().useApiCRUD) {
    const body = stripUndefinedFields(campos as Record<string, unknown>);
    await apiClient.patch(`/v1/consultas/${id}`, body);
    return;
  }
  const docRef = doc(db, 'consultas', id);
  const cleanCampos = stripUndefinedFields(campos as Record<string, unknown>);
  await updateDoc(docRef, cleanCampos);

  if (campos.estado === 'aprobada') {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const consData = snap.data();
    const pacienteId: string | undefined = consData.pacienteId;
    const signosVitales = consData.signosVitales as
      | { peso?: number; talla?: number; altura?: number }
      | undefined;
    if (pacienteId && signosVitales) {
      const updates: Record<string, number> = {};
      if (signosVitales.peso !== undefined && signosVitales.peso !== null) {
        updates.ultimoPeso = Number(signosVitales.peso);
      }
      const talla = signosVitales.talla ?? signosVitales.altura;
      if (talla !== undefined && talla !== null) {
        updates.ultimaTalla = Number(talla);
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'pacientes', pacienteId), updates);
      }
    }
  }
};

/** Aprobación final: API dedicada (consumo + auditoría + peso/talla) o legacy Firestore. */
export const aprobarConsultaDoc = async (id: string): Promise<{ estado: 'aprobada' }> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.post<{ estado: 'aprobada' }>(`/v1/consultas/${id}/aprobar`);
    return { estado: res.data?.estado ?? 'aprobada' };
  }
  await actualizarConsultaDoc(id, { estado: 'aprobada' });
  return { estado: 'aprobada' };
};

export const eliminarConsultaDoc = async (id: string): Promise<void> => {
  if (getFeatureFlags().useApiCRUD) {
    await apiClient.delete(`/v1/consultas/${id}`);
    return;
  }
  await deleteDoc(doc(db, 'consultas', id));
};
