/* eslint-disable no-console */
/**
 * Siembra datos de ejemplo en el EMULADOR para probar la migracion y la API.
 * Crea un par de veterinarios (legacy, solo veterinarioId) con sus pacientes/consultas.
 *
 * Uso (PowerShell):
 *   $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *   $env:GCLOUD_PROJECT="vethosia-production"
 *   npm run seed:emulator
 *
 * SEGURIDAD: se niega a correr si NO detecta el emulador, para no ensuciar prod por error.
 */
import * as admin from 'firebase-admin';

function init(): admin.app.App {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Sin FIRESTORE_EMULATOR_HOST: este seed SOLO corre contra el emulador.');
  }
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'vethosia-production' });
}

async function main(): Promise<void> {
  const db = init().firestore();
  const vets = [
    { uid: 'vet-ana', nombre: 'Ana PÃ©rez', veterinaria: 'ClÃ­nica Norte' },
    { uid: 'vet-beto', nombre: 'Beto GÃ³mez', veterinaria: 'ClÃ­nica Sur' },
  ];

  for (const v of vets) {
    await db.collection('veterinarios').doc(v.uid).set({
      nombre: v.nombre,
      email: `${v.uid}@example.com`,
      veterinaria: v.veterinaria,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    const pac = await db.collection('pacientes').add({
      nombre: `Paciente de ${v.nombre}`,
      especie: 'perro',
      sexo: 'macho',
      estadoReproductivo: 'entero',
      veterinarioId: v.uid,
      propietario: { nombre: 'DueÃ±o Ejemplo', telefono: '3000000000' },
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('consultas').add({
      pacienteId: pac.id,
      veterinarioId: v.uid,
      fechaHora: admin.firestore.FieldValue.serverTimestamp(),
      estado: 'borrador',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('brigadas').add({
      nombre: `Brigada de ${v.nombre}`,
      fecha: '2026-01-01',
      ubicacion: { direccion: 'Centro', ciudad: 'BogotÃ¡' },
      veterinarioIds: [v.uid],
      estado: 'planificada',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log('[seed] datos de ejemplo creados en el emulador.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] ERROR:', err);
    process.exit(1);
  });
