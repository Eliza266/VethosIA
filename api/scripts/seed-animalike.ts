/* eslint-disable no-console */
// Alta de la Clinica Veterinaria Animalike: veterinaria INDEPENDIENTE (sin entidad),
// con su dueno (admin_veterinaria) y 2 veterinarios de planta.
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/seed-animalike.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const NOMBRE_VETERINARIA = 'Clínica Veterinaria Animalike';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-animalike] proyecto: ${projectId}`);
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
    console.log(`[seed-animalike] ${coll}/${value} ya existe (${q.docs[0].id})`);
    return q.docs[0].id;
  }
  const ref = db.collection(coll).doc();
  await ref.set({ ...payload, [field]: value });
  console.log(`[seed-animalike] ${coll}/${value} creado (${ref.id})`);
  return ref.id;
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  // Veterinaria independiente: sin entidadId/orgId, paga su propio plan (planOwnerType: 'veterinaria').
  const vetId = await findOrCreate(db, 'veterinarias', 'nombre', NOMBRE_VETERINARIA, {
    pais: 'Colombia',
    planOwnerType: 'veterinaria',
    accountType: 'veterinaria',
    estado: 'activa',
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });
  // accountId y planOwnerId de una veterinaria independiente apuntan a si misma.
  await db.collection('veterinarias').doc(vetId).set(
    { accountId: vetId, planOwnerId: vetId },
    { merge: true },
  );

  const users = [
    {
      email: 'andres.rosero@vethosia.com',
      displayName: 'Andrés Rosero',
      password: 'Animalike#Rosero25',
      legacyRol: 'admin',
      claims: { v: 2, role: 'admin_veterinaria', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'owner' },
      member: { rol: 'admin', role: 'admin_veterinaria', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'owner' },
      vetProfile: false,
    },
    {
      email: 'sebastian.rojas@vethosia.com',
      displayName: 'Sebastián Rojas',
      password: 'Animalike#Rojas71',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
    {
      email: 'carlos.barco@vethosia.com',
      displayName: 'Carlos Barco',
      password: 'Animalike#Barco39',
      legacyRol: 'vet',
      claims: { v: 2, role: 'veterinario', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'staff' },
      member: { rol: 'vet', role: 'veterinario', accountType: 'veterinaria', accountId: vetId, veterinariaId: vetId, planOwnerType: 'veterinaria', planOwnerId: vetId, vinculoTipo: 'staff' },
      vetProfile: true,
    },
  ];

  for (const u of users) {
    let rec: admin.auth.UserRecord;
    try {
      rec = await auth.getUserByEmail(u.email);
      await auth.updateUser(rec.uid, { password: u.password, emailVerified: true, displayName: u.displayName });
      console.log(`[seed-animalike] ${u.email} actualizado`);
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found') {
        rec = await auth.createUser({ email: u.email, password: u.password, emailVerified: true, displayName: u.displayName });
        console.log(`[seed-animalike] ${u.email} creado`);
      } else {
        throw e;
      }
    }
    const membershipId = `m_${rec.uid}_${u.claims.role}`;
    await auth.setCustomUserClaims(rec.uid, { ...u.claims, orgId: null, rol: u.legacyRol, membershipId });
    await db.collection('miembros').doc(membershipId).set(
      { uid: rec.uid, email: u.email, estado: 'activo', membershipId, ...u.member, creadoEn: ts, actualizadoEn: ts },
      { merge: true },
    );
    if (u.vetProfile) {
      await db.collection('veterinarios').doc(rec.uid).set(
        { uid: rec.uid, nombre: u.displayName, email: u.email, veterinaria: NOMBRE_VETERINARIA, creadoEn: ts, actualizadoEn: ts },
        { merge: true },
      );
    }
  }

  // Whitelist de acceso: el login server-side valida configuracion/acceso.emailsPermitidos.
  const emails = users.map((u) => u.email.toLowerCase());
  await db
    .collection('configuracion')
    .doc('acceso')
    .set(
      { emailsPermitidos: admin.firestore.FieldValue.arrayUnion(...emails) },
      { merge: true },
    );
  console.log(`[seed-animalike] whitelist actualizada (+${emails.length} correos)`);

  console.log('\n=== CLÍNICA VETERINARIA ANIMALIKE LISTA ===');
  console.log(`Veterinaria (independiente, sin entidad): ${vetId}`);
  for (const u of users) {
    console.log(`${u.displayName} <${u.email}> — ${u.claims.role} — contraseña: ${u.password}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-animalike] ERROR:', err);
    process.exit(1);
  });
