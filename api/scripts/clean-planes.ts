/* eslint-disable no-console */
import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'vethosia-5895b';

const ALLOWED_PLANS = new Set<string>([
  'veterinario individual',
  'clínica start',
  'clinica start',
  'clínica pro',
  'clinica pro',
  'clínica enterprise',
  'clinica enterprise',
]);

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();

  console.log(`=== REVISANDO Y LIMPIANDO PLANES EN FIRESTORE (${PROJECT_ID}) ===\n`);

  const snap = await db.collection('planes').get();
  let deleted = 0;
  let kept = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const nombre = String(data.nombre ?? '').toLowerCase().trim();
    if (ALLOWED_PLANS.has(nombre)) {
      kept += 1;
      console.log(`  ✅ PLAN CONSERVADO: "${data.nombre}" (ID: ${doc.id})`);
    } else {
      await doc.ref.delete();
      deleted += 1;
      console.log(`  🗑️ PLAN OBSOLETO ELIMINADO: "${data.nombre}" (ID: ${doc.id})`);
    }
  }

  console.log(`\nResumen: ${kept} conservados | ${deleted} eliminados.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
