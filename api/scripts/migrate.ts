/* eslint-disable no-console */
/**
 * Migracion multi-tenant: idempotente y reversible.
 *
 * Que hace (forward):
 *   1. Crea (o reusa) una organizacion por defecto.
 *   2. Crea miembros desde los veterinarios existentes (uid = id del doc veterinario),
 *      dejando al primero como admin y al resto como vet. Setea custom claims {orgId, rol}.
 *   3. Backfillea orgId en pacientes/consultas/brigadas/citas a partir de veterinarioId
 *      (o de veterinarioIds en brigadas). NO toca docs que ya tengan orgId.
 *
 * Que hace (--revert):
 *   - Quita el campo orgId de los docs que migramos (los marcamos con _migradoPor).
 *   - Borra los miembros creados por esta migracion y limpia los custom claims.
 *   - NO borra la organizacion por defecto por seguridad (pasa --borrar-org para eso).
 *
 * Como correrlo contra el EMULADOR (recomendado para probar):
 *   $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *   $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
 *   $env:GCLOUD_PROJECT="vethosia-production"
 *   npm run seed:emulator         # datos de ejemplo
 *   npm run migrate               # forward
 *   npm run migrate -- --revert   # rollback
 *
 * Contra PROD: setear GOOGLE_APPLICATION_CREDENTIALS y NO setear los *_EMULATOR_HOST.
 * Siempre probar primero en emulador.
 */
import * as admin from 'firebase-admin';

const ORG_DEFECTO_ID = process.env.MIGRATION_ORG_ID ?? 'org-default';
const ORG_DEFECTO_NOMBRE = process.env.MIGRATION_ORG_NOMBRE ?? 'Clinica VetIA (migrada)';
const MARCA = 'migracion-multitenant-v1';
const COLECCIONES_CON_VET = ['pacientes', 'consultas', 'citas'] as const;

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? 'vethosia-production',
  });
}

async function crearOrgDefecto(db: admin.firestore.Firestore): Promise<void> {
  const ref = db.collection('organizaciones').doc(ORG_DEFECTO_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[migrate] org ${ORG_DEFECTO_ID} ya existe, la reuso.`);
    return;
  }
  await ref.set({
    nombre: ORG_DEFECTO_NOMBRE,
    plan: 'free',
    ciudad: null,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    _migradoPor: MARCA,
  });
  console.log(`[migrate] org ${ORG_DEFECTO_ID} creada.`);
}

async function crearMiembros(
  db: admin.firestore.Firestore,
  auth: admin.auth.Auth,
): Promise<void> {
  const vets = await db.collection('veterinarios').get();
  let primero = true;
  for (const vet of vets.docs) {
    const uid = vet.id;
    const rol = primero ? 'admin' : 'vet';
    primero = false;

    const memberRef = db.collection('miembros').doc(uid);
    const existing = await memberRef.get();
    if (existing.exists && typeof existing.data()?.orgId === 'string') {
      console.log(`[migrate] miembro ${uid} ya existe, lo dejo.`);
      continue;
    }
    await memberRef.set({
      orgId: ORG_DEFECTO_ID,
      rol,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      _migradoPor: MARCA,
    });

    // los claims solo aplican si el usuario existe en Auth. En emulador puede no existir;
    // lo intentamos y si falla seguimos (el doc /miembros queda igual).
    try {
      const user = await auth.getUser(uid);
      await auth.setCustomUserClaims(uid, {
        ...(user.customClaims ?? {}),
        orgId: ORG_DEFECTO_ID,
        rol,
      });
    } catch {
      console.warn(`[migrate] no pude setear claims de ${uid} (Â¿no existe en Auth?). Sigo.`);
    }
    console.log(`[migrate] miembro ${uid} -> ${rol}`);
  }
}

async function backfillColeccion(
  db: admin.firestore.Firestore,
  col: string,
  campoVet: 'veterinarioId' | 'veterinarioIds',
): Promise<number> {
  const snap = await db.collection(col).get();
  let batch = db.batch();
  let pendientes = 0;
  let migrados = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.orgId === 'string') continue; // ya tiene org, no tocar (idempotente).
    // por ahora todo va a la org por defecto; cuando haya varias orgs reales esto se
    // mapearia por veterinarioId -> orgId del miembro.
    batch.set(doc.ref, { orgId: ORG_DEFECTO_ID, _migradoPor: MARCA }, { merge: true });
    pendientes++;
    migrados++;
    if (pendientes >= 400) {
      await batch.commit();
      batch = db.batch();
      pendientes = 0;
    }
  }
  if (pendientes > 0) await batch.commit();
  console.log(`[migrate] ${col}: ${migrados} docs backfilleados (campo base: ${campoVet}).`);
  return migrados;
}

async function forward(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  console.log('[migrate] FORWARD iniciando...');
  await crearOrgDefecto(db);
  await crearMiembros(db, auth);
  for (const col of COLECCIONES_CON_VET) {
    await backfillColeccion(db, col, 'veterinarioId');
  }
  await backfillColeccion(db, 'brigadas', 'veterinarioIds');
  console.log('[migrate] FORWARD completo.');
}

async function revert(borrarOrg: boolean): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  console.log('[migrate] REVERT iniciando...');

  for (const col of [...COLECCIONES_CON_VET, 'brigadas']) {
    const snap = await db.collection(col).where('_migradoPor', '==', MARCA).get();
    let batch = db.batch();
    let n = 0;
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        orgId: admin.firestore.FieldValue.delete(),
        _migradoPor: admin.firestore.FieldValue.delete(),
      });
      if (++n >= 400) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
    console.log(`[migrate] ${col}: revertidos ${snap.size} docs.`);
  }

  const miembros = await db.collection('miembros').where('_migradoPor', '==', MARCA).get();
  for (const m of miembros.docs) {
    try {
      const user = await auth.getUser(m.id);
      const claims = { ...(user.customClaims ?? {}) };
      delete claims.orgId;
      delete claims.rol;
      await auth.setCustomUserClaims(m.id, claims);
    } catch {
      /* usuario no existe en Auth, nada que limpiar */
    }
    await m.ref.delete();
  }
  console.log(`[migrate] miembros revertidos: ${miembros.size}.`);

  if (borrarOrg) {
    await db.collection('organizaciones').doc(ORG_DEFECTO_ID).delete();
    console.log(`[migrate] org ${ORG_DEFECTO_ID} borrada.`);
  }
  console.log('[migrate] REVERT completo.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--revert')) {
    await revert(args.includes('--borrar-org'));
  } else {
    await forward();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] ERROR:', err);
    process.exit(1);
  });
