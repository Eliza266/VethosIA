/* eslint-disable no-console */
// Seed de prueba: EntidadVet -> XimenaVet -> vet1, vet2, con plan Básico.
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/seed-ximenavet.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const PASSWORD = 'Vethos2026!';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-ximenavet] proyecto: ${projectId}`);
  return admin.initializeApp({ projectId });
}

async function findOrCreate(
  db: admin.firestore.Firestore,
  coll: string,
  field: string,
  value: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const q = await db.collection(coll).where(field, '==', value).limit(1).get();
  if (!q.empty) {
    console.log(`[seed-ximenavet] ${coll}/${value} ya existe (${q.docs[0].id})`);
    return q.docs[0].id;
  }
  const ref = db.collection(coll).doc();
  await ref.set({ ...payload, [field]: value });
  console.log(`[seed-ximenavet] ${coll}/${value} creado (${ref.id})`);
  return ref.id;
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  // 1) Plan Básico (limita por cantidades, sin costos).
  const planId = await findOrCreate(db, 'planes', 'nombre', 'Básico', {
    descripcion: 'Plan básico de prueba (sin costos). Límites por cantidad.',
    precioMensualCOP: 0,
    precioAnualCOP: 0,
    tipo: 'entidad',
    asientosMax: 4, // 2 veterinarias x 2 vets
    limiteHistoriasMes: 100,
    historiasGratisTrial: 10,
    activo: true,
    // Límites por cantidad (documentados; aún no enforced por código):
    maxVeterinarias: 2,
    maxVetsPorVeterinaria: 2,
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });

  // 2) Entidad EntidadVet (dueña del plan).
  const entId = await findOrCreate(db, 'entidades', 'nombre', 'EntidadVet', {
    tipo: 'entidad',
    estado: 'activa',
    planId,
    planOwnerType: 'entidad',
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });
  // planOwnerId/planOwnerType apuntan a sí misma:
  await db.collection('entidades').doc(entId).set({ planOwnerId: entId }, { merge: true });

  // 3) Veterinaria XimenaVet, bajo EntidadVet.
  const vetId = await findOrCreate(db, 'veterinarias', 'nombre', 'XimenaVet', {
    direccion: 'Calle Demo 123',
    ciudad: 'Bogota',
    pais: 'Colombia',
    emailContacto: 'ximenavet@vethosia.com',
    orgId: entId,
    legacyOrgId: entId,
    entidadId: entId,
    planOwnerType: 'entidad',
    planOwnerId: entId,
    accountType: 'veterinaria',
    estado: 'activa',
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });
  await db.collection('veterinarias').doc(vetId).set({ accountId: vetId }, { merge: true });

  // 4) Usuarios.
  const users = [
    {
      email: 'admin.entidadvet@vethosia.com',
      displayName: 'Admin EntidadVet',
      legacyRol: 'admin',
      claims: { v: 2, role: 'admin_entidad', accountType: 'entidad', accountId: entId, entidadId: entId, planOwnerType: 'entidad', planOwnerId: entId },
      member: { rol: 'admin', role: 'admin_entidad', accountType: 'entidad', accountId: entId, entidadId: entId, planOwnerType: 'entidad', planOwnerId: entId },
      vetProfile: false,
    },
    {
      email: 'admin.ximenavet@vethosia.com',
      displayName: 'Admin XimenaVet',
      legacyRol: 'admin',
      claims: { v: 2, role: 'admin_veterinaria', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'admin', role: 'admin_veterinaria', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: false,
    },
    {
      email: 'vet1@vethosia.com',
      displayName: 'Veterinario 1 (XimenaVet)',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
    {
      email: 'vet2@vethosia.com',
      displayName: 'Veterinario 2 (XimenaVet)',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
    {
      email: 'robertoVet@vethosia.com',
      displayName: 'Roberto (vet de prueba)',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
    {
      email: 'nicoVet@vethosia.com',
      displayName: 'Nico (vet de prueba)',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
    {
      email: 'ximenavet@vethosia.com',
      displayName: 'XimenaVet (vet)',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, entidadId: entId, veterinariaId: vetId, planOwnerType: 'entidad', planOwnerId: entId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
  ];

  for (const u of users) {
    let rec: admin.auth.UserRecord;
    try {
      rec = await auth.getUserByEmail(u.email);
      await auth.updateUser(rec.uid, { password: PASSWORD, emailVerified: true, displayName: u.displayName });
      console.log(`[seed-ximenavet] ${u.email} actualizado`);
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found') {
        rec = await auth.createUser({ email: u.email, password: PASSWORD, emailVerified: true, displayName: u.displayName });
        console.log(`[seed-ximenavet] ${u.email} creado`);
      } else {
        throw e;
      }
    }
    const membershipId = `m_${rec.uid}_${u.claims.role}`;
    await auth.setCustomUserClaims(rec.uid, { ...u.claims, orgId: entId, rol: u.legacyRol, membershipId });
    await db.collection('miembros').doc(membershipId).set(
      { uid: rec.uid, email: u.email, orgId: entId, estado: 'activo', membershipId, ...u.member, creadoEn: ts, actualizadoEn: ts },
      { merge: true },
    );
    if (u.vetProfile) {
      await db.collection('veterinarios').doc(rec.uid).set(
        { uid: rec.uid, nombre: u.displayName, email: u.email, veterinaria: 'XimenaVet', creadoEn: ts, actualizadoEn: ts },
        { merge: true },
      );
    }
  }

  console.log('\n=== SEED ENTIDADVET / XIMENAVET LISTO ===');
  console.log(`Plan Básico: ${planId} | EntidadVet: ${entId} | XimenaVet: ${vetId}`);
  console.log(`Contraseña (todos): ${PASSWORD}`);
  console.log('Usuarios: admin.entidadvet@, admin.ximenavet@, vet1@, vet2@ (todos @vethosia.com)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-ximenavet] ERROR:', err);
    process.exit(1);
  });
