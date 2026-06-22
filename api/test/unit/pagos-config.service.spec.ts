import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PagosConfigService } from '../../src/modules/saas/pagos-config.service';
import { TenantSecretsService } from '../../src/modules/saas/tenant-secrets.service';
import type { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { validateEnv } from '../../src/common/config/env.schema';
import { fakeFirebase } from './saas.fakes';
import { pagosConfigDocInStore, seedWompiForPlanOwner } from './pagos-test-helpers';

function buildSecretManagerMock() {
  const values = new Map<string, string>();
  const client = {
    projectPath: jest.fn((projectId: string) => `projects/${projectId}`),
    secretPath: jest.fn((projectId: string, secretId: string) => `projects/${projectId}/secrets/${secretId}`),
    createSecret: jest.fn(async () => undefined),
    addSecretVersion: jest.fn(async ({ parent, payload }: { parent: string; payload: { data: Buffer } }) => {
      values.set(parent, payload.data.toString('utf8'));
    }),
    accessSecretVersion: jest.fn(async ({ name }: { name: string }) => {
      const parent = name.replace(/\/versions\/latest$/, '');
      const value = values.get(parent);
      return [{ payload: { data: value ? Buffer.from(value, 'utf8') : undefined } }];
    }),
  };
  return { client, values };
}

function buildPagosConfig() {
  const { fb, fs } = fakeFirebase();
  const tenantSecrets = new TenantSecretsService();
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'audit' }) };
  const svc = new PagosConfigService(fb, tenantSecrets, auditoria as never);
  return { svc, fs, tenantSecrets, auditoria };
}

const adminEntidad: AuthUserV2 = {
  uid: 'admin-ent',
  v: 2,
  role: 'admin_entidad',
  accountType: 'entidad',
  accountId: 'orgA',
  entidadId: 'orgA',
  planOwnerType: 'entidad',
  planOwnerId: 'orgA',
  orgId: 'orgA',
};

const adminVeterinariaIndep: AuthUserV2 = {
  uid: 'admin-vet',
  v: 2,
  role: 'admin_veterinaria',
  accountType: 'veterinaria',
  accountId: 'vet-clin',
  veterinariaId: 'vet-clin',
  planOwnerType: 'veterinaria',
  planOwnerId: 'vet-clin',
};

const vetIndependiente: AuthUserV2 = {
  uid: 'vet-ind',
  v: 2,
  role: 'veterinario',
  accountType: 'vet_individual',
  accountId: 'vet-ind',
  planOwnerType: 'vet',
  planOwnerId: 'vet_vet-ind',
};

const asistente: AuthUser = {
  uid: 'asist-1',
  orgId: 'orgA',
  rol: 'asistente',
};

const vetVinculado: AuthUserV2 = {
  uid: 'vet-staff',
  v: 2,
  role: 'veterinario',
  accountType: 'veterinaria',
  accountId: 'vet-clin',
  veterinariaId: 'vet-clin',
  planOwnerType: 'entidad',
  planOwnerId: 'ent-parent',
  vinculoTipo: 'staff',
};

const wompiInput = {
  publicKey: 'pub_test_key_12345678',
  privateKey: 'priv_test_key_12345678',
  eventsSecret: 'events_secret_12345678',
  integritySecret: 'integrity_secret_12345678',
};

describe('PagosConfigService', () => {
  it('checkout sin provider configurado devuelve error controlado', async () => {
    const { svc } = buildPagosConfig();
    await expect(svc.requireWompiCredentials({ planOwnerType: 'entidad', planOwnerId: 'orgA' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('admin_entidad puede configurar Wompi para su entidad', async () => {
    const { svc, fs } = buildPagosConfig();
    const view = await svc.configurarWompi(adminEntidad, wompiInput);
    expect(view.checkoutDisponible).toBe(true);
    expect(view.puedeConfigurar).toBe(true);
    const doc = pagosConfigDocInStore(fs, 'orgA');
    expect(doc?.estado).toBe('configurado');
    expect(doc?.secretPrivateKey).toContain('vetia-wompi-orgA-private');
    expect(doc).not.toHaveProperty('privateKey');
  });

  it('asistente no puede configurar Wompi', async () => {
    const { svc } = buildPagosConfig();
    await expect(svc.configurarWompi(asistente, wompiInput)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('vet vinculado no puede configurar plan heredado de entidad', async () => {
    const { svc } = buildPagosConfig();
    await expect(svc.configurarWompi(vetVinculado, wompiInput)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin_veterinaria puede configurar solo su veterinaria independiente', async () => {
    const { svc, fs } = buildPagosConfig();
    const view = await svc.configurarWompi(adminVeterinariaIndep, wompiInput);
    expect(view.planOwnerId).toBe('vet-clin');
    expect(pagosConfigDocInStore(fs, 'vet-clin')?.planOwnerType).toBe('veterinaria');
  });

  it('veterinario independiente configura su propia cuenta vet_{uid}', async () => {
    const { svc, fs } = buildPagosConfig();
    const view = await svc.configurarWompi(vetIndependiente, wompiInput);
    expect(view.planOwnerId).toBe('vet_vet-ind');
    expect(pagosConfigDocInStore(fs, 'vet_vet-ind')?.planOwnerType).toBe('vet');
  });

  it('Firestore no guarda secretos en claro', async () => {
    const { svc, fs } = buildPagosConfig();
    await svc.configurarWompi(adminEntidad, wompiInput);
    const raw = JSON.stringify(fs.store.get('pagosConfig/orgA'));
    expect(raw).not.toContain(wompiInput.publicKey);
    expect(raw).not.toContain(wompiInput.privateKey);
    expect(raw).not.toContain(wompiInput.eventsSecret);
    expect(raw).not.toContain(wompiInput.integritySecret);
  });

  it('usa Secret Manager persistente: crea secretos, agrega versiones y lee latest', async () => {
    const { svc, tenantSecrets } = buildPagosConfig();
    const { client } = buildSecretManagerMock();
    tenantSecrets.useSecretManagerClientForTests(client, 'vethosia-test');

    await svc.configurarWompi(adminEntidad, wompiInput);
    const creds = await svc.requireWompiCredentials({ planOwnerType: 'entidad', planOwnerId: 'orgA' });

    expect(client.createSecret).toHaveBeenCalledTimes(4);
    expect(client.addSecretVersion).toHaveBeenCalledTimes(4);
    expect(client.accessSecretVersion).toHaveBeenCalledTimes(4);
    expect(client.createSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: 'projects/vethosia-test',
        secretId: 'vetia-wompi-orgA-private',
      }),
    );
    expect(creds).toEqual(wompiInput);
  });

  it('si Secret Manager falla no deja metadata configurada falsa', async () => {
    const { svc, fs, tenantSecrets, auditoria } = buildPagosConfig();
    const { client } = buildSecretManagerMock();
    client.addSecretVersion.mockRejectedValueOnce(new Error('secret-manager-unavailable'));
    tenantSecrets.useSecretManagerClientForTests(client, 'vethosia-test');

    await expect(svc.configurarWompi(adminEntidad, wompiInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(pagosConfigDocInStore(fs, 'orgA')).toBeUndefined();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('getConfigPublic no devuelve secretos', async () => {
    const { svc, fs, tenantSecrets } = buildPagosConfig();
    seedWompiForPlanOwner(fs, tenantSecrets, 'orgA');
    const view = await svc.getConfigPublic(adminEntidad);
    expect(view).not.toHaveProperty('publicKey');
    expect(view).not.toHaveProperty('privateKey');
    expect(view.checkoutDisponible).toBe(true);
  });

  it('webhook sin config valida no expone credenciales', async () => {
    const { svc } = buildPagosConfig();
    const res = await svc.resolveWebhookCredentials({ planOwnerType: 'entidad', planOwnerId: 'orgA' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('pagos_no_configurados');
  });

  it('configura siempre el planOwner resuelto server-side (no body planOwnerId)', async () => {
    const { svc, fs } = buildPagosConfig();
    await svc.configurarWompi(adminEntidad, {
      ...wompiInput,
      planOwnerId: 'orgB',
    } as typeof wompiInput & { planOwnerId: string });
    expect(pagosConfigDocInStore(fs, 'orgA')).toBeDefined();
    expect(pagosConfigDocInStore(fs, 'orgB')).toBeUndefined();
  });
});

describe('validateEnv — Wompi global opcional', () => {
  it('permite boot en produccion sin WOMPI_* global', () => {

    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        STT_PROVIDER: 'openai',
        LLM_PROVIDER: 'anthropic',
        OPENAI_API_KEY: 'sk-test',
        ANTHROPIC_API_KEY: 'sk-ant-test',
        IA_WORKER_SECRET: 'x'.repeat(32),
        INVITE_SECRET: 'invite-secret-produccion-valido-test-only-48-chars',
      }),
    ).not.toThrow();
  });
});
