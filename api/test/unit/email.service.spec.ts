import { EmailService } from '../../src/modules/email/email.service';
import { validateEnv } from '../../src/common/config/env.schema';
import type { FirebaseService } from '../../src/common/firebase/firebase.service';
import { ConflictException } from '@nestjs/common';
import {
  EMAIL_PROVIDER_NOT_CONFIGURED,
  EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE,
} from '../../src/modules/email/email.service';

function fakeFirebase(): FirebaseService {
  return {
    firestore: {
      collection: () => ({
        doc: () => ({}),
      }),
      runTransaction: async (fn: (tx: { get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> }>; set: () => void }) => Promise<void>) => {
        const tx = {
          get: async () => ({ exists: false, data: () => ({}) }),
          set: () => undefined,
        };
        await fn(tx as never);
      },
    },
  } as unknown as FirebaseService;
}

describe('EmailService mock', () => {
  const emailEnvKeys = [
    'EMAIL_MOCK',
    'SENDGRID_API_KEY',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_FROM',
    'EMAIL_RATE_LIMIT_MAX',
    'EMAIL_RATE_LIMIT_WINDOW_MS',
  ] as const;
  const prevEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of emailEnvKeys) {
      prevEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of emailEnvKeys) {
      const value = prevEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    prevEnv.clear();
  });

  it('EMAIL_MOCK=true responde success sin SendGrid/SMTP', async () => {
    process.env.EMAIL_MOCK = 'true';
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_PASS;

    const svc = new EmailService(fakeFirebase());
    const res = await svc.enviarHistorial({
      emailDestinatario: 'dueno@example.com',
      nombrePropietario: 'Dueño',
      nombrePaciente: 'Max',
      nombreVet: 'Vet Local',
      pdfUrl: 'http://127.0.0.1:8081/v1/consultas/c1/pdf/download',
    });

    expect(res).toEqual(
      expect.objectContaining({ success: true, mock: true, messageId: expect.stringMatching(/^mock-\d+$/) }),
    );
  });

  it('rechaza destinatario invalido igual que en modo real', async () => {
    process.env.EMAIL_MOCK = 'true';
    const svc = new EmailService(fakeFirebase());
    await expect(
      svc.enviarHistorial({
        emailDestinatario: 'no-es-email',
        pdfUrl: 'http://127.0.0.1:8081/v1/x.pdf',
      }),
    ).rejects.toThrow(/invalido/i);
  });

  it('sin SendGrid/SMTP configurado devuelve 409 controlado antes de intentar enviar', async () => {
    process.env.EMAIL_MOCK = 'false';

    const svc = new EmailService(fakeFirebase());

    try {
      await svc.enviarHistorial({
        emailDestinatario: 'dueno@example.com',
        nombrePropietario: 'Dueno',
        nombrePaciente: 'Max',
        nombreVet: 'Vet Local',
        pdfUrl: 'https://vethosia.example/hc.pdf',
      });
      throw new Error('Expected email provider configuration error');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const httpError = err as ConflictException;
      expect(httpError.getStatus()).toBe(409);
      expect(httpError.getResponse()).toEqual(
        expect.objectContaining({
          code: EMAIL_PROVIDER_NOT_CONFIGURED,
          message: EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE,
        }),
      );
    }
  });

  it('rate limit por actor bloquea abuso', async () => {
    process.env.EMAIL_MOCK = 'true';
    process.env.EMAIL_RATE_LIMIT_MAX = '1';
    const fs = new Map<string, { timestamps: number[] }>();
    const fb = {
      firestore: {
        collection: () => ({
          doc: (id: string) => ({ id }),
        }),
        runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
          const tx = {
            get: async (ref: { id: string }) => ({
              exists: fs.has(ref.id),
              data: () => fs.get(ref.id),
            }),
            set: (ref: { id: string }, data: { timestamps: number[] }) => {
              fs.set(ref.id, data);
            },
          };
          await fn(tx);
        },
      },
    } as unknown as FirebaseService;
    const svc = new EmailService(fb);
    const base = {
      emailDestinatario: 'a@b.com',
      pdfUrl: 'http://127.0.0.1/x.pdf',
      actorUid: 'u1',
    };
    await svc.enviarHistorial(base);
    await expect(svc.enviarHistorial({ ...base, emailDestinatario: 'b@c.com' })).rejects.toThrow(
      /Demasiados envios/i,
    );
  });

  it('EMAIL_MOCK no permitido en produccion sin emulador', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        EMAIL_MOCK: 'true',
      } as NodeJS.ProcessEnv),
    ).toThrow(/EMAIL_MOCK/);
  });
});
