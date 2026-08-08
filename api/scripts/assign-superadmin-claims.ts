import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const auth = admin.auth();

async function setSuperadminClaims() {
  const email = 'gerencia@vethosia.com';
  console.log(`Setting superadmin custom claims for ${email}...`);
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, {
    rol: 'superadmin',
    isSuperadmin: true,
  });
  console.log(`✅ Custom claims set for UID=${user.uid}: { rol: 'superadmin', isSuperadmin: true }`);
}

setSuperadminClaims().catch(console.error);
