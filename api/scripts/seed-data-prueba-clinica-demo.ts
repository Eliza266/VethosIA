/* eslint-disable no-console */
// Carga pacientes y consultas de PRUEBA (data claramente ficticia) para los veterinarios
// de "Entidad Demo / Clínica Demo": veterinario@, nicovet@ y admin.veterinaria@
// (los 3 roles con panel de veterinario). admin.entidad@ no recibe pacientes propios.
//
// Todo se escribe directo en Firestore (sin pasar por IA, sin enviar correos/WhatsApp).
// Cada registro queda marcado con origenPrueba: true para poder identificarlo/borrarlo despues.
// Es idempotente: si un usuario ya tiene >=12 pacientes de prueba, se salta.
//
// Correr: cd api ; GCLOUD_PROJECT=vethosia-5895b npx ts-node scripts/seed-data-prueba-clinica-demo.ts
import * as admin from 'firebase-admin';

const PROJECT_ID = 'vethosia-5895b';
const PACIENTES_POR_USUARIO = 12;

const USUARIOS_OBJETIVO = ['veterinario@vethosia.com', 'nicovet@vethosia.com', 'admin.veterinaria@vethosia.com'];

const MASCOTAS: Array<{ nombre: string; especie: string; raza: string; sexo: 'macho' | 'hembra' }> = [
  { nombre: 'Rocky', especie: 'perro', raza: 'Labrador', sexo: 'macho' },
  { nombre: 'Luna', especie: 'gato', raza: 'Siames', sexo: 'hembra' },
  { nombre: 'Max', especie: 'perro', raza: 'Bulldog frances', sexo: 'macho' },
  { nombre: 'Mia', especie: 'gato', raza: 'Comun europeo', sexo: 'hembra' },
  { nombre: 'Toby', especie: 'perro', raza: 'Beagle', sexo: 'macho' },
  { nombre: 'Nala', especie: 'gato', raza: 'Persa', sexo: 'hembra' },
  { nombre: 'Simon', especie: 'perro', raza: 'Poodle', sexo: 'macho' },
  { nombre: 'Coco', especie: 'ave', raza: 'Periquito', sexo: 'hembra' },
  { nombre: 'Bruno', especie: 'perro', raza: 'Pastor aleman', sexo: 'macho' },
  { nombre: 'Sasha', especie: 'gato', raza: 'Maine Coon', sexo: 'hembra' },
  { nombre: 'Zeus', especie: 'perro', raza: 'Golden Retriever', sexo: 'macho' },
  { nombre: 'Kira', especie: 'conejo', raza: 'Holandes', sexo: 'hembra' },
];

const DUENOS = [
  { nombre: 'Carlos Ramirez', telefono: '3001112233' },
  { nombre: 'Ana Torres', telefono: '3002223344' },
  { nombre: 'Julian Gomez', telefono: '3003334455' },
  { nombre: 'Marcela Rios', telefono: '3004445566' },
  { nombre: 'Felipe Castro', telefono: '3005556677' },
  { nombre: 'Diana Herrera', telefono: '3006667788' },
  { nombre: 'Andres Pena', telefono: '3007778899' },
  { nombre: 'Laura Vargas', telefono: '3008889900' },
  { nombre: 'Sergio Morales', telefono: '3009990011' },
  { nombre: 'Paula Salazar', telefono: '3001230012' },
  { nombre: 'Ricardo Nino', telefono: '3002340023' },
  { nombre: 'Camila Ortiz', telefono: '3003450034' },
];

const MOTIVOS = [
  'control de rutina',
  'vacunacion anual',
  'vomito y decaimiento',
  'chequeo post-cirugia',
  'cojera pata trasera',
  'perdida de apetito',
  'revision dermatologica',
  'diarrea leve',
  'control de peso',
  'limpieza dental',
  'tos persistente',
  'chequeo geriatrico',
];

// Nombre corto de diagnostico por motivo (mismo orden/indice que MOTIVOS), para que el
// grafico de "Top diagnosticos" del dashboard muestre etiquetas cortas y realistas en
// vez de una oracion completa (que rompia el layout del eje del grafico).
const DIAGNOSTICOS_CORTOS = [
  'Control de rutina',
  'Refuerzo vacunal',
  'Gastroenteritis leve',
  'Chequeo post-cirugia',
  'Cojera leve',
  'Anorexia parcial',
  'Dermatitis leve',
  'Diarrea leve',
  'Sobrepeso',
  'Sarro dental',
  'Tos leve',
  'Chequeo geriatrico',
];

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
  console.log(`[seed-data-prueba] proyecto: ${projectId}`);
  return admin.initializeApp({ projectId });
}

function diasAtras(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return admin.firestore.Timestamp.fromDate(d);
}

async function seedParaUsuario(
  db: admin.firestore.Firestore,
  uid: string,
  email: string,
  ownerCtx: { entId: string; vetId: string; membershipId: string },
): Promise<void> {
  const existentes = await db
    .collection('pacientes')
    .where('veterinarioId', '==', uid)
    .where('origenPrueba', '==', true)
    .get();

  if (existentes.size >= PACIENTES_POR_USUARIO) {
    console.log(`[seed-data-prueba] ${email} ya tiene ${existentes.size} pacientes de prueba. Se salta.`);
    return;
  }

  const ts = admin.firestore.FieldValue.serverTimestamp();
  console.log(`[seed-data-prueba] creando ${PACIENTES_POR_USUARIO} pacientes + consultas para ${email}...`);

  for (let i = 0; i < PACIENTES_POR_USUARIO; i++) {
    const mascota = MASCOTAS[i % MASCOTAS.length];
    const dueno = DUENOS[i % DUENOS.length];
    const motivo = MOTIVOS[i % MOTIVOS.length];
    const diagnosticoCorto = DIAGNOSTICOS_CORTOS[i % DIAGNOSTICOS_CORTOS.length];

    const pacienteRef = db.collection('pacientes').doc();
    await pacienteRef.set({
      id: pacienteRef.id,
      orgId: ownerCtx.entId,
      veterinarioId: uid,
      accountType: 'veterinaria',
      accountId: ownerCtx.vetId,
      entidadId: ownerCtx.entId,
      veterinariaId: ownerCtx.vetId,
      planOwnerType: 'entidad',
      planOwnerId: ownerCtx.entId,
      membershipId: ownerCtx.membershipId,
      nombre: `${mascota.nombre} (prueba ${i + 1})`,
      especie: mascota.especie,
      raza: mascota.raza,
      sexo: mascota.sexo,
      estadoReproductivo: 'esterilizado',
      color: 'variado',
      propietario: {
        nombre: dueno.nombre,
        telefono: dueno.telefono,
        email: `${dueno.nombre.split(' ')[0].toLowerCase()}.prueba@example.com`,
      },
      notas: '[DATA DE PRUEBA] generado para pruebas de QA, no es un paciente real.',
      ultimoPeso: 5 + i,
      origenPrueba: true,
      esPlaceholder: false,
      creadoEn: ts,
    });

    const consultaRef = db.collection('consultas').doc();
    await consultaRef.set({
      id: consultaRef.id,
      numeroHC: `HC-DEMO-${uid.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      pacienteId: pacienteRef.id,
      veterinarioId: uid,
      orgId: ownerCtx.entId,
      accountType: 'veterinaria',
      accountId: ownerCtx.vetId,
      entidadId: ownerCtx.entId,
      veterinariaId: ownerCtx.vetId,
      planOwnerType: 'entidad',
      planOwnerId: ownerCtx.entId,
      membershipId: ownerCtx.membershipId,
      estado: 'aprobada',
      motivo,
      prioridad: i % 5 === 0 ? 'urgente' : i % 3 === 0 ? 'seguimiento' : 'rutina',
      signosVitales: {
        peso: 5 + i,
        talla: 30 + i,
        temperatura: 38 + (i % 3) * 0.3,
        frecuenciaCardiaca: 80 + i,
        frecuenciaRespiratoria: 20 + (i % 5),
        condicionCorporal: 3,
      },
      soap: {
        subjetivo: `Propietario reporta ${motivo} en ${mascota.nombre}. Paciente de prueba QA, sin antecedentes relevantes.`,
        objetivo: `Paciente alerta, hidratado. Constantes dentro de rango para la especie. Examen fisico sin hallazgos criticos (registro de prueba).`,
        analisis: `Cuadro compatible con ${motivo}, de caracter leve. Diagnostico de prueba, no clinico real.`,
        plan: 'Seguimiento en 15 dias. Manejo sintomatico. (Plan generado para datos de prueba QA).',
        generadoPorIA: false,
      },
      diagnosticoEstructurado: [
        {
          id: `diag-demo-${i + 1}`,
          nombre: diagnosticoCorto,
          tipo: 'principal',
          estado: 'confirmado',
          especie: mascota.especie,
          notas: '[DATA DE PRUEBA] diagnostico de QA, no clinico real.',
          origen: 'manual',
          creadoEn: new Date().toISOString(),
        },
      ],
      origenPrueba: true,
      fechaHora: diasAtras((i + 1) * 4),
      creadoEn: ts,
      actualizadoEn: ts,
    });
  }

  console.log(`[seed-data-prueba] listo: ${PACIENTES_POR_USUARIO} pacientes + ${PACIENTES_POR_USUARIO} consultas para ${email}.`);
}

async function main(): Promise<void> {
  const app = initAdmin();
  const db = app.firestore();
  const auth = app.auth();

  const entQuery = await db.collection('entidades').where('nombre', '==', 'Entidad Demo').limit(1).get();
  if (entQuery.empty) throw new Error('No existe "Entidad Demo". Corre primero seed:test-roles.');
  const entId = entQuery.docs[0].id;

  const vetQuery = await db
    .collection('veterinarias')
    .where('nombre', '==', 'Clínica Demo')
    .where('entidadId', '==', entId)
    .limit(1)
    .get();
  if (vetQuery.empty) throw new Error('No existe "Clínica Demo". Corre primero seed:test-roles.');
  const vetId = vetQuery.docs[0].id;

  console.log(`[seed-data-prueba] Entidad Demo (${entId}) / Clínica Demo (${vetId})`);

  for (const email of USUARIOS_OBJETIVO) {
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    const claims = (userRecord.customClaims ?? {}) as {
      role?: string;
      membershipId?: string;
      veterinariaId?: string;
    };
    if (claims.veterinariaId && claims.veterinariaId !== vetId) {
      console.log(`[seed-data-prueba] AVISO: ${email} no pertenece a Clínica Demo (veterinariaId=${claims.veterinariaId}). Se salta por seguridad.`);
      continue;
    }
    const membershipId = claims.membershipId ?? `m_${uid}_${claims.role ?? 'veterinario'}`;
    await seedParaUsuario(db, uid, email, { entId, vetId, membershipId });
  }

  console.log('\n=== SEED DE DATA DE PRUEBA COMPLETADO ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-data-prueba] ERROR:', err);
    process.exit(1);
  });
