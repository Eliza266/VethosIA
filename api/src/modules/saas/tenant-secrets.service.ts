import { Injectable, Logger } from '@nestjs/common';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

type SecretPayloadData = Buffer | Uint8Array | string;

interface SecretManagerClientLike {
  projectPath(projectId: string): string;
  secretPath(projectId: string, secretId: string): string;
  createSecret(request: {
    parent: string;
    secretId: string;
    secret: { replication: { automatic: Record<string, never> } };
  }): Promise<unknown>;
  addSecretVersion(request: {
    parent: string;
    payload: { data: Buffer };
  }): Promise<unknown>;
  accessSecretVersion(request: {
    name: string;
  }): Promise<Array<{ payload?: { data?: SecretPayloadData | null } } | undefined>>;
}

type SecretsBackend = 'gcp-secret-manager' | 'memory';

/**
 * Almacen server-side de secretos por tenant/planOwner.
 *
 * En Cloud Run production usa GCP Secret Manager. Firestore solo guarda nombres
 * de secreto; nunca valores. El backend en memoria existe solo para test/dev.
 */
@Injectable()
export class TenantSecretsService {
  private readonly logger = new Logger(TenantSecretsService.name);
  private readonly memory = new Map<string, string>();
  private secretManagerClient?: SecretManagerClientLike;
  private forcedBackend?: SecretsBackend;
  private projectIdForTests?: string;

  async putSecret(resourceName: string, value: string): Promise<void> {
    const secretId = this.secretIdFromResourceName(resourceName);
    if (!value) {
      throw new Error('value es obligatorio.');
    }

    if (this.backend() === 'memory') {
      this.memory.set(secretId, value);
      this.logger.log(`Secreto tenant actualizado en memoria local/test: ${secretId}`);
      return;
    }

    const client = this.client();
    const secretName = client.secretPath(this.projectId(), secretId);
    await this.ensureSecret(client, secretId, secretName);
    await client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(value, 'utf8') },
    });
    this.logger.log(`Version de secreto tenant agregada en Secret Manager: ${secretId}`);
  }

  async getSecret(resourceName: string): Promise<string | null> {
    const secretId = this.secretIdFromResourceName(resourceName);

    if (this.backend() === 'memory') {
      return this.memory.get(secretId) ?? null;
    }

    try {
      const client = this.client();
      const secretName = client.secretPath(this.projectId(), secretId);
      const [version] = await client.accessSecretVersion({
        name: `${secretName}/versions/latest`,
      });
      const data = version?.payload?.data;
      if (!data) return null;
      if (typeof data === 'string') return data;
      return Buffer.from(data).toString('utf8');
    } catch (err) {
      this.logger.warn(`No se pudo leer secreto tenant desde Secret Manager: ${secretId} (${this.safeError(err)})`);
      return null;
    }
  }

  async deleteSecret(resourceName: string): Promise<void> {
    const secretId = this.secretIdFromResourceName(resourceName);
    this.memory.delete(secretId);
    if (this.backend() === 'gcp-secret-manager') {
      this.logger.log(`Solicitud de borrado logico recibida para secreto tenant: ${secretId}`);
    }
  }

  /** Test helper: usa un mock de Secret Manager sin tocar GCP real. */
  useSecretManagerClientForTests(
    client: SecretManagerClientLike,
    projectId = 'vethosia-test',
  ): void {
    this.secretManagerClient = client;
    this.projectIdForTests = projectId;
    this.forcedBackend = 'gcp-secret-manager';
  }

  /** Test helper */
  clearAll(): void {
    this.memory.clear();
    this.secretManagerClient = undefined;
    this.projectIdForTests = undefined;
    this.forcedBackend = undefined;
  }

  private async ensureSecret(
    client: SecretManagerClientLike,
    secretId: string,
    secretName: string,
  ): Promise<void> {
    try {
      await client.createSecret({
        parent: client.projectPath(this.projectId()),
        secretId,
        secret: { replication: { automatic: {} } },
      });
      this.logger.log(`Secreto tenant creado en Secret Manager: ${secretId}`);
    } catch (err) {
      if (this.isAlreadyExists(err)) return;
      this.logger.warn(`No se pudo crear secreto tenant en Secret Manager: ${secretId} (${this.safeError(err)})`);
      throw err;
    }

    if (!secretName.endsWith(secretId)) {
      throw new Error('Secret Manager devolvio un nombre de secreto inconsistente.');
    }
  }

  private client(): SecretManagerClientLike {
    if (!this.secretManagerClient) {
      this.secretManagerClient = new SecretManagerServiceClient() as unknown as SecretManagerClientLike;
    }
    return this.secretManagerClient;
  }

  private backend(): SecretsBackend {
    if (this.forcedBackend) return this.forcedBackend;
    const isProd = process.env.NODE_ENV === 'production' && !process.env.FIRESTORE_EMULATOR_HOST;
    return isProd ? 'gcp-secret-manager' : 'memory';
  }

  private projectId(): string {
    const projectId =
      this.projectIdForTests ??
      process.env.GCLOUD_PROJECT ??
      process.env.FIREBASE_PROJECT_ID ??
      'vethosia-5895b';
    if (!projectId.trim()) {
      throw new Error('GCLOUD_PROJECT o FIREBASE_PROJECT_ID es obligatorio para Secret Manager.');
    }
    return projectId;
  }

  private secretIdFromResourceName(resourceName: string): string {
    if (!resourceName || !resourceName.trim()) {
      throw new Error('resourceName es obligatorio.');
    }
    const trimmed = resourceName.trim();
    const match = /^projects\/[^/]+\/secrets\/([^/]+)(?:\/versions\/[^/]+)?$/.exec(trimmed);
    const secretId = match?.[1] ?? trimmed;
    if (!/^[a-zA-Z0-9_-]{1,255}$/.test(secretId)) {
      throw new Error('Nombre de secreto tenant invalido.');
    }
    return secretId;
  }

  private isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: number | string; message?: string };
    return e.code === 6 || e.code === 'ALREADY_EXISTS' || /already exists/i.test(e.message ?? '');
  }

  private safeError(err: unknown): string {
    const e = err as { code?: number | string; message?: string };
    if (e.code) return `code=${e.code}`;
    return e.message ? e.message.slice(0, 120) : 'error';
  }
}
