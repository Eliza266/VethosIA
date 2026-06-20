import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toDateOrNull } from './mappers';
import type { Miembro, Organizacion } from '../types';

// Helper de contexto multi-tenant DEJADO LISTO pero NO cableado a la UI todavia.
// La idea: organizaciones/{orgId} + miembros/{uid} -> {orgId, rol}. Cuando se
// active multi-tenant, las queries filtraran por orgId. Hoy un vet individual no
// tiene miembro y todo sigue funcionando por veterinarioId como siempre.

export interface OrgContext {
  orgId: string | null;
  rol: Miembro['rol'] | null;
  organizacion: Organizacion | null;
}

const SIN_ORG: OrgContext = { orgId: null, rol: null, organizacion: null };

/**
 * Resuelve la org del usuario a partir de miembros/{uid}. Si no hay doc de miembro
 * devolvemos contexto vacio (modo single-tenant legacy), sin romper nada.
 */
export const resolveOrgContext = async (uid: string): Promise<OrgContext> => {
  try {
    const miembroSnap = await getDoc(doc(db, 'miembros', uid));
    if (!miembroSnap.exists()) return SIN_ORG;

    const miembro = miembroSnap.data() as Miembro;
    if (!miembro.orgId) return SIN_ORG;

    let organizacion: Organizacion | null = null;
    const orgSnap = await getDoc(doc(db, 'organizaciones', miembro.orgId));
    if (orgSnap.exists()) {
      const data = orgSnap.data();
      organizacion = {
        id: orgSnap.id,
        nombre: data.nombre,
        ciudad: data.ciudad,
        sede: data.sede,
        logo: data.logo,
        creadoEn: toDateOrNull(data.creadoEn) ?? new Date(),
      };
    }

    return { orgId: miembro.orgId, rol: miembro.rol ?? null, organizacion };
  } catch {
    // multi-tenant es best-effort por ahora; si falla, seguimos en modo legacy.
    return SIN_ORG;
  }
};
