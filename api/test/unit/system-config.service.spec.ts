import { SystemConfigService } from '../../src/modules/plataforma/system-config.service';

describe('SystemConfigService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_MOCK;
    delete process.env.WOMPI_PUBLIC_KEY;
    delete process.env.WOMPI_PRIVATE_KEY;
    delete process.env.WOMPI_EVENTS_SECRET;
    delete process.env.WOMPI_INTEGRITY_SECRET;
    delete process.env.IA_WORKER_URL;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('expone configuracion global segura sin secretos ni activar integraciones reales', () => {
    process.env.NODE_ENV = 'production';
    process.env.QUEUE_DRIVER = 'cloudtasks';
    process.env.IA_WORKER_URL = 'https://worker.example.test/run';
    process.env.WOMPI_PUBLIC_KEY = 'public-key-present';
    process.env.WOMPI_PRIVATE_KEY = 'private-key-present';
    process.env.WOMPI_EVENTS_SECRET = 'events-secret-present';
    process.env.WOMPI_INTEGRITY_SECRET = 'integrity-secret-present';

    const view = new SystemConfigService().obtener();

    expect(view.defaults.consumoAlertaPorcentaje).toBe(80);
    expect(view.integrations.whatsapp).toEqual({
      mode: 'safe_link_only',
      realApiEnabled: false,
    });
    expect(view.integrations.wompi).toMatchObject({
      mode: 'server_side_tenant_config',
      checkoutGlobalEnabled: false,
      globalSecretsPresent: true,
    });
    expect(view.integrations.jobs).toMatchObject({
      queueDriver: 'cloudtasks',
      schedulerAutoRunEnabled: false,
      workerGuard: 'x-worker-secret',
      workerUrlConfigured: true,
    });
    expect(JSON.stringify(view)).not.toContain('private-key-present');
    expect(JSON.stringify(view)).not.toContain('events-secret-present');
    expect(JSON.stringify(view)).not.toContain('integrity-secret-present');
  });

  it('marca email como mock o disabled sin requerir proveedor real', () => {
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_MOCK = 'true';

    expect(new SystemConfigService().obtener().integrations.email).toMatchObject({
      mode: 'mock',
      realProviderConfigured: false,
      mockAllowed: true,
    });

    process.env.EMAIL_MOCK = 'false';

    expect(new SystemConfigService().obtener().integrations.email).toMatchObject({
      mode: 'disabled',
      realProviderConfigured: false,
    });
  });
});
