/* eslint-disable no-console */
/**
 * Smoke runtime API: auth emulador + IA mock + procesar consulta.
 * Requiere emuladores + API arriba y seed:e2e-local ejecutado.
 */
import 'dotenv/config';
import axios from 'axios';
import * as admin from 'firebase-admin';

const API = process.env.E2E_API_BASE ?? 'http://127.0.0.1:8081';
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'vet@vetia.local';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'VetIA-Local-2026!';

async function signIn(): Promise<{ idToken: string; uid: string }> {
  const url = `http://${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;
  const res = await axios.post(url, {
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
    returnSecureToken: true,
  });
  return { idToken: res.data.idToken as string, uid: res.data.localId as string };
}

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'vethosia-production' });
}

async function main(): Promise<void> {
  console.log('[e2e:api] health...');
  const health = await axios.get(`${API}/v1/health`);
  console.log('[e2e:api] health OK', health.data);

  const { idToken, uid } = await signIn();
  console.log('[e2e:api] auth OK uid=', uid);

  const headers = { Authorization: `Bearer ${idToken}` };

  const tx = await axios.post(
    `${API}/v1/ia/transcribir`,
    { audioBase64: Buffer.from('fake').toString('base64'), mimeType: 'audio/webm' },
    { headers },
  );
  console.log('[e2e:api] transcribir OK', (tx.data.transcripcion as string).slice(0, 80));

  const soap = await axios.post(
    `${API}/v1/ia/soap`,
    { transcripcion: tx.data.transcripcion },
    { headers },
  );
  console.log('[e2e:api] soap OK motivo=', soap.data?.motivo ?? soap.data?.subjetivo?.slice?.(0, 40));

  const db = initAdmin().firestore();
  const pacRef = await db.collection('pacientes').add({
    nombre: 'API Smoke Paciente',
    especie: 'perro',
    sexo: 'macho',
    estadoReproductivo: 'entero',
    veterinarioId: uid,
    propietario: { nombre: 'DueÃ±o', telefono: '3000000000' },
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });
  const consRef = await db.collection('consultas').add({
    pacienteId: pacRef.id,
    veterinarioId: uid,
    estado: 'borrador',
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  const proc = await axios.post(
    `${API}/v1/consultas/${consRef.id}/procesar`,
    { audioBase64: Buffer.from('fake-audio-webm').toString('base64'), mimeType: 'audio/webm' },
    { headers },
  );
  console.log('[e2e:api] procesar encolado', proc.data);

  // Poll consulta hasta borrador o error (cola in-memory)
  let finalEstado = 'unknown';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const snap = await consRef.get();
    finalEstado = snap.data()?.estado ?? 'unknown';
    if (finalEstado === 'borrador' || finalEstado === 'error') {
      console.log('[e2e:api] consulta estado=', finalEstado, 'transcripcion=', !!snap.data()?.transcripcion);
      if (finalEstado !== 'borrador') throw new Error('procesar fallÃ³ en consulta');
      break;
    }
  }

  await axios.post(`${API}/v1/consultas/${consRef.id}/aprobar`, {}, { headers });
  console.log('[e2e:api] aprobar OK');

  const pdf = await axios.post(`${API}/v1/consultas/${consRef.id}/pdf`, {}, { headers });
  console.log('[e2e:api] pdf OK url=', (pdf.data.url as string).slice(0, 80));
  const pdfGet = await axios.get(`${API}/v1/consultas/${consRef.id}/pdf/download`, {
    headers,
    responseType: 'arraybuffer',
  });
  if (pdfGet.status !== 200 || pdfGet.data.byteLength < 100) {
    throw new Error('PDF server-side vacÃ­o o no descargable');
  }
  console.log('[e2e:api] pdf bytes=', pdfGet.data.byteLength);

  const mail = await axios.post(
    `${API}/v1/consultas/${consRef.id}/email`,
    {
      emailDestinatario: 'dueno-mock@example.com',
      nombrePropietario: 'DueÃ±o Smoke',
      nombrePaciente: 'API Smoke Paciente',
      pdfUrl: pdf.data.url,
      nombreVet: 'Vet E2E Local',
    },
    { headers },
  );
  console.log('[e2e:api] email mock OK', mail.data);
  if (!mail.data?.success) throw new Error('email mock no devolviÃ³ success');

  console.log('[e2e:api] OK');
}

main().catch((err) => {
  console.error('[e2e:api] FALLO', err.response?.data ?? err.message);
  process.exit(1);
});
