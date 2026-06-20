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
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toDate } from '../../lib/mappers';
import { AppError } from '../../lib/errors';
import { apiClient } from '../../lib/apiClient';
import { getFeatureFlags } from '../../lib/featureFlags';
import { stripUndefinedFields } from '../../lib/firestoreData';
import type { Paciente } from '../../types';

// Acceso a datos de pacientes. Strangler Fig: si el flag useApiCRUD esta encendido,
// usamos los endpoints propios /v1/pacientes (con aislamiento server-side); si no, el
// camino legacy directo a Firestore. La UI no cambia: ambas ramas devuelven Paciente.

const mapPaciente = (id: string, data: Record<string, unknown>): Paciente =>
  ({ id, ...data, creadoEn: toDate(data.creadoEn) }) as Paciente;

export const listarPacientes = async (uid: string): Promise<Paciente[]> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.get<Paciente[]>('/v1/pacientes');
    return res.data ?? [];
  }
  const q = query(
    collection(db, 'pacientes'),
    where('veterinarioId', '==', uid),
    orderBy('creadoEn', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPaciente(d.id, d.data()));
};

export const obtenerPaciente = async (id: string, uid: string): Promise<Paciente | null> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.get<Paciente>(`/v1/pacientes/${id}`);
    return res.data ?? null;
  }
  const snap = await getDoc(doc(db, 'pacientes', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  // check client-side (las reglas server-side son la barrera real)
  if (data.veterinarioId !== uid) {
    throw new AppError('No tienes permiso para ver este paciente.', 'pacientes/forbidden');
  }
  return mapPaciente(snap.id, data);
};

export const crearPaciente = async (
  uid: string,
  nuevoPaciente: Omit<Paciente, 'veterinarioId' | 'creadoEn'>
): Promise<Paciente> => {
  if (getFeatureFlags().useApiCRUD) {
    const res = await apiClient.post<Paciente>('/v1/pacientes', nuevoPaciente);
    return res.data;
  }
  const pacienteDoc: Omit<Paciente, 'id'> = {
    ...nuevoPaciente,
    veterinarioId: uid,
    creadoEn: new Date(),
  };
  const cleanPacienteDoc = stripUndefinedFields(pacienteDoc);
  const ref = await addDoc(collection(db, 'pacientes'), cleanPacienteDoc);
  return { id: ref.id, ...cleanPacienteDoc };
};

export const actualizarPacienteDoc = async (
  id: string,
  campos: Partial<Paciente>
): Promise<void> => {
  if (getFeatureFlags().useApiCRUD) {
    await apiClient.patch(`/v1/pacientes/${id}`, campos);
    return;
  }
  await updateDoc(doc(db, 'pacientes', id), stripUndefinedFields(campos));
};

export const eliminarPaciente = async (id: string): Promise<void> => {
  if (getFeatureFlags().useApiCRUD) {
    await apiClient.delete(`/v1/pacientes/${id}`);
    return;
  }
  // soft delete legacy: marcamos deletedAt en el doc.
  await updateDoc(doc(db, 'pacientes', id), { deletedAt: new Date() } as Partial<Paciente>);
};
