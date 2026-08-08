/* eslint-disable no-console */
import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'vethosia-5895b';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();

  console.log(`=== INSPECCIONANDO BASE DE DATOS (${PROJECT_ID}) ===\n`);

  console.log('--- COLECCION veterinarias ---');
  const vets = await db.collection('veterinarias').get();
  vets.docs.forEach((d) => console.log(`ID: ${d.id} | Nombre: ${d.data().nombre} | Email: ${d.data().emailContacto} | Entidad: ${d.data().entidadId}`));

  console.log('\n--- COLECCION entidades ---');
  const ents = await db.collection('entidades').get();
  ents.docs.forEach((d) => console.log(`ID: ${d.id} | Nombre: ${d.data().nombre} | Email: ${d.data().emailContacto}`));

  console.log('\n--- COLECCION suscripciones ---');
  const subs = await db.collection('suscripciones').get();
  subs.docs.forEach((d) => console.log(`ID: ${d.id} | PlanOwnerId: ${d.data().planOwnerId} | Estado: ${d.data().estado} | TrialHasta: ${d.data().trialHasta}`));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
