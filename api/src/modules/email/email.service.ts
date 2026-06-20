import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailConfig, loadEmailConfig } from '../../common/config/env';
import { FirebaseService } from '../../common/firebase/firebase.service';

export interface EmailHistorialInput {
  emailDestinatario: string;
  nombrePropietario?: string;
  nombrePaciente?: string;
  pdfUrl: string;
  nombreVet?: string;
  actorUid?: string;
  orgId?: string | null;
}

export interface EmailHistorialResult {
  success: true;
  mock?: true;
  messageId?: string;
}

export const EMAIL_PROVIDER_NOT_CONFIGURED = 'EMAIL_PROVIDER_NOT_CONFIGURED';
export const EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'El envio por correo no esta configurado para esta cuenta. Usa Descargar PDF o WhatsApp mientras se habilita el proveedor.';

// Adaptador de email con dos proveedores intercambiables (SendGrid / SMTP). El resto del
// codigo no sabe cual se usa; se decide por env. Asi manana cambiar de SES a SendGrid es
// tocar config, no codigo.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly cfg: EmailConfig = loadEmailConfig();

  constructor(private readonly firebase: FirebaseService) {}

  async enviarHistorial(input: EmailHistorialInput): Promise<EmailHistorialResult> {
    this.assertDestinatarioValido(input.emailDestinatario);
    this.assertProviderConfigurado();
    await this.assertRateLimit(input.emailDestinatario);
    if (input.actorUid) {
      await this.assertRateLimitClave(`actor_${input.actorUid}`);
    }
    if (input.orgId) {
      await this.assertRateLimitClave(`org_${input.orgId}`);
    }

    if (this.cfg.mock) {
      const messageId = `mock-${Date.now()}`;
      this.logger.log(
        `[EMAIL_MOCK] historial simulado messageId=${messageId} ` +
          `destinatario=${input.emailDestinatario} ` +
          `paciente=${input.nombrePaciente ?? 'n/a'} ` +
          `vet=${input.nombreVet ?? 'n/a'} ` +
          `pdf=${this.resumirPdfUrl(input.pdfUrl)}`,
      );
      return { success: true, mock: true, messageId };
    }

    const subject = `Historia Clínica - ${input.nombrePaciente ?? ''}`;
    const html = this.plantilla(input);

    if (this.cfg.provider === 'sendgrid' && this.cfg.sendgridApiKey) {
      await this.enviarSendgrid(input.emailDestinatario, subject, html);
    } else {
      await this.enviarSmtp(input.emailDestinatario, subject, html);
    }
    return { success: true };
  }

  assertProviderConfigurado(): void {
    if (this.cfg.mock || this.cfg.sendgridApiKey || this.smtpConfigurado()) return;

    this.logger.warn('Envio de email rechazado: proveedor no configurado.');
    throw new ConflictException({
      code: EMAIL_PROVIDER_NOT_CONFIGURED,
      message: EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE,
    });
  }

  private smtpConfigurado(): boolean {
    return Boolean(this.cfg.smtp.pass && (this.cfg.smtp.user || this.cfg.from));
  }

  private resumirPdfUrl(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname + u.search;
      return path.length > 96 ? `${path.slice(0, 96)}…` : path;
    } catch {
      return '(url-invalida)';
    }
  }

  private async enviarSendgrid(to: string, subject: string, html: string): Promise<void> {
    // require perezoso para no exigir el paquete si no se usa SendGrid.
    const sg = await import('@sendgrid/mail');
    sg.default.setApiKey(this.cfg.sendgridApiKey as string);
    await sg.default.send({ to, from: this.cfg.from, subject, html });
  }

  private async enviarSmtp(to: string, subject: string, html: string): Promise<void> {
    const transporter = this.cfg.smtp.host
      ? nodemailer.createTransport({
          host: this.cfg.smtp.host,
          port: this.cfg.smtp.port,
          secure: this.cfg.smtp.secure,
          auth: { user: this.cfg.smtp.user, pass: this.cfg.smtp.pass },
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: this.cfg.smtp.user ?? this.cfg.from, pass: this.cfg.smtp.pass },
        });
    await transporter.sendMail({ from: `"Vethos AI" <${this.cfg.from}>`, to, subject, html });
  }

  private assertDestinatarioValido(email: string): void {
    // validacion simple; el DTO ya valida con class-validator, esto es doble cinturon.
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      throw new Error(`Email destinatario invalido: ${email}`);
    }
  }

  // Rate-limit GLOBAL (no por instancia): contador por destinatario en Firestore, dentro de
  // una transaccion, con ventana deslizante simple. Asi en Cloud Run con N instancias el
  // limite real es el configurado, no N x max.
  private async assertRateLimit(email: string): Promise<void> {
    const id = `email_${Buffer.from(email).toString('base64url')}`;
    await this.assertRateLimitClave(id);
  }

  private async assertRateLimitClave(suffix: string): Promise<void> {
    const now = Date.now();
    const ventana = this.cfg.rateLimitWindowMs;
    const id = suffix.startsWith('email_') ? suffix : `email_${suffix}`;
    const ref = this.firebase.firestore.collection('configuracion').doc(`rate_${id}`);

    await this.firebase.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) ?? {};
      const previos: number[] = Array.isArray(data.timestamps) ? (data.timestamps as number[]) : [];
      const vigentes = previos.filter((t) => now - t < ventana);
      if (vigentes.length >= this.cfg.rateLimitMax) {
        throw new Error('Demasiados envios a este destinatario, intenta mas tarde.');
      }
      vigentes.push(now);
      tx.set(ref, { timestamps: vigentes }, { merge: true });
    });
  }

  private plantilla(input: EmailHistorialInput): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0F6E56; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Vethos AI</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hola <strong>${input.nombrePropietario ?? ''}</strong>,</p>
          <p>Adjunto la historia clínica de <strong>${input.nombrePaciente ?? ''}</strong> generada por el Dr(a). <strong>${input.nombreVet ?? ''}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${input.pdfUrl}" style="background: #0F6E56; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
              Descargar Historia Clínica
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">Generado por Vethos AI</p>
        </div>
      </div>
    `;
  }
}
