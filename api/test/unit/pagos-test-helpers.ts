import { COLLECTIONS } from '../../src/common/firebase/collections';
import type { PlanOwnerTypeV2 } from '../../src/common/auth/auth-user.interface';
import { wompiSecretResourceName } from '../../src/modules/saas/pagos-secret-names';
import type { PagosConfigDoc } from '../../src/modules/saas/pagos-config.types';
import type { TenantSecretsService } from '../../src/modules/saas/tenant-secrets.service';
import type { FakeFirestore } from './saas.fakes';

export interface WompiTestSecrets {
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
}

export const DEFAULT_WOMPI_TEST_SECRETS: WompiTestSecrets = {
  publicKey: 'pub_test_key_12345678',
  privateKey: 'priv_test_key_12345678',
  eventsSecret: 'test_events_secret',
  integritySecret: 'priv',
};

export function seedWompiForPlanOwner(
  fs: FakeFirestore,
  tenantSecrets: TenantSecretsService,
  planOwnerId: string,
  secrets: Partial<WompiTestSecrets> = {},
  planOwnerType: PlanOwnerTypeV2 = 'entidad',
): WompiTestSecrets {
  const merged = { ...DEFAULT_WOMPI_TEST_SECRETS, ...secrets };
  const secretPublicKey = wompiSecretResourceName(planOwnerId, 'public');
  const secretPrivateKey = wompiSecretResourceName(planOwnerId, 'private');
  const secretEventsSecret = wompiSecretResourceName(planOwnerId, 'events');
  const secretIntegritySecret = wompiSecretResourceName(planOwnerId, 'integrity');

  void tenantSecrets.putSecret(secretPublicKey, merged.publicKey);
  void tenantSecrets.putSecret(secretPrivateKey, merged.privateKey);
  void tenantSecrets.putSecret(secretEventsSecret, merged.eventsSecret);
  void tenantSecrets.putSecret(secretIntegritySecret, merged.integritySecret);

  const doc: PagosConfigDoc = {
    planOwnerId,
    planOwnerType,
    provider: 'wompi',
    estado: 'configurado',
    secretPublicKey,
    secretPrivateKey,
    secretEventsSecret,
    secretIntegritySecret,
  };
  fs.store.set(`${COLLECTIONS.pagosConfig}/${planOwnerId}`, doc as unknown as Record<string, unknown>);
  return merged;
}

export function pagosConfigDocInStore(
  fs: FakeFirestore,
  planOwnerId: string,
): PagosConfigDoc | undefined {
  return fs.store.get(`${COLLECTIONS.pagosConfig}/${planOwnerId}`) as PagosConfigDoc | undefined;
}
