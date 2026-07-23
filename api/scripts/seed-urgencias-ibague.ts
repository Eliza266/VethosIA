/* eslint-disable no-console */
// Alta de Urgencias Veterinarias Ibague: veterinaria INDEPENDIENTE (sin entidad),
// con su admin_veterinaria (dueno/a de la cuenta).
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/seed-urgencias-ibague.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const NOMBRE_VETERINARIA = 'Urgencias Veterinarias Ibagué';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-urgencias-ibague] proyecto: ${projectId}`);
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
    console.log(`[seed-urgencias-ibague] ${coll}/${value} ya existe (${q.docs[0].id})`);
    return q.docs[0].id;
  }
  const ref = db.collection(coll).doc();
  await ref.set({ ...payload, [field]: value });
  console.log(`[seed-urgencias-ibague] ${coll}/${value} creado (${ref.id})`);
  return ref.id;
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  // Veterinaria independiente: sin entidadId/orgId, paga su propio plan (planOwnerType: 'veterinaria').
  const vetId = await findOrCreate(db, 'veterinarias', 'nombre', NOMBRE_VETERINARIA, {
    ciudad: 'Ibagué',
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

  const admin_ = {
    email: 'hadercelis@vethosia.com',
    displayName: 'Hadercelis',
    password: 'Hader123*',
    legacyRol: 'admin',
    claims: {
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: vetId,
      veterinariaId: vetId,
      planOwnerType: 'veterinaria',
      planOwnerId: vetId,
      vinculoTipo: 'owner',
    },
    member: {
      rol: 'admin',
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: vetId,
      veterinariaId: vetId,
      planOwnerType: 'veterinaria',
      planOwnerId: vetId,
      vinculoTipo: 'owner',
    },
  };

  let rec: admin.auth.UserRecord;
  try {
    rec = await auth.getUserByEmail(admin_.email);
    await auth.updateUser(rec.uid, {
      password: admin_.password,
      emailVerified: true,
      displayName: admin_.displayName,
    });
    console.log(`[seed-urgencias-ibague] ${admin_.email} actualizado`);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/user-not-found') {
      rec = await auth.createUser({
        email: admin_.email,
        password: admin_.password,
        emailVerified: true,
        displayName: admin_.displayName,
      });
      console.log(`[seed-urgencias-ibague] ${admin_.email} creado`);
    } else {
      throw e;
    }
  }

  const membershipId = `m_${rec.uid}_${admin_.claims.role}`;
  await auth.setCustomUserClaims(rec.uid, {
    ...admin_.claims,
    orgId: null,
    rol: admin_.legacyRol,
    membershipId,
  });
  await db.collection('miembros').doc(membershipId).set(
    {
      uid: rec.uid,
      email: admin_.email,
      estado: 'activo',
      membershipId,
      ...admin_.member,
      creadoEn: ts,
      actualizadoEn: ts,
    },
    { merge: true },
  );

  // Whitelist de acceso: el login server-side valida configuracion/acceso.emailsPermitidos.
  await db
    .collection('configuracion')
    .doc('acceso')
    .set(
      { emailsPermitidos: admin.firestore.FieldValue.arrayUnion(admin_.email.toLowerCase()) },
      { merge: true },
    );
  console.log('[seed-urgencias-ibague] whitelist actualizada (+1 correo)');

  console.log('\n=== URGENCIAS VETERINARIAS IBAGUÉ LISTA ===');
  console.log(`Veterinaria (independiente, sin entidad): ${vetId}`);
  console.log(`${admin_.displayName} <${admin_.email}> — admin_veterinaria — contraseña: ${admin_.password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-urgencias-ibague] ERROR:', err);
    process.exit(1);
  });
