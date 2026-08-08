/* eslint-disable no-console */
/**
 * Script de limpieza para eliminar veterinarias, entidades y suscripciones obsoletas en Firestore.
 * Mantiene UNICAMENTE los datos asociados a las 12 cuentas autorizadas en amarillo + superadmin.
 *
 * Uso:
 *   cd api
 *   npx ts-node scripts/purge-obsolete-sedes-and-subs.ts
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
  console.log(`[purge] Inicializando Admin SDK para el proyecto: ${PROJECT_ID}`);
  return admin.initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();

  console.log(`\n==================================================`);
  console.log(` INICIANDO PURGA DE SEDES, ENTIDADES Y SUSCRIPCIONES OBSOLETAS`);
  console.log(`==================================================\n`);

  // Obtener IDs de entidades y veterinarias validas asociadas a miembros de la lista autorizada
  const miembrosSnap = await db.collection('miembros').get();
  const validMemberEmails = new Set<string>();
  const validVetIds = new Set<string>();
  const validEntidadIds = new Set<string>();
  const validPlanOwnerIds = new Set<string>();

  miembrosSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const email = String(data.email ?? '').toLowerCase().trim();
    if (ALLOWED_EMAILS.has(email)) {
      validMemberEmails.add(email);
      if (data.veterinariaId) validVetIds.add(String(data.veterinariaId));
      if (data.accountId) validVetIds.add(String(data.accountId));
      if (data.entidadId) validEntidadIds.add(String(data.entidadId));
      if (data.planOwnerId) validPlanOwnerIds.add(String(data.planOwnerId));
      if (data.orgId) {
        validEntidadIds.add(String(data.orgId));
        validVetIds.add(String(data.orgId));
      }
    }
  });

  // 1. Depurar veterinarias
  console.log('[1/3] Depurando colección veterinarias...');
  const vetsSnap = await db.collection('veterinarias').get();
  let deletedVets = 0;
  for (const doc of vetsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const email = String(data.emailContacto ?? data.email ?? '').toLowerCase().trim();
    const isAllowedEmail = email && ALLOWED_EMAILS.has(email);
    const isAllowedId = validVetIds.has(doc.id) || validPlanOwnerIds.has(doc.id);

    if (!isAllowedEmail && !isAllowedId) {
      await doc.ref.delete();
      deletedVets += 1;
      console.log(`  🗑️ Veterinaria eliminada: "${data.nombre}" (${doc.id})`);
    } else {
      validVetIds.add(doc.id);
      if (data.planOwnerId) validPlanOwnerIds.add(String(data.planOwnerId));
      console.log(`  ✅ Veterinaria conservada: "${data.nombre}" (${doc.id})`);
    }
  }
  console.log(`-> ${deletedVets} veterinarias obsoletas eliminadas.\n`);

  // 2. Depurar entidades
  console.log('[2/3] Depurando colección entidades...');
  const entsSnap = await db.collection('entidades').get();
  let deletedEnts = 0;
  for (const doc of entsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const email = String(data.emailContacto ?? data.email ?? '').toLowerCase().trim();
    const isAllowedEmail = email && ALLOWED_EMAILS.has(email);
    const isAllowedId = validEntidadIds.has(doc.id) || validPlanOwnerIds.has(doc.id);

    if (!isAllowedEmail && !isAllowedId) {
      await doc.ref.delete();
      deletedEnts += 1;
      console.log(`  🗑️ Entidad eliminada: "${data.nombre}" (${doc.id})`);
    } else {
      validEntidadIds.add(doc.id);
      if (data.planOwnerId) validPlanOwnerIds.add(String(data.planOwnerId));
      console.log(`  ✅ Entidad conservada: "${data.nombre}" (${doc.id})`);
    }
  }
  console.log(`-> ${deletedEnts} entidades obsoletas eliminadas.\n`);

  // 3. Depurar suscripciones
  console.log('[3/3] Depurando colección suscripciones...');
  const subsSnap = await db.collection('suscripciones').get();
  let deletedSubs = 0;
  for (const doc of subsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const planOwnerId = String(data.planOwnerId ?? data.veterinariaId ?? data.orgId ?? '');
    const isAllowedOwner =
      validPlanOwnerIds.has(planOwnerId) ||
      validVetIds.has(planOwnerId) ||
      validEntidadIds.has(planOwnerId);

    if (!isAllowedOwner) {
      await doc.ref.delete();
      deletedSubs += 1;
      console.log(`  🗑️ Suscripción obsoleta eliminada: ID=${doc.id} (Owner: ${planOwnerId})`);
    } else {
      console.log(`  ✅ Suscripción conservada: ID=${doc.id} (Owner: ${planOwnerId})`);
    }
  }
  console.log(`-> ${deletedSubs} suscripciones obsoletas eliminadas.\n`);

  console.log(`==================================================`);
  console.log(` PURGA Y LIMPIEZA FINALIZADA CON ÉXITO`);
  console.log(`==================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[purge] ERROR CRÍTICO:', err);
    process.exit(1);
  });
