/**
 * QA harness del pipeline real de IA (Gemini STT + Claude SOAP) contra el entorno
 * DESPLEGADO (Cloud Run + Firebase real vethosia-5895b). No usa Admin SDK ni ADC:
 * se autentica como un usuario veterinario via Identity Toolkit REST (API key web
 * publica), sube los 4 bloques .mp3 a Storage por REST con el ID token del usuario,
 * y ejercita el flujo cliente: crear paciente -> crear consulta -> /procesar -> poll.
 *
 * Valida que la transcripcion (merge de 4 bloques) y el SOAP sean reales y no vacios.
 * Limpia los datos de QA al final (borra consulta borrador + paciente) salvo QA_CLEANUP=0.
 *
 * Uso (PowerShell):
 *   $env:QA_API_KEY="<web api key>"; $env:QA_EMAIL="vet1@..."; $env:QA_PASSWORD="..."
 *   cd api ; npx ts-node scripts/qa-audio-pipeline.ts
 * Variables (SIN defaults con credenciales: nada de secretos en el repo):
 *   QA_API_BASE   (default https://vetia-api-awdlgzrxkq-uc.a.run.app)
 *   QA_API_KEY    (REQUERIDA: web API key de Firebase)
 *   QA_BUCKET     (default vethosia-5895b.firebasestorage.app)
 *   QA_EMAIL / QA_PASSWORD  (REQUERIDAS: credenciales del usuario de QA)
 *   QA_AUDIO_FILES  (rutas .mp3 separadas por ';'; default los 4 bloques del escritorio)
 *   QA_CLEANUP    ('0' para conservar los datos de QA)
 */
import { readFileSync, existsSync } from 'node:fs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (requerida; no se hardcodean credenciales).`);
  return v;
}

const API_BASE = process.env.QA_API_BASE ?? 'https://vetia-api-awdlgzrxkq-uc.a.run.app';
const API_KEY = requireEnv('QA_API_KEY');
const BUCKET = process.env.QA_BUCKET ?? 'vethosia-5895b.firebasestorage.app';
const EMAIL = requireEnv('QA_EMAIL');
const PASSWORD = requireEnv('QA_PASSWORD');
const CLEANUP = process.env.QA_CLEANUP !== '0';
const AUDIO_FILES = (
  process.env.QA_AUDIO_FILES ??
  [
    'd:\\Nube\\OneDrive - Campus\\Escritorio\\bloque 1.mp3',
    'd:\\Nube\\OneDrive - Campus\\Escritorio\\bloque 2.mp3',
    'd:\\Nube\\OneDrive - Campus\\Escritorio\\bloque 3.mp3',
    'd:\\Nube\\OneDrive - Campus\\Escritorio\\bloque 4.mp3',
  ].join(';')
).split(';').map((s) => s.trim()).filter(Boolean);

const MIME = 'audio/mpeg';
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 4_000;

function log(section: string, detail = ''): void {
  // Marca temporal para medir latencia del pipeline real.
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${section}${detail ? ' ' + detail : ''}`);
}

function fail(msg: string): never {
  console.error(`\nQA FALLÓ: ${msg}`);
  process.exit(1);
}

async function signIn(): Promise<{ idToken: string; uid: string }> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  if (!res.ok) fail(`login Identity Toolkit ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { idToken: string; localId: string };
  return { idToken: body.idToken, uid: body.localId };
}

async function api<T>(
  method: string,
  path: string,
  idToken: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data: data as T };
}

async function uploadAudio(
  idToken: string,
  storagePath: string,
  bytes: Buffer,
): Promise<void> {
  const name = encodeURIComponent(storagePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${name}`;
  const blob = new Blob([new Uint8Array(bytes)], { type: MIME });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: blob,
  });
  if (!res.ok) fail(`subida a Storage (${storagePath}) ${res.status}: ${await res.text()}`);
}

interface ConsultaDoc {
  id: string;
  estado?: string;
  transcripcion?: string;
  soap?: {
    subjetivo?: string;
    objetivo?: string;
    analisis?: string;
    plan?: string;
    generadoPorIA?: boolean;
  };
  diagnosticoEstructurado?: unknown[];
}

async function main(): Promise<void> {
  log('== QA pipeline real de audio ==', `\n  API=${API_BASE}\n  bucket=${BUCKET}\n  user=${EMAIL}`);

  for (const f of AUDIO_FILES) {
    if (!existsSync(f)) fail(`no existe el audio: ${f}`);
  }
  log('Audios encontrados', `(${AUDIO_FILES.length})`);

  const { idToken, uid } = await signIn();
  log('Login OK', `uid=${uid}`);

  // 1) Paciente de QA (rotulado para limpieza posterior).
  const stamp = Date.now();
  const pacienteRes = await api<{ id: string }>('POST', '/v1/pacientes', idToken, {
    nombre: `QA-NO-VENDER ${stamp}`,
    especie: 'Canino',
    propietario: { nombre: 'QA Owner', telefono: '3000000000', email: 'qa@vethosia.com' },
  });
  if (pacienteRes.status >= 300 || !pacienteRes.data?.id) {
    fail(`crear paciente ${pacienteRes.status}: ${JSON.stringify(pacienteRes.data)}`);
  }
  const pacienteId = pacienteRes.data.id;
  log('Paciente creado', pacienteId);

  // 2) Consulta borrador.
  const consultaRes = await api<{ id: string; estado?: string }>('POST', '/v1/consultas', idToken, {
    pacienteId,
  });
  if (consultaRes.status >= 300 || !consultaRes.data?.id) {
    fail(`crear consulta ${consultaRes.status}: ${JSON.stringify(consultaRes.data)}`);
  }
  const consultaId = consultaRes.data.id;
  log('Consulta creada', `${consultaId} estado=${consultaRes.data.estado}`);

  // 3) Subir los 4 bloques a audios/{uid}/{consultaId}-{i}.mp3
  const audioPaths: string[] = [];
  for (let i = 0; i < AUDIO_FILES.length; i++) {
    const bytes = readFileSync(AUDIO_FILES[i]);
    const storagePath = `audios/${uid}/${consultaId}-${i}.mp3`;
    await uploadAudio(idToken, storagePath, bytes);
    audioPaths.push(storagePath);
    log('Bloque subido', `${i} -> ${storagePath} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  // 4) Encolar procesamiento IA real.
  const procRes = await api<{ estado: string }>(
    'POST',
    `/v1/consultas/${consultaId}/procesar`,
    idToken,
    { audioPaths, mimeType: MIME },
  );
  if (procRes.status >= 300) {
    fail(`/procesar ${procRes.status}: ${JSON.stringify(procRes.data)}`);
  }
  log('Procesamiento encolado', `estado=${procRes.data?.estado}`);

  // 5) Poll hasta borrador (listo) o error.
  const started = Date.now();
  let consulta: ConsultaDoc | null = null;
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const get = await api<ConsultaDoc>('GET', `/v1/consultas/${consultaId}`, idToken);
    if (get.status >= 300) {
      log('Poll error HTTP', `${get.status}`);
      continue;
    }
    consulta = get.data;
    const elapsed = Math.round((Date.now() - started) / 1000);
    log('Poll', `estado=${consulta.estado} (${elapsed}s)`);
    if (consulta.estado === 'borrador' || consulta.estado === 'error') break;
  }

  if (!consulta) fail('no se pudo obtener la consulta tras el poll');
  if (consulta.estado === 'error') fail('la consulta quedó en estado "error" (revisar logs de IA)');
  if (consulta.estado !== 'borrador') fail(`timeout: estado final=${consulta.estado}`);

  // 6) Validaciones de contenido real.
  const trans = consulta.transcripcion ?? '';
  const soap = consulta.soap ?? {};
  console.log('\n--- RESULTADO REAL ---');
  console.log(`Transcripción (${trans.length} chars):\n${trans.slice(0, 600)}${trans.length > 600 ? '…' : ''}`);
  console.log(`\nSOAP.subjetivo: ${(soap.subjetivo ?? '').slice(0, 200)}`);
  console.log(`SOAP.objetivo:  ${(soap.objetivo ?? '').slice(0, 200)}`);
  console.log(`SOAP.analisis:  ${(soap.analisis ?? '').slice(0, 200)}`);
  console.log(`SOAP.plan:      ${(soap.plan ?? '').slice(0, 200)}`);
  console.log(`Diagnóstico estructurado: ${consulta.diagnosticoEstructurado?.length ?? 0} item(s)`);

  const problemas: string[] = [];
  if (trans.length < 50) problemas.push('transcripción demasiado corta (<50 chars)');
  const soapTexto = `${soap.subjetivo ?? ''}${soap.objetivo ?? ''}${soap.analisis ?? ''}${soap.plan ?? ''}`;
  if (soapTexto.trim().length < 50) problemas.push('SOAP prácticamente vacío');
  if (soap.generadoPorIA !== true) problemas.push('soap.generadoPorIA !== true');

  // 7) Cleanup (borra consulta borrador + paciente para no dejar basura en prod).
  if (CLEANUP) {
    const delC = await api('DELETE', `/v1/consultas/${consultaId}`, idToken);
    log('Cleanup consulta', `${delC.status}`);
    const delP = await api('DELETE', `/v1/pacientes/${pacienteId}`, idToken);
    log('Cleanup paciente', `${delP.status}`);
  } else {
    log('Cleanup omitido', `(QA_CLEANUP=0) paciente=${pacienteId} consulta=${consultaId}`);
  }

  if (problemas.length > 0) fail(`validaciones: ${problemas.join('; ')}`);
  console.log('\nQA OK: pipeline real de audio -> transcripción -> SOAP validado.');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
