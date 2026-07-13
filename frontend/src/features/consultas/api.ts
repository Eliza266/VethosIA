import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { apiClient } from '../../lib/apiClient';
import { getFeatureFlags } from '../../lib/featureFlags';
import { toAppError } from '../../lib/errors';
import { normalizeResultadoSOAP } from './soapNormalize';
import type { ResultadoSOAP, ExamenConsulta } from '../../types';

// Capa de API de consultas. La IA (transcripcion + SOAP) va SIEMPRE por /v1 con las claves
// server-side: NUNCA desde el navegador (eso exponia la API key de Gemini). El numero de HC
// y el envio de correo ya migraron por completo de las Cloud Functions legacy a la API.

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
      else reject(new Error('Error al convertir blob a base64'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// ─── NUMERO DE HISTORIA CLINICA ────────────────────────────
/**
 * Genera el numero de HC. POST /v1/consultas/:id/hc -> {numeroHC}. Devuelve '' si no se
 * pudo (igual que el codigo viejo, que dejaba la consulta sin numero antes que romper).
 */
export const generarNumeroHC = async (consultaId: string): Promise<string> => {
  // Ya NO tragamos el error con `return ''`: si falla, propagamos un AppError manejable
  // para que la UI muestre el problema en vez de dejar la consulta sin numero en silencio.
  try {
    const res = await apiClient.post<{ numeroHC: string }>(`/v1/consultas/${consultaId}/hc`);
    return res.data?.numeroHC ?? '';
  } catch (err) {
    throw toAppError(err, 'hc/generar', 'No se pudo generar el número de historia clínica.');
  }
};

// ─── TRANSCRIPCION ─────────────────────────────────────────
/**
 * Transcribe el audio. Legacy: Gemini directo desde el navegador (whisper.ts).
 * API: POST /v1/ia/transcribir {audioBase64, mimeType} -> {transcripcion}.
 */
export const transcribirAudio = async (audioBlob: Blob, audioPath?: string): Promise<string> => {
  try {
    // preferimos audioPath (Storage) si el audio ya se subio; si no, inline acotado.
    const body = audioPath
      ? { audioPath, mimeType: audioBlob.type || 'audio/webm' }
      : { audioBase64: await blobToBase64(audioBlob), mimeType: audioBlob.type || 'audio/webm' };
    const res = await apiClient.post<{ transcripcion: string }>('/v1/ia/transcribir', body);
    return res.data?.transcripcion ?? '';
  } catch (err) {
    throw toAppError(err, 'ia/transcribir', 'Error al transcribir el audio.');
  }
};

// ─── PROCESAMIENTO ASINCRONO ─────────────────────────────────
/**
 * Encola el procesamiento asincrono de IA en el backend (Cloud Tasks / Cola en memoria).
 * POST /v1/consultas/:id/procesar
 */
export const procesarConsultaConIA = async (
  consultaId: string,
  audioPaths: string[],
  mimeType: string,
  modo?: 'completo' | 'agregar'
): Promise<{ estado: string }> => {
  try {
    const res = await apiClient.post<{ estado: string }>(`/v1/consultas/${consultaId}/procesar`, {
      audioPaths,
      mimeType,
      ...(modo ? { modo } : {}),
    });
    return res.data;
  } catch (err) {
    throw toAppError(err, 'ia/procesar', 'Error al encolar el procesamiento de la consulta.');
  }
};

// ─── EXAMENES (PDF o imagen) ───────────────────────────────
/**
 * Sube un resultado de examen (PDF o foto) y devuelve el resumen de IA ya guardado en la consulta.
 * POST /v1/consultas/:id/examenes {nombre, pdfBase64, mimeType} -> ExamenConsulta.
 */
export const subirExamenConsulta = async (
  consultaId: string,
  nombre: string,
  archivo: Blob
): Promise<ExamenConsulta> => {
  try {
    const pdfBase64 = await blobToBase64(archivo);
    const res = await apiClient.post<ExamenConsulta>(`/v1/consultas/${consultaId}/examenes`, {
      nombre,
      pdfBase64,
      mimeType: archivo.type || 'application/pdf',
    });
    return res.data;
  } catch (err) {
    throw toAppError(err, 'consultas/examenes', 'Error al subir el resultado del examen.');
  }
};

// ─── GENERACION SOAP ───────────────────────────────────────
/**
 * Estructura la transcripcion en SOAP. Legacy: Gemini directo (gemini.ts).
 * API: POST /v1/ia/soap {transcripcion} -> objeto SOAP. Cuando viene de la API
 * asumimos que esta estructurado de verdad (generadoPorIA:true).
 */
export const generarSOAP = async (transcripcion: string): Promise<ResultadoSOAP> => {
  try {
    const res = await apiClient.post<unknown>('/v1/ia/soap', { transcripcion });
    return normalizeResultadoSOAP(res.data, true);
  } catch (err) {
    throw toAppError(err, 'ia/soap', 'Error al generar la nota SOAP.');
  }
};

// ─── DOCUMENTOS: PDF ───────────────────────────────────────
/**
 * Sube un PDF ya generado en el cliente a Storage y devuelve la URL (camino legacy).
 * Si el flag de docs esta ON, en cambio le pedimos a la API que genere+devuelva la
 * URL del PDF server-side (no usa el blob local).
 */
export const obtenerUrlPDF = async (
  consultaId: string,
  generarBlobLocal: () => Blob
): Promise<string> => {
  const { useApiDocs } = getFeatureFlags();
  if (useApiDocs) {
    try {
      const res = await apiClient.post<{ url: string }>(`/v1/consultas/${consultaId}/pdf`);
      return res.data.url;
    } catch (err) {
      throw toAppError(err, 'docs/pdf', 'Error al generar el PDF.');
    }
  }

  const blob = generarBlobLocal();
  const pdfRef = ref(storage, `historiales/${consultaId}.pdf`);
  await uploadBytes(pdfRef, blob);
  return getDownloadURL(pdfRef);
};

// ─── DOCUMENTOS: EMAIL ─────────────────────────────────────
export interface EmailHistorialPayload {
  emailDestinatario: string;
  nombrePropietario: string;
  nombrePaciente: string;
  nombreVet: string;
}

/**
 * Envia el historial por email. POST /v1/consultas/:id/email -> {success}.
 * La API resuelve el PDF server-side, no hace falta mandarlo.
 */
export const enviarHistorialEmail = async (
  consultaId: string,
  payload: EmailHistorialPayload
): Promise<boolean> => {
  try {
    const res = await apiClient.post<{ success: boolean }>(
      `/v1/consultas/${consultaId}/email`,
      payload
    );
    return res.data?.success ?? false;
  } catch (err) {
    throw toAppError(err, 'docs/email', 'Error al enviar el correo.');
  }
};
