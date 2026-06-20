import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuthUser } from '../../common/auth/auth-user.interface';
import { COLLECTIONS } from '../../common/firebase/collections';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import {
  planOwnerFromUser,
  puedeConfigurarPagos,
  type PlanOwnerScope,
} from './pagos-plan-owner';
import type {
  PagosConfigDoc,
  PagosConfigPublicView,
  PagosProviderEstado,
  WompiCredentials,
} from './pagos-config.types';
import { wompiSecretResourceName } from './pagos-secret-names';
import { TenantSecretsService } from './tenant-secrets.service';

export interface ConfigurarWompiInput {
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
}

@Injectable()
export class PagosConfigService {
  constructor(
    private readonly fb: FirebaseService,
    private readonly tenantSecrets: TenantSecretsService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async getConfigPublic(user: AuthUser): Promise<PagosConfigPublicView> {
    const scope = this.requireScope(user);
    const doc = await this.loadDoc(scope.planOwnerId);
    const puedeConfigurar = puedeConfigurarPagos(user, scope);
    if (!doc) {
      return {
        planOwnerId: scope.planOwnerId,
        planOwnerType: scope.planOwnerType,
        provider: 'wompi',
        estado: 'incompleto',
        checkoutDisponible: false,
        puedeConfigurar,
        updatedAt: null,
      };
    }
    const checkoutDisponible = doc.estado === 'configurado';
    return {
      planOwnerId: doc.planOwnerId,
      planOwnerType: doc.planOwnerType,
      provider: doc.provider,
      estado: doc.estado,
      checkoutDisponible,
      puedeConfigurar,
      updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
    };
  }

  async configurarWompi(user: AuthUser, input: ConfigurarWompiInput): Promise<PagosConfigPublicView> {
    const scope = this.requireScope(user);
    if (!puedeConfigurarPagos(user, scope)) {
      throw new ForbiddenException('No tienes permiso para configurar pagos en linea.');
    }
    this.assertNonEmptySecrets(input);

    const secretPublicKey = wompiSecretResourceName(scope.planOwnerId, 'public');
    const secretPrivateKey = wompiSecretResourceName(scope.planOwnerId, 'private');
    const secretEventsSecret = wompiSecretResourceName(scope.planOwnerId, 'events');
    const secretIntegritySecret = wompiSecretResourceName(scope.planOwnerId, 'integrity');

    try {
      await this.tenantSecrets.putSecret(secretPublicKey, input.publicKey.trim());
      await this.tenantSecrets.putSecret(secretPrivateKey, input.privateKey.trim());
      await this.tenantSecrets.putSecret(secretEventsSecret, input.eventsSecret.trim());
      await this.tenantSecrets.putSecret(secretIntegritySecret, input.integritySecret.trim());
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible persistir las credenciales Wompi. La configuracion no fue guardada.',
      );
    }

    const doc: PagosConfigDoc = {
      planOwnerId: scope.planOwnerId,
      planOwnerType: scope.planOwnerType,
      provider: 'wompi',
      estado: 'configurado',
      secretPublicKey,
      secretPrivateKey,
      secretEventsSecret,
      secretIntegritySecret,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
    };

    await this.fb.firestore.collection(COLLECTIONS.pagosConfig).doc(scope.planOwnerId).set(doc);

    await this.auditoria.registrar({
      accion: 'pagos.wompi.configurado',
      orgId: scope.planOwnerType === 'entidad' ? scope.planOwnerId : user.orgId ?? null,
      actorUid: user.uid,
      meta: { planOwnerId: scope.planOwnerId, planOwnerType: scope.planOwnerType },
    });

    return this.getConfigPublic(user);
  }

  async deshabilitarWompi(user: AuthUser): Promise<PagosConfigPublicView> {
    const scope = this.requireScope(user);
    if (!puedeConfigurarPagos(user, scope) && user.rol !== 'superadmin') {
      throw new ForbiddenException('No tienes permiso para deshabilitar pagos en linea.');
    }
    const ref = this.fb.firestore.collection(COLLECTIONS.pagosConfig).doc(scope.planOwnerId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new NotFoundException('No hay configuracion de pagos para esta cuenta.');
    }
    await ref.set(
      {
        estado: 'deshabilitado' satisfies PagosProviderEstado,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid,
      },
      { merge: true },
    );
    await this.auditoria.registrar({
      accion: 'pagos.wompi.deshabilitado',
      orgId: scope.planOwnerType === 'entidad' ? scope.planOwnerId : user.orgId ?? null,
      actorUid: user.uid,
      meta: { planOwnerId: scope.planOwnerId },
    });
    return this.getConfigPublic(user);
  }

  async requireWompiCredentials(scope: PlanOwnerScope): Promise<WompiCredentials> {
    const doc = await this.loadDoc(scope.planOwnerId);
    if (!doc || doc.estado !== 'configurado') {
      throw new ServiceUnavailableException(
        'Pagos en linea no configurados para esta cuenta. Configure Wompi antes de continuar.',
      );
    }
    const [publicKey, privateKey, eventsSecret, integritySecret] = await Promise.all([
      this.tenantSecrets.getSecret(doc.secretPublicKey),
      this.tenantSecrets.getSecret(doc.secretPrivateKey),
      this.tenantSecrets.getSecret(doc.secretEventsSecret),
      this.tenantSecrets.getSecret(doc.secretIntegritySecret),
    ]);
    if (!publicKey || !privateKey || !eventsSecret || !integritySecret) {
      throw new ServiceUnavailableException(
        'Pagos en linea incompletos para esta cuenta. Revise la configuracion de Wompi.',
      );
    }
    return { publicKey, privateKey, eventsSecret, integritySecret };
  }

  async resolveWebhookCredentials(
    scope: PlanOwnerScope,
  ): Promise<{ ok: true; credentials: WompiCredentials } | { ok: false; reason: string }> {
    const doc = await this.loadDoc(scope.planOwnerId);
    if (!doc || doc.estado !== 'configurado') {
      return { ok: false, reason: 'pagos_no_configurados' };
    }
    try {
      const credentials = await this.requireWompiCredentials(scope);
      return { ok: true, credentials };
    } catch {
      return { ok: false, reason: 'pagos_incompletos' };
    }
  }

  private requireScope(user: AuthUser): PlanOwnerScope {
    const scope = planOwnerFromUser(user);
    if (!scope) {
      throw new ForbiddenException('No se pudo resolver la cuenta de facturacion.');
    }
    return scope;
  }

  private async loadDoc(planOwnerId: string): Promise<PagosConfigDoc | null> {
    const snap = await this.fb.firestore.collection(COLLECTIONS.pagosConfig).doc(planOwnerId).get();
    if (!snap.exists) return null;
    return snap.data() as PagosConfigDoc;
  }

  private assertNonEmptySecrets(input: ConfigurarWompiInput): void {
    for (const [k, v] of Object.entries(input)) {
      if (!v || !String(v).trim()) {
        throw new ForbiddenException(`El campo ${k} es obligatorio.`);
      }
    }
  }
}
