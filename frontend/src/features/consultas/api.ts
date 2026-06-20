import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { apiClient } from '../../lib/apiClient';
import { getFeatureFlags } from '../../lib/featureFlags';
import { toAppError } from '../../lib/errors';
import { normalizeResultadoSOAP } from './soapNormalize';
import type { ResultadoSOAP } from '../../types';

// Capa de API de consultas. La IA (transcripcion + SOAP) va SIEMPRE por /v1 con las claves
// server-side: NUNCA desde el navegador (eso exponia la API key de Gemini). HC y docs aun
// pueden caer al camino legacy (Cloud Functions) por flag, pero eso no expone claves.

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
 * Genera el numero de HC. Legacy: Cloud Function callable 'generarNumeroHC' (sin id).
 * API: POST /v1/consultas/:id/hc -> {numeroHC}. Devuelve '' si no se pudo (igual que
 * el codigo viejo, que dejaba la consulta sin numero antes que romper).
 */
export const generarNumeroHC = async (consultaId: string): Promise<string> => {
  const { useApiHC } = getFeatureFlags();
  // Ya NO tragamos el error con `return ''`: si falla, propagamos un AppError manejable
  // para que la UI muestre el problema en vez de dejar la consulta sin numero en silencio.
  try {
    if (useApiHC) {
      const res = await apiClient.post<{ numeroHC: string }>(`/v1/consultas/${consultaId}/hc`);
      return res.data?.numeroHC ?? '';
    }
    const functions = getFunctions();
    const generarHC = httpsCallable<unknown, { numeroHC: string }>(functions, 'generarNumeroHC');
    const resultado = await generarHC({});
    return resultado.data?.numeroHC ?? '';
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
  /** Solo camino legacy (Cloud Function); la API resuelve el PDF server-side. */
  pdfUrl?: string;
}

/**
 * Envia el historial por email. Legacy: Cloud Function callable 'enviarHistorialEmail'.
 * API: POST /v1/consultas/:id/email -> {success}.
 */
export const enviarHistorialEmail = async (
  consultaId: string,
  payload: EmailHistorialPayload
): Promise<boolean> => {
  const { useApiDocs } = getFeatureFlags();
  try {
    if (useApiDocs) {
      const res = await apiClient.post<{ success: boolean }>(
        `/v1/consultas/${consultaId}/email`,
        payload
      );
      return res.data?.success ?? false;
    }
    const functions = getFunctions();
    const enviarEmail = httpsCallable<EmailHistorialPayload, { success?: boolean }>(
      functions,
      'enviarHistorialEmail'
    );
    if (!payload.pdfUrl) {
      throw new Error('pdfUrl requerido para el envio legacy por Cloud Function.');
    }
    await enviarEmail(payload);
    return true;
  } catch (err) {
    throw toAppError(err, 'docs/email', 'Error al enviar el correo.');
  }
};
