import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function updateSuperadminName() {
  const email = 'gerencia@vethosia.com';
  const newName = 'Elizabeth Perez';

  console.log(`Buscando usuario superadmin (${email})...`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    console.error(`Error al buscar en Auth: ${err}`);
    process.exit(1);
  }

  const uid = userRecord.uid;
  console.log(`SuperAdmin Auth UID: ${uid}`);

  // 1. Actualizar Auth DisplayName
  await auth.updateUser(uid, {
    displayName: newName,
  });
  console.log(`✅ Auth displayName actualizado a: "${newName}"`);

  // 2. Actualizar en colección 'miembros' (documento uid o por email)
  const miembrosSnap = await db.collection('miembros').where('email', '==', email).get();
  for (const doc of miembrosSnap.docs) {
    await doc.ref.update({
      nombre: newName,
      nombreCompleto: newName,
      displayName: newName,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Colección 'miembros' (${doc.id}) actualizada.`);
  }

  // Si existe documento directo en 'miembros' por UID
  const miembroUidDoc = await db.collection('miembros').doc(uid).get();
  if (miembroUidDoc.exists) {
    await miembroUidDoc.ref.update({
      nombre: newName,
      nombreCompleto: newName,
      displayName: newName,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Colección 'miembros' doc por UID (${uid}) actualizada.`);
  }

  // 3. Actualizar en colección 'usuarios' si existe
  const usuariosSnap = await db.collection('usuarios').where('email', '==', email).get();
  for (const doc of usuariosSnap.docs) {
    await doc.ref.update({
      nombre: newName,
      nombreCompleto: newName,
      displayName: newName,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Colección 'usuarios' (${doc.id}) actualizada.`);
  }

  const usuarioUidDoc = await db.collection('usuarios').doc(uid).get();
  if (usuarioUidDoc.exists) {
    await usuarioUidDoc.ref.update({
      nombre: newName,
      nombreCompleto: newName,
      displayName: newName,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Colección 'usuarios' doc por UID (${uid}) actualizada.`);
  }

  console.log('🎉 Nombre de SuperAdmin actualizado con éxito a Elizabeth Perez.');
}

updateSuperadminName().catch(console.error);
