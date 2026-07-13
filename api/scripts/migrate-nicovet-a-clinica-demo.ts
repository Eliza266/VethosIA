/* eslint-disable no-console */
// Mueve nicovet@vethosia.com de la clinica "XimenaVet" a "Entidad Demo / Clinica Demo".
// No borra nada existente: solo actualiza claims/membresia y desactiva (no elimina) la
// membresia vieja en XimenaVet. Si nicovet ya tenia pacientes/consultas en XimenaVet,
// esos registros quedan intactos ahi (huerfanos pero inofensivos) y se listan al final.
//
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/migrate-nicovet-a-clinica-demo.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const PASSWORD = 'Vethos2026!';
const NICOVET_EMAIL = 'nicovet@vethosia.com';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[migrate-nicovet] proyecto: ${projectId}`);
  return admin.initializeApp({ projectId });
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  const userRecord = await auth.getUserByEmail(NICOVET_EMAIL);
  const uid = userRecord.uid;
  console.log(`[migrate-nicovet] usuario encontrado: ${NICOVET_EMAIL} (uid=${uid})`);

  // 1) Ubicar Entidad Demo / Clinica Demo (destino).
  const entQuery = await db.collection('entidades').where('nombre', '==', 'Entidad Demo').limit(1).get();
  if (entQuery.empty) throw new Error('No existe "Entidad Demo". Corre primero seed:test-roles.');
  const entId = entQuery.docs[0].id;

  const vetQuery = await db
    .collection('veterinarias')
    .where('nombre', '==', 'Clínica Demo')
    .where('entidadId', '==', entId)
    .limit(1)
    .get();
  if (vetQuery.empty) throw new Error('No existe "Clínica Demo". Corre primero seed:test-roles.');
  const vetId = vetQuery.docs[0].id;
  console.log(`[migrate-nicovet] destino -> Entidad Demo (${entId}) / Clínica Demo (${vetId})`);

  // 2) Detectar membresias viejas de este uid (para desactivarlas, no borrarlas) y
  //    avisar si tiene pacientes/consultas propios en su clinica vieja.
  const miembrosViejos = await db.collection('miembros').where('uid', '==', uid).get();
  for (const doc of miembrosViejos.docs) {
    const data = doc.data();
    if (data.veterinariaId && data.veterinariaId !== vetId) {
      console.log(`[migrate-nicovet] desactivando membresia vieja: ${doc.id} (veterinariaId=${data.veterinariaId})`);
      await doc.ref.set({ estado: 'inactivo', actualizadoEn: ts }, { merge: true });
    }
  }

  const pacientesViejos = await db.collection('pacientes').where('veterinarioId', '==', uid).get();
  const consultasViejas = await db.collection('consultas').where('veterinarioId', '==', uid).get();
  const pacientesEnOtraClinica = pacientesViejos.docs.filter((d) => d.data().veterinariaId !== vetId);
  const consultasEnOtraClinica = consultasViejas.docs.filter((d) => d.data().veterinariaId !== vetId);
  if (pacientesEnOtraClinica.length || consultasEnOtraClinica.length) {
    console.log(
      `[migrate-nicovet] AVISO: nicovet tenia ${pacientesEnOtraClinica.length} paciente(s) y ${consultasEnOtraClinica.length} consulta(s) fuera de Clínica Demo (quedan intactos, no se tocan ni se borran).`,
    );
  } else {
    console.log('[migrate-nicovet] nicovet no tenia pacientes/consultas previos en otra clinica. Nada que preservar.');
  }

  // 3) Nuevos claims + membresia en Clinica Demo (mismo shape que seed-test-roles.ts).
  const membershipId = `m_${uid}_veterinario`;
  const claims = {
    v: 2,
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: vetId,
    entidadId: entId,
    veterinariaId: vetId,
    planOwnerType: 'entidad',
    planOwnerId: entId,
    vinculoTipo: 'staff',
    orgId: entId,
    rol: 'vet',
    membershipId,
  };
  await auth.setCustomUserClaims(uid, claims);
  await auth.updateUser(uid, { password: PASSWORD, emailVerified: true, displayName: 'Nico (vet de prueba)' });

  await db.collection('miembros').doc(membershipId).set(
    {
      uid,
      email: NICOVET_EMAIL.toLowerCase(),
      orgId: entId,
      estado: 'activo',
      membershipId,
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: vetId,
      entidadId: entId,
      veterinariaId: vetId,
      planOwnerType: 'entidad',
      planOwnerId: entId,
      vinculoTipo: 'staff',
      actualizadoEn: ts,
      creadoEn: ts,
    },
    { merge: true },
  );

  await db.collection('veterinarios').doc(uid).set(
    { uid, nombre: 'Nico (vet de prueba)', email: NICOVET_EMAIL.toLowerCase(), veterinaria: 'Clínica Demo', actualizadoEn: ts, creadoEn: ts },
    { merge: true },
  );

  // 4) Whitelist (por si no estaba).
  await db
    .collection('configuracion')
    .doc('acceso')
    .set({ emailsPermitidos: admin.firestore.FieldValue.arrayUnion(NICOVET_EMAIL.toLowerCase()) }, { merge: true });

  console.log('\n=== MIGRACION DE NICOVET LISTA ===');
  console.log(`${NICOVET_EMAIL} ahora pertenece a Entidad Demo (${entId}) / Clínica Demo (${vetId})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate-nicovet] ERROR:', err);
    process.exit(1);
  });
