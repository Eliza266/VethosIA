/* eslint-disable no-console */
// Carga los 4 planes comerciales definitivos de Vethos AI en la coleccion `planes`.
// Precio anual = precio mensual x 12 x 0.9 (10% de descuento por pago anual), igual para los 4.
// Si un plan con el mismo nombre ya existe, se actualiza en vez de duplicar.
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/seed-planes.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const DESCUENTO_ANUAL = 0.9;

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-planes] proyecto: ${projectId}`);
  return admin.initializeApp({ projectId });
}

function precioAnual(precioMensual: number): number {
  return Math.round((precioMensual * 12 * DESCUENTO_ANUAL) / 1000) * 1000;
}

interface PlanSeed {
  nombre: string;
  descripcion: string;
  precioMensualCOP: number;
  asientosMax: number;
  limiteHistoriasMes: number;
  tipo: 'individual' | 'entidad' | 'ambos';
}

const PLANES: PlanSeed[] = [
  {
    nombre: 'Veterinario Individual',
    descripcion: 'Ideal para veterinarios independientes.',
    precioMensualCOP: 150000,
    asientosMax: 1,
    limiteHistoriasMes: 150,
    tipo: 'individual',
  },
  {
    nombre: 'Clínica Start',
    descripcion: 'Ideal para consultorios y clínicas pequeñas.',
    precioMensualCOP: 399000,
    asientosMax: 3,
    limiteHistoriasMes: 400,
    tipo: 'entidad',
  },
  {
    nombre: 'Clínica Pro',
    descripcion: 'Ideal para clínicas medianas.',
    precioMensualCOP: 849000,
    asientosMax: 7,
    limiteHistoriasMes: 950,
    tipo: 'entidad',
  },
  {
    nombre: 'Clínica Enterprise',
    descripcion: 'Ideal para hospitales veterinarios y grandes clínicas.',
    precioMensualCOP: 1650000,
    asientosMax: 15,
    limiteHistoriasMes: 2000,
    tipo: 'entidad',
  },
];

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const col = db.collection('planes');

  for (const plan of PLANES) {
    const data = {
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precioMensualCOP: plan.precioMensualCOP,
      precioAnualCOP: precioAnual(plan.precioMensualCOP),
      asientosMax: plan.asientosMax,
      limiteHistoriasMes: plan.limiteHistoriasMes,
      historiasGratisTrial: plan.limiteHistoriasMes,
      tipo: plan.tipo,
      activo: true,
    };

    const existente = await col.where('nombre', '==', plan.nombre).limit(1).get();
    if (!existente.empty) {
      const id = existente.docs[0].id;
      await col.doc(id).set(data, { merge: true });
      console.log(`[seed-planes] actualizado: ${plan.nombre} (${id})`);
    } else {
      const ref = await col.add(data);
      console.log(`[seed-planes] creado: ${plan.nombre} (${ref.id})`);
    }
  }

  console.log('[seed-planes] listo.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-planes] error:', err);
    process.exit(1);
  });
