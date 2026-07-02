/* eslint-disable no-console */
// Seed productivo: veterinaria independiente "EmiVt" (dueña de su propio plan).
//   - Lina Hernandez: dueña/admin de la veterinaria (admin_veterinaria, owner).
//   - Andres Bermudez: veterinario operativo (veterinario, staff) vinculado a la sede.
// Contraseña genérica inicial; cada uno la cambia luego desde su perfil.
//
// Correr (contra prod, usa ADC; el usuario debe estar autenticado con gcloud/firebase):
//   cd api ; $env:GCLOUD_PROJECT="vethosia-5895b" ; npx ts-node scripts/seed-emivt.ts
//
// Idempotente: si la veterinaria/usuarios ya existen, los actualiza sin duplicar.
import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'vethosia-5895b';
const PASSWORD = process.env.EMIVT_PASSWORD ?? 'Vethos2026!';
const DOMINIO = '@vethosia.com';
const NOMBRE_VETERINARIA = 'EmiVt';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  console.log(`[seed-emivt] proyecto: ${PROJECT_ID}`);
  return admin.initializeApp({ projectId: PROJECT_ID });
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
    console.log(`[seed-emivt] ${coll}/${value} ya existe (${q.docs[0].id})`);
    return q.docs[0].id;
  }
  const ref = db.collection(coll).doc();
  await ref.set({ ...payload, [field]: value });
  console.log(`[seed-emivt] ${coll}/${value} creado (${ref.id})`);
  return ref.id;
}

interface UsuarioSeed {
  email: string;
  displayName: string;
  legacyRol: 'admin' | 'vet';
  role: 'admin_veterinaria' | 'veterinario';
  vinculoTipo: 'owner' | 'staff';
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  // 1) Plan propio de la veterinaria (sin costos, límites generosos).
  const planId = await findOrCreate(db, 'planes', 'nombre', 'EmiVt Pro', {
    descripcion: 'Plan propio de la veterinaria EmiVt.',
    precioMensualCOP: 0,
    precioAnualCOP: 0,
    tipo: 'individual',
    asientosMax: 15,
    limiteHistoriasMes: 1000,
    historiasGratisTrial: 50,
    activo: true,
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });

  // 2) Veterinaria independiente (dueña de su plan). planOwnerId/accountId apuntan a sí misma.
  const vetId = await findOrCreate(db, 'veterinarias', 'nombre', NOMBRE_VETERINARIA, {
    ciudad: 'Bogota',
    pais: 'Colombia',
    emailContacto: `LinaVet${DOMINIO}`,
    entidadId: null,
    planOwnerType: 'veterinaria',
    accountType: 'veterinaria',
    estado: 'activa',
    createdAt: ts,
    updatedAt: ts,
    creadoEn: ts,
    actualizadoEn: ts,
  });
  await db.collection('veterinarias').doc(vetId).set(
    {
      orgId: vetId,
      legacyOrgId: vetId,
      planOwnerId: vetId,
      accountId: vetId,
      planId,
    },
    { merge: true },
  );

  // 3) Suscripción activa de la veterinaria (habilita IA y asientos).
  const subQ = await db.collection('suscripciones').where('planOwnerId', '==', vetId).limit(1).get();
  if (subQ.empty) {
    const subRef = db.collection('suscripciones').doc();
    await subRef.set({
      veterinariaId: vetId,
      orgId: vetId,
      planOwnerType: 'veterinaria',
      planOwnerId: vetId,
      planId,
      estado: 'activa',
      asientosMax: 15,
      limiteHistoriasMes: 1000,
      creadoEn: ts,
    });
    console.log(`[seed-emivt] suscripcion creada (${subRef.id})`);
  } else {
    await db.collection('suscripciones').doc(subQ.docs[0].id).set(
      { estado: 'activa', asientosMax: 15, limiteHistoriasMes: 1000, planId },
      { merge: true },
    );
    console.log(`[seed-emivt] suscripcion ya existe (${subQ.docs[0].id}), actualizada`);
  }

  // 4) Usuarios: Lina (dueña/admin) + Andres (veterinario staff).
  const usuarios: UsuarioSeed[] = [
    {
      email: `LinaVet${DOMINIO}`.toLowerCase(),
      displayName: 'Lina Hernandez (EmiVt)',
      legacyRol: 'admin',
      role: 'admin_veterinaria',
      vinculoTipo: 'owner',
    },
    {
      email: `AndresVet${DOMINIO}`.toLowerCase(),
      displayName: 'Andres Bermudez (EmiVt)',
      legacyRol: 'vet',
      role: 'veterinario',
      vinculoTipo: 'staff',
    },
  ];

  for (const u of usuarios) {
    let rec: admin.auth.UserRecord;
    try {
      rec = await auth.getUserByEmail(u.email);
      await auth.updateUser(rec.uid, { password: PASSWORD, emailVerified: true, displayName: u.displayName });
      console.log(`[seed-emivt] ${u.email} actualizado`);
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found') {
        rec = await auth.createUser({
          email: u.email,
          password: PASSWORD,
          emailVerified: true,
          displayName: u.displayName,
        });
        console.log(`[seed-emivt] ${u.email} creado`);
      } else {
        throw e;
      }
    }

    const membershipId = `m_${rec.uid}_${u.role}`;
    const claims = {
      v: 2,
      role: u.role,
      accountType: 'veterinaria',
      accountId: vetId,
      veterinariaId: vetId,
      planOwnerType: 'veterinaria',
      planOwnerId: vetId,
      vinculoTipo: u.vinculoTipo,
      orgId: vetId,
      rol: u.legacyRol,
      membershipId,
    };
    // merge con claims previos para no pisar otros que pudieran existir.
    const prev = rec.customClaims ?? {};
    await auth.setCustomUserClaims(rec.uid, { ...prev, ...claims });

    await db.collection('miembros').doc(membershipId).set(
      {
        uid: rec.uid,
        email: u.email,
        orgId: vetId,
        rol: u.legacyRol,
        role: u.role,
        accountType: 'veterinaria',
        accountId: vetId,
        veterinariaId: vetId,
        planOwnerType: 'veterinaria',
        planOwnerId: vetId,
        vinculoTipo: u.vinculoTipo,
        membershipId,
        estado: 'activo',
        creadoEn: ts,
        actualizadoEn: ts,
      },
      { merge: true },
    );

    await db.collection('veterinarios').doc(rec.uid).set(
      {
        uid: rec.uid,
        nombre: u.displayName,
        email: u.email,
        veterinaria: NOMBRE_VETERINARIA,
        creadoEn: ts,
        actualizadoEn: ts,
      },
      { merge: true },
    );
  }

  // 5) Whitelist de acceso: el login server-side valida configuracion/acceso.emailsPermitidos.
  //    Sin esto, /v1/me responde 403 aunque el usuario tenga claims y membresía.
  const emails = usuarios.map((u) => u.email);
  await db
    .collection('configuracion')
    .doc('acceso')
    .set(
      { emailsPermitidos: admin.firestore.FieldValue.arrayUnion(...emails) },
      { merge: true },
    );
  console.log(`[seed-emivt] whitelist actualizada (+${emails.length} correos)`);

  console.log('\n=== SEED EMIVT LISTO ===');
  console.log(`Plan: ${planId} | Veterinaria: ${vetId}`);
  console.log(`Contraseña (ambos): ${PASSWORD}`);
  console.log(`Dueña/admin: LinaVet${DOMINIO}`);
  console.log(`Veterinario: AndresVet${DOMINIO}`);
  console.log('Cada usuario puede cambiar su contraseña desde Perfil → Cambiar Contraseña.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-emivt] ERROR:', err);
    process.exit(1);
  });
