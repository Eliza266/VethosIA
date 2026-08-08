import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function inspectRobertoSub() {
  const email = 'robertoperrosygatos@vethosia.com';
  console.log(`=== Inspecting user & subscription for ${email} ===`);

  const user = await auth.getUserByEmail(email);
  console.log(`User Claims:`, user.customClaims);

  // Check miembros doc
  const miembroDoc = await db.collection('miembros').doc(user.uid).get();
  console.log(`Miembro Doc:`, miembroDoc.exists ? miembroDoc.data() : 'NOT FOUND');

  // Check veterinarios doc
  const vetDoc = await db.collection('veterinarios').doc(user.uid).get();
  console.log(`Veterinario Doc:`, vetDoc.exists ? vetDoc.data() : 'NOT FOUND');

  // Check veterinarias doc
  const vetSnap = await db.collection('veterinarias').get();
  console.log('Veterinarias en DB:');
  vetSnap.docs.forEach((d) => console.log(`  id=${d.id}, data=`, d.data()));

  // Check suscripciones doc
  const subSnap = await db.collection('suscripciones').get();
  console.log('Suscripciones en DB:');
  subSnap.docs.forEach((d) => console.log(`  id=${d.id}, data=`, d.data()));
}

inspectRobertoSub().catch(console.error);
