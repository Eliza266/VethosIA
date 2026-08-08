import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function fixSuperadminName() {
  const email = 'gerencia@vethosia.com';
  const targetName = 'Elizabeth Perez';

  console.log(`=== Búsqueda y actualización exhaustiva para ${email} ===`);

  // 1. Update Auth
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`Auth User found: UID=${user.uid}, email=${user.email}, displayName=${user.displayName}`);
    await auth.updateUser(user.uid, { displayName: targetName });
    console.log(`✅ Auth displayName cambiado a: ${targetName}`);

    // Update custom user claims or user record
    const uid = user.uid;

    // Collections to check and update
    const collectionsToFix = ['miembros', 'usuarios', 'users', 'veterinarios', 'cuentas', 'organizaciones', 'veterinarias', 'entidades'];

    for (const colName of collectionsToFix) {
      // Search by email
      const byEmailSnap = await db.collection(colName).where('email', '==', email).get();
      for (const doc of byEmailSnap.docs) {
        await doc.ref.set(
          {
            nombre: targetName,
            nombreCompleto: targetName,
            displayName: targetName,
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        console.log(`✅ ${colName} (doc id=${doc.id}) actualizado por email`);
      }

      // Search by UID as doc ID
      const docByUid = await db.collection(colName).doc(uid).get();
      if (docByUid.exists) {
        await docByUid.ref.set(
          {
            nombre: targetName,
            nombreCompleto: targetName,
            displayName: targetName,
            actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        console.log(`✅ ${colName} (doc id=${uid}) actualizado por UID`);
      }
    }
  } catch (err) {
    console.error(`Error actualizando:`, err);
  }

  console.log('🎉 Finalizada la actualización de Elizabeth Perez.');
}

fixSuperadminName().catch(console.error);
