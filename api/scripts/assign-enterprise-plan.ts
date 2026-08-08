import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();

async function assignEnterpriseToRoberto() {
  console.log('=== Asignando Clínica Enterprise a la suscripción de Perros y Gatos ===');

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
    console.log(`✅ Suscripción ${doc.id} actualizada a: ${planNombre} (asientos=${asientosMax}, límite=${limiteHistoriasMes})`);
  }

  console.log('🎉 Asignación completada.');
}

assignEnterpriseToRoberto().catch(console.error);
