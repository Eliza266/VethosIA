import { apiClient } from '../../lib/apiClient';
import { getFeatureFlags } from '../../lib/featureFlags';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/mappers';
import { AppError } from '../../lib/errors';
import type { Brigada, BrigadaAtencion, BrigadaConsolidado } from '../../types';

const mapBrigada = (id: string, data: Record<string, unknown>): Brigada =>
  ({ id, ...data, creadoEn: toDate(data.creadoEn) }) as Brigada;

const mapBrigadaApi = (data: Brigada): Brigada =>
  ({ ...data, creadoEn: data.creadoEn ? toDate(data.creadoEn) : new Date() }) as Brigada;

const mapAtencionApi = (data: BrigadaAtencion): BrigadaAtencion =>
  ({ ...data, creadoEn: data.creadoEn ? toDate(data.creadoEn) : undefined }) as BrigadaAtencion;

export const listarBrigadas = async (uid: string): Promise<Brigada[]> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.get<Brigada[]>('/v1/brigadas');
    const list = (res.data ?? []).map((b) => mapBrigadaApi(b));
    list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return list;
  }
  const q = query(collection(db, 'brigadas'), where('veterinarioIds', 'array-contains', uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => mapBrigada(d.id, d.data()));
  list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  return list;
};

export const obtenerBrigada = async (id: string, uid: string): Promise<Brigada | null> => {
  if (getFeatureFlags().useApiCRUD) {
    try {
      const res = await apiClient.get<Brigada>(`/v1/brigadas/${id}`);
      return mapBrigadaApi(res.data);
    } catch {
      return null;
    }
  }
  const snap = await getDoc(doc(db, 'brigadas', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const vIds: string[] = data.veterinarioIds || [];
  if (!vIds.includes(uid)) {
    throw new AppError('No tienes permiso para ver esta brigada.', 'brigadas/forbidden');
  }
  return mapBrigada(snap.id, data);
};

export const crearBrigada = async (
  uid: string,
  nuevaBrigada: Omit<Brigada, 'creadoEn'>,
): Promise<Brigada> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.post<Brigada>('/v1/brigadas', {
      ...nuevaBrigada,
      veterinarioIds: nuevaBrigada.veterinarioIds ?? [],
    });
    return mapBrigadaApi(res.data);
  }
  const vIds = [...(nuevaBrigada.veterinarioIds || [])];
  if (!vIds.includes(uid)) vIds.push(uid);
  const brigadaDoc: Omit<Brigada, 'id'> = {
    ...nuevaBrigada,
    veterinarioIds: vIds,
    creadoEn: new Date(),
  };
  const ref = await addDoc(collection(db, 'brigadas'), brigadaDoc);
  return { id: ref.id, ...brigadaDoc };
};

export const actualizarBrigadaDoc = async (
  id: string,
  campos: Partial<Brigada>,
): Promise<void> => {
  if (getFeatureFlags().useApiCRUD) {
    const { id: _id, creadoEn: _c, ...payload } = campos;
    await apiClient.patch(`/v1/brigadas/${id}`, payload);
    return;
  }
  await updateDoc(doc(db, 'brigadas', id), campos);
};

export interface RegistrarAtencionBrigadaInput {
  pacienteId?: string;
  consultaId?: string;
  veterinarioId?: string;
  motivo: string;
  notas?: string;
  especie?: string;
  fechaHora?: string;
}

export const listarAtencionesBrigada = async (brigadaId: string): Promise<BrigadaAtencion[]> => {
  const res = await apiClient.get<BrigadaAtencion[]>(`/v1/brigadas/${brigadaId}/atenciones`);
  return (res.data ?? []).map((a) => mapAtencionApi(a));
};

export const registrarAtencionBrigada = async (
  brigadaId: string,
  input: RegistrarAtencionBrigadaInput,
): Promise<BrigadaAtencion> => {
  const res = await apiClient.post<BrigadaAtencion>(`/v1/brigadas/${brigadaId}/atenciones`, input);
  return mapAtencionApi(res.data);
};

export const obtenerConsolidadoBrigada = async (brigadaId: string): Promise<BrigadaConsolidado> => {
  const res = await apiClient.get<BrigadaConsolidado>(`/v1/brigadas/${brigadaId}/consolidado`);
  return res.data;
};
