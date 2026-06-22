/* eslint-disable no-console */
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-test-roles] Inicializando Admin SDK para el proyecto: ${projectId}`);
  return admin.initializeApp({ projectId });
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();

  console.log('[seed-test-roles] Buscando/Creando Entidad Demo...');
  let entId = '';
  const entQuery = await db.collection('entidades').where('nombre', '==', 'Entidad Demo').limit(1).get();
  
  if (!entQuery.empty) {
    entId = entQuery.docs[0].id;
    console.log(`[seed-test-roles] Entidad Demo existente encontrada con ID: ${entId}`);
  } else {
    const entRef = db.collection('entidades').doc();
    entId = entRef.id;
    const entPayload = {
      nombre: 'Entidad Demo',
      tipo: 'entidad',
      estado: 'activa',
      planOwnerType: 'entidad',
      planOwnerId: entId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };
    await entRef.set(entPayload);
    console.log(`[seed-test-roles] Entidad Demo creada con ID: ${entId}`);
  }

  console.log('[seed-test-roles] Buscando/Creando Clínica Demo...');
  let vetId = '';
  const vetQuery = await db.collection('veterinarias')
    .where('nombre', '==', 'Clínica Demo')
    .where('entidadId', '==', entId)
    .limit(1)
    .get();

  if (!vetQuery.empty) {
    vetId = vetQuery.docs[0].id;
    console.log(`[seed-test-roles] Clínica Demo existente encontrada con ID: ${vetId}`);
  } else {
    const vetRef = db.collection('veterinarias').doc();
    vetId = vetRef.id;
    const vetPayload = {
      nombre: 'Clínica Demo',
      direccion: 'Calle Demo 123',
      ciudad: 'Bogota',
      pais: 'Colombia',
      telefono: '1234567890',
      emailContacto: 'clinica.demo@vethosia.com',
      orgId: entId,
      legacyOrgId: entId,
      entidadId: entId,
      planOwnerType: 'entidad',
      planOwnerId: entId,
      accountType: 'veterinaria',
      accountId: vetId,
      estado: 'activa',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };
    await vetRef.set(vetPayload);
    console.log(`[seed-test-roles] Clínica Demo creada con ID: ${vetId}`);
  }

  // Lista de usuarios a crear / asegurar
  const usersToSeed = [
    {
      email: 'admin.entidad@vethosia.com',
      password: 'Vethos2026!',
      displayName: 'Admin Entidad Demo',
      role: 'admin_entidad',
      legacyRol: 'admin',
      claims: {
        v: 2,
        role: 'admin_entidad',
        accountType: 'entidad',
        accountId: entId,
        entidadId: entId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
      },
      memberDoc: {
        rol: 'admin',
        role: 'admin_entidad',
        accountType: 'entidad',
        accountId: entId,
        entidadId: entId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
      }
    },
    {
      email: 'admin.veterinaria@vethosia.com',
      password: 'Vethos2026!',
      displayName: 'Admin Veterinaria Demo',
      role: 'admin_veterinaria',
      legacyRol: 'admin',
      claims: {
        v: 2,
        role: 'admin_veterinaria',
        accountType: 'veterinaria',
        accountId: vetId,
        entidadId: entId,
        veterinariaId: vetId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
        vinculoTipo: 'staff',
      },
      memberDoc: {
        rol: 'admin',
        role: 'admin_veterinaria',
        accountType: 'veterinaria',
        accountId: vetId,
        entidadId: entId,
        veterinariaId: vetId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
        vinculoTipo: 'staff',
      }
    },
    {
      email: 'veterinario@vethosia.com',
      password: 'Vethos2026!',
      displayName: 'Veterinario Demo',
      role: 'veterinario',
      legacyRol: 'vet',
      claims: {
        v: 2,
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: vetId,
        entidadId: entId,
        veterinariaId: vetId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
        vinculoTipo: 'staff',
      },
      memberDoc: {
        rol: 'vet',
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: vetId,
        entidadId: entId,
        veterinariaId: vetId,
        planOwnerType: 'entidad',
        planOwnerId: entId,
        vinculoTipo: 'staff',
      }
    }
  ];

  for (const item of usersToSeed) {
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await auth.getUserByEmail(item.email);
      console.log(`[seed-test-roles] Usuario ${item.email} ya existe. Actualizando contraseña y claims...`);
      await auth.updateUser(userRecord.uid, {
        password: item.password,
        emailVerified: true,
        displayName: item.displayName,
      });
    } catch (err) {
      const authError = err as { code?: string };
      if (authError.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: item.email,
          password: item.password,
          emailVerified: true,
          displayName: item.displayName,
        });
        console.log(`[seed-test-roles] Usuario ${item.email} creado exitosamente.`);
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;
    const membershipId = `m_${uid}_${item.role}`;

    // Setea custom claims
    const finalClaims = {
      ...item.claims,
      orgId: entId,
      rol: item.legacyRol,
      membershipId,
    };
    await auth.setCustomUserClaims(uid, finalClaims);
    console.log(`[seed-test-roles] Custom claims asignados a ${item.email}`);

    // Crear/actualizar doc en la colección 'miembros'
    const memberPayload = {
      uid,
      email: item.email,
      orgId: entId,
      estado: 'activo',
      membershipId,
      ...item.memberDoc,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('miembros').doc(membershipId).set(memberPayload, { merge: true });
    console.log(`[seed-test-roles] Documento en 'miembros' guardado para ${item.email}`);

    // Si es veterinario, asegurar también perfil en veterinarios/{uid}
    if (item.role === 'veterinario') {
      const vetProfilePayload = {
        uid,
        nombre: item.displayName,
        email: item.email,
        veterinaria: 'Clínica Demo',
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('veterinarios').doc(uid).set(vetProfilePayload, { merge: true });
      console.log(`[seed-test-roles] Perfil en 'veterinarios' asegurado para ${item.email}`);
    }
  }

  console.log('\n==================================================');
  console.log(' SEED COMPLETADO EXITOSAMENTE');
  console.log('--------------------------------------------------');
  console.log('Credenciales de los usuarios creados/actualizados:');
  for (const item of usersToSeed) {
    console.log(`- Email: ${item.email}`);
    console.log(`  Password: ${item.password}`);
    console.log(`  Rol: ${item.role}`);
  }
  console.log('==================================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-test-roles] ERROR CRÍTICO:', err);
    process.exit(1);
  });
