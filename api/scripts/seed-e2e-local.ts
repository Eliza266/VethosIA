/* eslint-disable no-console */
/**
 * Seed mÃ­nimo para E2E local: usuario Auth + whitelist vacÃ­a (login permitido).
 * SOLO corre contra emuladores (fail-closed sin FIRESTORE_EMULATOR_HOST).
 *
 * Uso (PowerShell, con emuladores arriba):
 *   cd api
 *   npm run seed:e2e-local
 */
import 'dotenv/config';
import * as admin from 'firebase-admin';

const E2E_EMAIL = process.env.E2E_EMAIL ?? 'vet@vetia.local';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'VetIA-Local-2026!';
const E2E_DISPLAY = process.env.E2E_DISPLAY ?? 'Vet E2E Local';
const E2E_ORG_ID = process.env.E2E_ORG_ID ?? 'org-e2e-local';

function init(): admin.app.App {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Sin FIRESTORE_EMULATOR_HOST: este seed SOLO corre contra el emulador.');
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Sin FIREBASE_AUTH_EMULATOR_HOST: este seed SOLO corre contra el emulador.');
  }
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'vethosia-production' });
}

async function main(): Promise<void> {
  const app = init();
  const auth = app.auth();
  const db = app.firestore();

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUserByEmail(E2E_EMAIL);
    console.log(`[seed:e2e] usuario existente: ${E2E_EMAIL} (${user.uid})`);
  } catch {
    user = await auth.createUser({
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      displayName: E2E_DISPLAY,
      emailVerified: true,
    });
    console.log(`[seed:e2e] usuario creado: ${E2E_EMAIL} (${user.uid})`);
  }

  // Whitelist vacÃ­a = acceso permitido (fail-closed solo si lista con emails y no coincide).
  await db.collection('configuracion').doc('acceso').set(
    { emailsPermitidos: [] },
    { merge: true },
  );
  console.log('[seed:e2e] configuracion/acceso: emailsPermitidos=[] (acceso abierto)');

  await db.collection('veterinarios').doc(user.uid).set(
    {
      uid: user.uid,
      nombre: E2E_DISPLAY,
      email: E2E_EMAIL,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[seed:e2e] veterinarios/${user.uid} listo`);

  await db.collection('organizaciones').doc(E2E_ORG_ID).set(
    {
      nombre: 'ClÃ­nica E2E Local',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await db.collection('miembros').doc(user.uid).set(
    {
      orgId: E2E_ORG_ID,
      rol: 'vet',
      email: E2E_EMAIL,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await auth.setCustomUserClaims(user.uid, { orgId: E2E_ORG_ID, rol: 'vet' });
  console.log(`[seed:e2e] tenant: orgId=${E2E_ORG_ID}, miembros/${user.uid}, claims orgId+rol=vet`);

  console.log('\nCredenciales E2E:');
  console.log(`  email: ${E2E_EMAIL}`);
  console.log(`  password: ${E2E_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed:e2e] ERROR:', err);
    process.exit(1);
  });
