import type { MeProfile } from '../../src/features/tenant/api';
import { E2E_EMAIL } from './auth';

const base: Omit<MeProfile, 'rol' | 'uid'> & { uid: string } = {
  uid: 'placeholder',
  email: E2E_EMAIL,
  orgId: 'org-e2e-local',
  nombre: 'Usuario E2E',
  foto: null,
  telefono: null,
  whatsapp: null,
  ciudad: null,
  sede: null,
  veterinaria: null,
  matriculaProfesional: null,
  organizacionNombre: 'Clínica E2E Local',
};

export const ME_VETERINARIO: MeProfile = { ...base, rol: 'vet' };
export const ME_ASISTENTE_LEGACY: MeProfile = { ...base, rol: 'asistente' };
export const ME_ADMIN_ENTIDAD: MeProfile = { ...base, rol: 'admin_entidad' };
export const ME_ADMIN_VETERINARIA: MeProfile = { ...base, rol: 'admin_veterinaria' };
export const ME_SUPERADMIN: MeProfile = { ...base, rol: 'superadmin', orgId: null };
