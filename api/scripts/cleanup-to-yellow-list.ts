/* eslint-disable no-console */
/**
 * Script de limpieza total para el proyecto Firebase real (vethosia-5895b).
 * Elimina todas las cuentas de Firebase Auth y documentos de Firestore ajenos a la lista autorizada:
 * - Cuentas en amarillo:
 *   1. nicovet@vethosia.com
 *   2. robertoperrosygatos@vethosia.com
 *   3. vetpyg1@vethosia.com
 *   4. vetpyg2@vethosia.com
 *   5. vetpyg3@vethosia.com
 *   6. vetpyg4@vethosia.com
 *   7. vetpyg5@vethosia.com
 *   8. vetpyg6@vethosia.com
 *   9. admin.entidad@vethosia.com
 *   10. admin.veterinaria@vethosia.com
 *   11. veterinario@vethosia.com
 * - Super Admin:
 *   12. gerencia@vethosia.com
 *
 * Uso:
 *   cd api
 *   npx ts-node scripts/cleanup-to-yellow-list.ts
 */

import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'vethosia-5895b';

const ALLOWED_EMAILS = new Set<string>([
  'gerencia@vethosia.com',
  'nicovet@vethosia.com',
  'robertoperrosygatos@vethosia.com',
  'vetpyg1@vethosia.com',
  'vetpyg2@vethosia.com',
  'vetpyg3@vethosia.com',
  'vetpyg4@vethosia.com',
  'vetpyg5@vethosia.com',
  'vetpyg6@vethosia.com',
  'admin.entidad@vethosia.com',
  'admin.veterinaria@vethosia.com',
  'veterinario@vethosia.com',
]);

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  console.log(`[cleanup] Inicializando Admin SDK para el proyecto: ${PROJECT_ID}`);
  return admin.initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  const app = initAdmin();
  const auth = app.auth();
  const db = app.firestore();

  console.log(`\n==================================================`);
  console.log(` INICIANDO LIMPIEZA DE BASE DE DATOS (${PROJECT_ID})`);
  console.log(`==================================================\n`);

  // 1. Limpiar Firebase Auth (eliminar usuarios fuera de la lista autorizada)
  console.log('[1/3] Revisando cuentas en Firebase Auth...');
  let deletedAuthCount = 0;
  let keptAuthCount = 0;
  const allowedUids = new Set<string>();

  let pageToken: string | undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    for (const user of listResult.users) {
      const email = user.email?.toLowerCase().trim();
      if (email && ALLOWED_EMAILS.has(email)) {
        keptAuthCount += 1;
        allowedUids.add(user.uid);
        console.log(`  ✅ CONSERVADO Auth: ${email} (UID: ${user.uid})`);
      } else {
        await auth.deleteUser(user.uid);
        deletedAuthCount += 1;
        console.log(`  🗑️ ELIMINADO Auth: ${email ?? '(sin email)'} (UID: ${user.uid})`);
      }
    }
    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log(`\n[Auth Summary] Cuentas conservadas: ${keptAuthCount} | Cuentas eliminadas: ${deletedAuthCount}\n`);

  // 2. Limpiar colecciones de Firestore de usuarios/cuentas eliminadas
  console.log('[2/3] Limpiando colecciones de Firestore...');

  const collectionsToClean = [
    { name: 'miembros', emailField: 'email', uidField: 'uid' },
    { name: 'veterinarios', emailField: 'email', uidField: 'uid' },
    { name: 'solicitudes_tecnicas', emailField: 'email', uidField: 'solicitanteUid' },
  ];

  for (const item of collectionsToClean) {
    const snap = await db.collection(item.name).get();
    let deletedCount = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const email = String(data[item.emailField] ?? '').toLowerCase().trim();
      const uid = String(data[item.uidField] ?? '').trim();

      const isAllowedEmail = email && ALLOWED_EMAILS.has(email);
      const isAllowedUid = uid && allowedUids.has(uid);

      if (!isAllowedEmail && !isAllowedUid) {
        await doc.ref.delete();
        deletedCount += 1;
      }
    }
    console.log(`  🧹 Colección '${item.name}': ${deletedCount} documentos obsoletos eliminados.`);
  }

  // 3. Actualizar la whitelist de emails de acceso en Firestore configuracion/acceso
  console.log('\n[3/3] Actualizando whitelist de acceso en configuracion/acceso...');
  const allowedListArray = Array.from(ALLOWED_EMAILS);
  await db
    .collection('configuracion')
    .doc('acceso')
    .set({ emailsPermitidos: allowedListArray }, { merge: true });

  console.log(`  ✅ Whitelist actualizada con ${allowedListArray.length} correos autorizados.`);

  console.log(`\n==================================================`);
  console.log(` LIMPIEZA COMPLETADA CON ÉXITO DE FORMA SEGURA`);
  console.log(`==================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[cleanup] ERROR CRÍTICO:', err);
    process.exit(1);
  });
