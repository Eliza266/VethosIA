'use strict';

// Adaptador de email para las Cloud Functions.
// La idea: no atarnos a Gmail. Elegimos proveedor por env:
//   - si hay SENDGRID_API_KEY  -> SendGrid (API HTTP, recomendado en prod)
//   - si no                    -> SMTP via nodemailer (EMAIL_HOST/EMAIL_USER/EMAIL_PASS)
// Por compatibilidad, si no setean EMAIL_HOST asumimos Gmail como antes, pero ya
// sin credenciales hardcodeadas: salen de env/secret.
const nodemailer = require('nodemailer');

const FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'vetiasoporte@gmail.com';

function plantillaHtml({ nombrePropietario, nombrePaciente, pdfUrl, nombreVet }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #072040; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Vethos AI</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${nombrePropietario || ''}</strong>,</p>
        <p>Adjunto la historia clínica de <strong>${nombrePaciente || ''}</strong> generada por el Dr(a). <strong>${nombreVet || ''}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${pdfUrl}" style="background: #072040; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Descargar Historia Clínica
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Generado por Vethos AI</p>
      </div>
    </div>
  `;
}

async function enviarConSendGrid({ to, subject, html }) {
  // require perezoso: solo lo cargamos si de verdad usamos SendGrid, asi no obligamos
  // a tener el paquete instalado en entornos que usan SMTP.
  const sg = require('@sendgrid/mail');
  sg.setApiKey(process.env.SENDGRID_API_KEY);
  await sg.send({ to, from: FROM, subject, html });
}

async function enviarConSmtp({ to, subject, html }) {
  // Si dan EMAIL_HOST armamos SMTP generico; si no, gmail (legacy) pero con pass por env.
  const transporter = process.env.EMAIL_HOST
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      })
    : nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER || 'vetiasoporte@gmail.com', pass: process.env.EMAIL_PASS },
      });

  await transporter.sendMail({ from: `"Vethos AI" <${FROM}>`, to, subject, html });
}

async function enviarEmailHistorial({ emailDestinatario, nombrePropietario, nombrePaciente, pdfUrl, nombreVet }) {
  const subject = `Historia Clínica - ${nombrePaciente || ''}`;
  const html = plantillaHtml({ nombrePropietario, nombrePaciente, pdfUrl, nombreVet });

  if (process.env.SENDGRID_API_KEY) {
    return enviarConSendGrid({ to: emailDestinatario, subject, html });
  }
  return enviarConSmtp({ to: emailDestinatario, subject, html });
}

module.exports = { enviarEmailHistorial, plantillaHtml };
