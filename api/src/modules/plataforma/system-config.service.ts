import { Injectable } from '@nestjs/common';
import { SYSTEM_CONFIG } from './system-config';

export interface SystemConfigPublicView {
  defaults: typeof SYSTEM_CONFIG;
  integrations: {
    email: {
      mode: 'mock' | 'provider_configured' | 'disabled';
      realProviderConfigured: boolean;
      mockAllowed: boolean;
    };
    whatsapp: {
      mode: 'safe_link_only';
      realApiEnabled: false;
    };
    wompi: {
      mode: 'server_side_tenant_config';
      checkoutGlobalEnabled: false;
      globalSecretsPresent: boolean;
      baseUrl: string;
    };
    jobs: {
      queueDriver: string;
      schedulerAutoRunEnabled: false;
      workerGuard: 'x-worker-secret';
      workerUrlConfigured: boolean;
    };
  };
  notes: string[];
}

@Injectable()
export class SystemConfigService {
  obtener(): SystemConfigPublicView {
    const emailProviderConfigured = Boolean(
      process.env.SENDGRID_API_KEY ||
        (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS),
    );
    const emailMock = process.env.EMAIL_MOCK === 'true' || process.env.EMAIL_MOCK === '1';
    const wompiGlobalSecretsPresent = Boolean(
      process.env.WOMPI_PUBLIC_KEY &&
        process.env.WOMPI_PRIVATE_KEY &&
        process.env.WOMPI_EVENTS_SECRET &&
        process.env.WOMPI_INTEGRITY_SECRET,
    );

    return {
      defaults: SYSTEM_CONFIG,
      integrations: {
        email: {
          mode: emailMock ? 'mock' : emailProviderConfigured ? 'provider_configured' : 'disabled',
          realProviderConfigured: emailProviderConfigured,
          mockAllowed: process.env.NODE_ENV !== 'production',
        },
        whatsapp: {
          mode: 'safe_link_only',
          realApiEnabled: false,
        },
        wompi: {
          mode: 'server_side_tenant_config',
          checkoutGlobalEnabled: false,
          globalSecretsPresent: wompiGlobalSecretsPresent,
          baseUrl: process.env.WOMPI_BASE_URL ?? 'https://sandbox.wompi.co/v1',
        },
        jobs: {
          queueDriver: process.env.QUEUE_DRIVER ?? 'inmemory',
          schedulerAutoRunEnabled: false,
          workerGuard: 'x-worker-secret',
          workerUrlConfigured: Boolean(process.env.IA_WORKER_URL),
        },
      },
      notes: [
        'Vista read-only para Super Admin.',
        'No expone secretos ni activa email, WhatsApp API, Wompi real o scheduler.',
        'Los cambios persistentes de configuracion global requieren flujo separado aprobado.',
      ],
    };
  }
}
