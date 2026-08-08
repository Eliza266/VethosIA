import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'vethosia-5895b',
  });
}

const db = admin.firestore();

async function fixSubscriptionPlans() {
  console.log('=== Limpiando y mapeando planes de suscripciones en Firestore ===');

  const subsSnap = await db.collection('suscripciones').get();
  console.log(`Encontradas ${subsSnap.size} suscripciones.`);

  // Cargar planes oficiales
  const planesSnap = await db.collection('planes').get();
  const planes = planesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as { nombre: string }) }));
  console.log('Planes en catálogo:', planes);

  for (const doc of subsSnap.docs) {
    const data = doc.data();
    const currentPlanId = String(data.planId ?? '');
    console.log(`Suscripción ${doc.id}: ownerId=${data.planOwnerId || data.veterinariaId}, planId actual=${currentPlanId}`);

    let newPlanId = currentPlanId;
    let newPlanNombre = data.planNombre ?? 'Clínica Pro';

    // Mapear hashes raros (ej: jljetjC0ixysHjz32IX3) a un plan oficial
    const matchingPlan = planes.find(
      (p) => p.id === currentPlanId || p.nombre.toLowerCase() === currentPlanId.toLowerCase(),
    );

    if (matchingPlan) {
      newPlanId = matchingPlan.id;
      newPlanNombre = matchingPlan.nombre;
    } else {
      // Asignar plan oficial defecto 'Clínica Pro'
      const clinicaPro = planes.find((p) => p.nombre.includes('Pro')) ?? planes[0];
      if (clinicaPro) {
        newPlanId = clinicaPro.id;
        newPlanNombre = clinicaPro.nombre;
      }
    }

    await doc.ref.set(
      {
        planId: newPlanId,
        planNombre: newPlanNombre,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`✅ Suscripción ${doc.id} actualizada: planId="${newPlanId}", planNombre="${newPlanNombre}"`);
  }

  console.log('🎉 Finalizada la corrección de suscripciones.');
}

fixSubscriptionPlans().catch(console.error);
