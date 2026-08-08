import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();

async function syncAllPlans() {
  console.log('=== Sincronizando planes de suscripciones, veterinarias y entidades ===');

  const enterpriseSnap = await db.collection('planes').where('nombre', '==', 'Clínica Enterprise').limit(1).get();
  let planId = 'oq7uo8eBIgb3f7ZZ8RYc';
  let planNombre = 'Clínica Enterprise';
  let asientosMax = 15;
  let limiteHistoriasMes = 2000;

  if (!enterpriseSnap.empty) {
    const pData = enterpriseSnap.docs[0].data();
    planId = enterpriseSnap.docs[0].id;
    planNombre = String(pData.nombre);
    asientosMax = Number(pData.asientosMax ?? 15);
    limiteHistoriasMes = Number(pData.limiteHistoriasMes ?? 2000);
  }

  // 1. Update suscripciones
  const subsSnap = await db.collection('suscripciones').get();
  for (const doc of subsSnap.docs) {
    await doc.ref.set(
      {
        planId,
        planNombre,
        asientosMax,
        limiteHistoriasMes,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`✅ Suscripción ${doc.id} actualizada a: ${planNombre}`);
  }

  // 2. Update veterinarias
  const vetSnap = await db.collection('veterinarias').get();
  for (const doc of vetSnap.docs) {
    await doc.ref.set(
      {
        planId,
        planNombre,
        asientosMax,
        limiteHistoriasMes,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`✅ Veterinaria ${doc.id} (${doc.data().nombre}) actualizada a: ${planNombre}`);
  }

  // 3. Update entidades
  const entSnap = await db.collection('entidades').get();
  for (const doc of entSnap.docs) {
    await doc.ref.set(
      {
        planId,
        planNombre,
        asientosMax,
        limiteHistoriasMes,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`✅ Entidad ${doc.id} (${doc.data().nombre}) actualizada a: ${planNombre}`);
  }

  console.log('🎉 Sincronización completada.');
}

syncAllPlans().catch(console.error);
