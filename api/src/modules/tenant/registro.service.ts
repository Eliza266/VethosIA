import { ConflictException, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { TenantService } from './tenant.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { RegistroPublicoDto } from './dto/registro-publico.dto';
import { LIMITE_TRIAL_DEFECTO } from '../saas/plan.types';

const DIAS_TRIAL = 7;
const PLAN_TRIAL_NOMBRE = 'Veterinario Individual';

export interface RegistroPublicoResultado {
  veterinariaId: string;
  trialHasta: string;
}

// Aprovisiona una cuenta nueva creada desde /registro: el uid de Firebase Auth ya
// existe (Google o email/password, creado desde el frontend); aca se crea su
// veterinaria independiente, su membresia como admin_veterinaria (owner) y su
// suscripcion de trial de 7 dias. No pasa por la whitelist de acceso: una cuenta
// que crea su propio tenant no necesita estar pre-autorizada, a diferencia de
// alguien que se suma a una veterinaria/entidad ya existente.
@Injectable()
export class RegistroService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly tenant: TenantService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async registrarNuevaCuenta(
    user: AuthUser,
    dto: RegistroPublicoDto,
  ): Promise<RegistroPublicoResultado> {
    if (user.accountId || user.orgId) {
      throw new ConflictException('Esta cuenta ya está registrada en Vethos AI.');
    }
    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new ConflictException('La cuenta de Firebase no tiene email asociado.');
    }

    const veterinaria = await this.tenant.upsertVeterinaria({
      nombre: dto.veterinariaNombre.trim(),
      ciudad: dto.ciudad?.trim(),
      pais: dto.pais?.trim() ?? 'Colombia',
      telefono: dto.telefono?.trim(),
      emailContacto: email,
      planOwnerType: 'veterinaria',
      estado: 'activa',
    });

    await this.tenant.asignarMiembroV2({
      uid: user.uid,
      email,
      rol: 'admin',
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: veterinaria.id,
      veterinariaId: veterinaria.id,
      planOwnerType: 'veterinaria',
      planOwnerId: veterinaria.id,
      vinculoTipo: 'owner',
    });

    await this.tenant.asegurarPerfilVeterinario(user.uid, { nombre: dto.nombre.trim(), email });
    await this.tenant.actualizarPerfilVeterinario(user.uid, {
      nombre: dto.nombre.trim(),
      telefono: dto.telefono?.trim(),
      whatsapp: dto.telefono?.trim(),
      ciudad: dto.ciudad?.trim(),
      pais: dto.pais?.trim(),
      veterinaria: dto.veterinariaNombre.trim(),
      matriculaProfesional: dto.matriculaProfesional.trim(),
    });

    const trialHasta = new Date(Date.now() + DIAS_TRIAL * 24 * 60 * 60 * 1000).toISOString();
    const planTrial = await this.firebase.firestore
      .collection(COLLECTIONS.planes)
      .where('nombre', '==', PLAN_TRIAL_NOMBRE)
      .limit(1)
      .get();
    const plan = planTrial.empty ? null : (planTrial.docs[0].data() as Record<string, unknown>);
    const planId = planTrial.empty ? null : planTrial.docs[0].id;
    const limiteHistoriasMes =
      typeof plan?.historiasGratisTrial === 'number' ? plan.historiasGratisTrial : LIMITE_TRIAL_DEFECTO;

    await this.firebase.firestore.collection(COLLECTIONS.suscripciones).add({
      planOwnerType: 'veterinaria',
      planOwnerId: veterinaria.id,
      veterinariaId: veterinaria.id,
      planId,
      estado: 'trial_activa',
      limiteHistoriasMes,
      asientosMax: 1,
      trialHasta,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    await this.firebase.firestore
      .collection(COLLECTIONS.configuracion)
      .doc('acceso')
      .set({ emailsPermitidos: admin.firestore.FieldValue.arrayUnion(email) }, { merge: true });

    await this.auditoria.registrar({
      accion: 'cuenta.autoregistro',
      actorUid: user.uid,
      orgId: null,
      recurso: veterinaria.id,
      meta: { email, veterinariaNombre: dto.veterinariaNombre.trim() },
    });

    return { veterinariaId: veterinaria.id, trialHasta };
  }
}
