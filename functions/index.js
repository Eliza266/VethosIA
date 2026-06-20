const functions = require('firebase-functions/v1');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { enviarEmailHistorial } = require('./email');

admin.initializeApp();

// Secretos declarados con firebase-functions/params. En vez del viejo functions.config()
// (deprecado) estos viven en Secret Manager y se inyectan como env vars en runtime.
// Para setearlos:  firebase functions:secrets:set EMAIL_PASS
// SendGrid es opcional; si no esta, caemos a SMTP con EMAIL_USER/EMAIL_PASS.
const EMAIL_PASS = defineSecret('EMAIL_PASS');
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');

// ── generarNumeroHC ─────────────────────────────────────────
// OJO: este contador global es el cuello de botella que estamos matando en la API nueva
// (POST /v1/consultas/:id/hc, contador por clinica). Lo dejamos vivo tal cual para no
// romper la app actual mientras hacemos el strangler-fig. No tocar el formato HC000001.
exports.generarNumeroHC = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
  }
  const contadorRef = admin.firestore().doc('configuracion/contadorHC');
  const numero = await admin.firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(contadorRef);
    const actual = doc.exists ? doc.data().ultimo : 0;
    const nuevo = actual + 1;
    transaction.set(contadorRef, { ultimo: nuevo });
    return nuevo;
  });
  return { numeroHC: `HC${String(numero).padStart(6, '0')}` };
});

// ── enviarHistorialEmail ────────────────────────────────────
// Antes esto tenia el usuario de Gmail hardcodeado y la pass en functions.config().email.pass.
// Ahora delega en el adaptador ./email, que elige proveedor (SendGrid o SMTP) por env/secret.
// El remitente sale de EMAIL_FROM/EMAIL_USER, ya no esta clavado en el codigo.
exports.enviarHistorialEmail = functions
  .runWith({ secrets: [EMAIL_PASS, SENDGRID_API_KEY] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    }
    const { emailDestinatario, nombrePropietario, nombrePaciente, pdfUrl, nombreVet } = data || {};

    if (!emailDestinatario || !pdfUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Faltan emailDestinatario o pdfUrl.');
    }

    try {
      await enviarEmailHistorial({ emailDestinatario, nombrePropietario, nombrePaciente, pdfUrl, nombreVet });
      return { success: true };
    } catch (err) {
      console.error('[VetIA] Error enviando email:', err);
      throw new functions.https.HttpsError('internal', 'No se pudo enviar el correo.');
    }
  });
