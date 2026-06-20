import type * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { LIMITE_TRIAL_DEFECTO, SuscripcionDoc } from './plan.types';

type SuscripcionCollection = admin.firestore.CollectionReference;

export function suscripcionScopeQuery(
  col: SuscripcionCollection,
  user: AuthUser,
): admin.firestore.Query {
  if (user.planOwnerId && user.planOwnerType) {
    return col.where('planOwnerId', '==', user.planOwnerId);
  }
  return user.orgId
    ? col.where('orgId', '==', user.orgId)
    : col.where('veterinarioId', '==', user.uid);
}

export async function obtenerSuscripcionDeUsuario(
  firebase: FirebaseService,
  user: AuthUser,
): Promise<SuscripcionDoc | null> {
  const snap = await suscripcionScopeQuery(
    firebase.firestore.collection(COLLECTIONS.suscripciones),
    user,
  ).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<SuscripcionDoc, 'id'>) };
}

export async function resolverLimiteHistoriasMes(
  firebase: FirebaseService,
  user: AuthUser,
): Promise<number> {
  const sub = await obtenerSuscripcionDeUsuario(firebase, user);
  return sub?.limiteHistoriasMes ?? LIMITE_TRIAL_DEFECTO;
}

export async function resolverLimiteHistoriasGlobal(
  firebase: FirebaseService,
): Promise<number> {
  const snap = await firebase.firestore.collection(COLLECTIONS.suscripciones).get();
  return snap.docs.reduce((acc, doc) => {
    const value = doc.data()?.limiteHistoriasMes;
    return acc + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);
}
