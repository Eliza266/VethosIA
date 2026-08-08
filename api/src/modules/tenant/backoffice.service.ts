import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AuthUser, PlanOwnerTypeV2, Rol, RolV2 } from '../../common/auth/auth-user.interface';
import { COLLECTIONS, periodoActual } from '../../common/firebase/collections';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { SuscripcionesService } from '../saas/suscripciones.service';
import { TenantService, EntidadDoc, MiembroDoc, VeterinariaDoc } from './tenant.service';
import {
  ActualizarEntidadBackofficeDto,
  ActualizarVeterinariaBackofficeDto,
  CrearEntidadBackofficeDto,
  CrearVeterinarioCredencialesDto,
  CrearVeterinariaBackofficeDto,
} from './dto/backoffice.dto';

interface ScopeVeterinario {
  orgId?: string;
  accountId: string;
  veterinariaId: string;
  entidadId?: string;
  planOwnerType: PlanOwnerTypeV2;
  planOwnerId: string;
}

export type BackofficeRol = 'superadmin' | 'admin_entidad' | 'admin_veterinaria' | 'veterinario';

export interface BackofficePermisos {
  rol: BackofficeRol;
  alcance: 'global' | 'entidad' | 'veterinaria' | 'individual';
  puedeEditarEntidad: boolean;
  puedeGestionarVeterinarias: boolean;
  puedeGestionarMiembros: boolean;
  puedeResolverSolicitudesTecnicas: boolean;
  puedeVerAuditoriaGlobal: boolean;
}

export interface BackofficeMiembro extends MiembroDoc {
  id: string;
  bloqueado: boolean;
  email?: string | null;
}

export interface BackofficeConsumo {
  id: string;
  periodo?: string;
  scopeId?: string;
  orgId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  veterinarioId?: string | null;
  usados: number;
  limite?: number | null;
  porcentaje?: number | null;
  bloqueado: boolean;
}

@Injectable()
export class BackofficeService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly tenant: TenantService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly subs: SuscripcionesService,
  ) {}

  permisos(user: AuthUser): BackofficePermisos {
    const rol = this.rolCanonico(user);
    return {
      rol,
      alcance:
        rol === 'superadmin'
          ? 'global'
          : rol === 'admin_entidad'
            ? 'entidad'
            : rol === 'admin_veterinaria'
              ? 'veterinaria'
              : 'individual',
      puedeEditarEntidad: rol === 'admin_entidad' || rol === 'superadmin',
      puedeGestionarVeterinarias: rol === 'admin_entidad' || rol === 'superadmin',
      puedeGestionarMiembros: rol === 'admin_entidad' || rol === 'admin_veterinaria' || rol === 'superadmin',
      puedeResolverSolicitudesTecnicas: rol === 'superadmin',
      puedeVerAuditoriaGlobal: rol === 'superadmin',
    };
  }

  async listarEntidades(user: AuthUser): Promise<EntidadDoc[]> {
    const rol = this.rolCanonico(user);
    if (rol === 'superadmin') {
      const snap = await this.firebase.firestore.collection(COLLECTIONS.entidades).get();
      return snap.docs.map((doc) => this.mapEntidad(doc)).filter(Boolean) as EntidadDoc[];
    }
    if (rol !== 'admin_entidad') throw new ForbiddenException('Tu rol no permite listar entidades.');
    const propia = await this.obtenerEntidadActual(user);
    return propia ? [propia] : [];
  }

  async crearEntidadGlobal(user: AuthUser, dto: CrearEntidadBackofficeDto): Promise<EntidadDoc> {
    this.assertSuperadmin(user);
    const ref = this.firebase.firestore.collection(COLLECTIONS.entidades).doc();
    const payload = stripUndefined({
      nombre: dto.nombre,
      tipo: dto.tipo,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      pais: dto.pais,
      telefono: dto.telefono,
      emailContacto: dto.emailContacto,
      logoUrl: dto.logoUrl,
      estado: dto.estado ?? 'activa',
      planOwnerType: 'entidad',
      planOwnerId: ref.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await ref.set(payload);
    await this.auditoria.registrar({
      accion: 'entidad.crear',
      actorUid: user.uid,
      orgId: null,
      recurso: ref.id,
      meta: { entidadId: ref.id },
    });
    const snap = await ref.get();
    const entidad = this.mapEntidad(snap);
    if (!entidad) throw new NotFoundException('Entidad no encontrada.');
    return entidad;
  }

  async actualizarEntidadGlobal(
    user: AuthUser,
    id: string,
    dto: ActualizarEntidadBackofficeDto,
  ): Promise<EntidadDoc> {
    this.assertSuperadmin(user);
    const ref = this.firebase.firestore.collection(COLLECTIONS.entidades).doc(id);
    const actual = await ref.get();
    if (!actual.exists) throw new NotFoundException('Entidad no encontrada.');

    const payload = stripUndefined({
      nombre: dto.nombre,
      tipo: dto.tipo,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      pais: dto.pais,
      telefono: dto.telefono,
      emailContacto: dto.emailContacto,
      logoUrl: dto.logoUrl,
      estado: dto.estado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (Object.keys(payload).length > 0) {
      await ref.set(payload, { merge: true });
      await this.auditoria.registrar({
        accion: 'entidad.editar',
        actorUid: user.uid,
        orgId: null,
        recurso: id,
        meta: { entidadId: id },
      });
    }
    const updated = await ref.get();
    const entidad = this.mapEntidad(updated);
    if (!entidad) throw new NotFoundException('Entidad no encontrada.');
    return entidad;
  }

  async obtenerEntidadActual(user: AuthUser): Promise<EntidadDoc | null> {
    this.assertAdminEntidad(user);
    if (user.entidadId) {
      const snap = await this.firebase.firestore.collection(COLLECTIONS.entidades).doc(user.entidadId).get();
      if (snap.exists) return this.mapEntidad(snap);
    }
    if (!user.orgId) return null;
    const snap = await this.firebase.firestore.collection(COLLECTIONS.organizaciones).doc(user.orgId).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return {
      id: snap.id,
      nombre: str(data.nombre) ?? 'Entidad',
      tipo: parseTipoEntidad(data.tipo) ?? null,
      direccion: str(data.direccion) ?? null,
      ciudad: str(data.ciudad) ?? null,
      pais: str(data.pais) ?? null,
      telefono: str(data.telefono) ?? null,
      emailContacto: str(data.emailContacto) ?? str(data.email) ?? str(data.correo) ?? null,
      logoUrl: str(data.logoUrl) ?? str(data.logo) ?? null,
      estado: data.estado === 'inactiva' ? 'inactiva' : 'activa',
      legacyOrgId: snap.id,
      planOwnerType: 'entidad',
      planOwnerId: user.entidadId ?? snap.id,
      createdAt: data.creadoEn,
      updatedAt: data.actualizadoEn,
    };
  }

  async actualizarEntidadActual(
    user: AuthUser,
    dto: ActualizarEntidadBackofficeDto,
  ): Promise<EntidadDoc | null> {
    this.assertAdminEntidad(user);
    const payload = stripUndefined({
      nombre: dto.nombre,
      tipo: dto.tipo,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      pais: dto.pais,
      telefono: dto.telefono,
      emailContacto: dto.emailContacto,
      logoUrl: dto.logoUrl,
      estado: dto.estado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (Object.keys(payload).length === 0) return this.obtenerEntidadActual(user);

    const id = user.entidadId ?? user.orgId;
    if (!id) throw new ForbiddenException('No hay entidad asociada a tu cuenta.');
    const collection = user.entidadId ? COLLECTIONS.entidades : COLLECTIONS.organizaciones;
    await this.firebase.firestore.collection(collection).doc(id).set(payload, { merge: true });
    await this.auditoria.registrar({
      accion: 'organizacion.editar',
      actorUid: user.uid,
      orgId: user.orgId ?? id,
      recurso: id,
      meta: { collection },
    });
    return this.obtenerEntidadActual(user);
  }

  async listarVeterinarias(user: AuthUser): Promise<VeterinariaDoc[]> {
    const rol = this.rolCanonico(user);
    const snap = await this.firebase.firestore.collection(COLLECTIONS.veterinarias).get();
    const items = snap.docs.map((doc) => this.mapVeterinaria(doc)).filter(Boolean) as VeterinariaDoc[];
    if (rol === 'superadmin') return items;
    if (rol === 'admin_entidad') {
      return items.filter((v) => this.veterinariaVisibleParaAdminEntidad(user, v));
    }
    if (rol === 'admin_veterinaria') {
      return items.filter((v) => this.veterinariaMatchesUser(v, user));
    }
    throw new ForbiddenException('Tu rol no permite listar veterinarias.');
  }

  async obtenerVeterinariaActual(user: AuthUser): Promise<VeterinariaDoc | null> {
    this.assertAdminVeterinaria(user);
    const veterinariaId = user.veterinariaId ?? user.accountId;
    if (!veterinariaId) throw new ForbiddenException('Admin Veterinaria requiere veterinariaId.');
    const doc = await this.tenant.obtenerVeterinaria(veterinariaId);
    if (!doc) return null;
    this.assertPuedeOperarVeterinaria(user, doc);
    return doc;
  }

  async crearVeterinaria(user: AuthUser, dto: CrearVeterinariaBackofficeDto): Promise<VeterinariaDoc> {
    const rol = this.rolCanonico(user);
    if (rol !== 'admin_entidad' && rol !== 'superadmin') {
      throw new ForbiddenException('Tu rol no permite crear veterinarias.');
    }
    const entidadId = rol === 'superadmin' ? dto.entidadId : user.entidadId ?? user.orgId ?? undefined;
    let entidadDestino: EntidadDoc | null = null;
    if (rol === 'superadmin') {
      if (!entidadId) {
        throw new BadRequestException('Crear sedes desde Super Admin requiere entidadId objetivo.');
      }
      entidadDestino = await this.obtenerEntidadPorId(entidadId);
      if (!entidadDestino) throw new NotFoundException('Entidad objetivo no encontrada.');
    }
    if (rol === 'admin_entidad' && !entidadId) {
      throw new ForbiddenException('Admin Entidad requiere entidadId/orgId.');
    }
    if (rol === 'admin_entidad' && dto.entidadId && dto.entidadId !== entidadId) {
      throw new ForbiddenException('No puedes crear sedes para otra entidad.');
    }
    const vet = await this.tenant.upsertVeterinaria({
      veterinariaId: dto.veterinariaId,
      nombre: dto.nombre,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      pais: dto.pais,
      telefono: dto.telefono,
      emailContacto: dto.emailContacto,
      logoUrl: dto.logoUrl,
      entidadId: entidadId ?? null,
      orgId: rol === 'superadmin' ? entidadDestino?.legacyOrgId ?? null : user.orgId ?? null,
      legacyOrgId: rol === 'superadmin' ? entidadDestino?.legacyOrgId ?? null : user.orgId ?? null,
      planOwnerType: dto.planOwnerType ?? 'entidad',
      planOwnerId: dto.planOwnerType === 'veterinaria' ? dto.veterinariaId : entidadId,
      estado: 'activa',
    });
    await this.auditoria.registrar({
      accion: 'veterinaria.crear',
      actorUid: user.uid,
      orgId: user.orgId ?? entidadId ?? null,
      recurso: vet.id,
      meta: { entidadId: vet.entidadId ?? null },
    });
    return vet;
  }

  // Alta de veterinario con credenciales (email + contraseña temporal). A diferencia de las
  // invitaciones por enlace, el admin crea la cuenta directamente con Admin SDK. El veterinario
  // luego cambia su contraseña desde su perfil. Restringido a admin_veterinaria/admin_entidad/superadmin.
  async crearVeterinarioConCredenciales(
    user: AuthUser,
    dto: CrearVeterinarioCredencialesDto,
  ): Promise<BackofficeMiembro> {
    const rol = this.rolCanonico(user);
    if (rol !== 'admin_veterinaria' && rol !== 'admin_entidad' && rol !== 'superadmin') {
      throw new ForbiddenException('Tu rol no permite crear veterinarios.');
    }
    const scope = await this.resolverScopeVeterinario(user, dto.veterinariaId);

    const disponibles = await this.subs.asientosDisponibles({
      ...user,
      orgId: scope.orgId ?? user.orgId,
      accountType: 'veterinaria',
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
    } as AuthUser);
    if (disponibles.libres <= 0) {
      throw new BadRequestException('No hay asientos disponibles en el plan de la veterinaria.');
    }

    const email = dto.email.trim().toLowerCase();
    const nombre = dto.nombre.trim();
    const uid = await this.crearUsuarioAuth(email, dto.password, nombre);

    const miembro = await this.tenant.asignarMiembroV2({
      uid,
      email,
      orgId: scope.orgId,
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      vinculoTipo: 'staff',
    });

    await this.tenant.asegurarPerfilVeterinario(uid, { nombre, email });
    await this.permitirEmailEnWhitelist(email);

    await this.auditoria.registrar({
      accion: 'veterinario.crear_credenciales',
      actorUid: user.uid,
      orgId: scope.orgId ?? user.orgId ?? null,
      recurso: uid,
      meta: { email, veterinariaId: scope.veterinariaId },
    });

    return {
      id: miembro.membershipId ?? uid,
      uid,
      email,
      orgId: miembro.orgId,
      rol: miembro.rol,
      role: miembro.role,
      accountType: miembro.accountType,
      accountId: miembro.accountId,
      entidadId: miembro.entidadId,
      veterinariaId: miembro.veterinariaId,
      membershipId: miembro.membershipId,
      planOwnerType: miembro.planOwnerType,
      planOwnerId: miembro.planOwnerId,
      vinculoTipo: miembro.vinculoTipo,
      estado: miembro.estado,
      bloqueado: false,
    };
  }

  // El login server-side valida configuracion/acceso.emailsPermitidos. Sin esto, el veterinario
  // recien creado recibiria 403 en /v1/me. El email se guarda en minusculas (igual que el token).
  private async permitirEmailEnWhitelist(email: string): Promise<void> {
    await this.firebase.firestore
      .collection(COLLECTIONS.configuracion)
      .doc('acceso')
      .set(
        { emailsPermitidos: admin.firestore.FieldValue.arrayUnion(email.toLowerCase()) },
        { merge: true },
      );
  }

  private async crearUsuarioAuth(email: string, password: string, nombre: string): Promise<string> {
    try {
      await this.firebase.auth.getUserByEmail(email);
      throw new ConflictException(`Ya existe un usuario con el email ${email}.`);
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    }
    const created = await this.firebase.auth.createUser({
      email,
      password,
      displayName: nombre,
      emailVerified: true,
    });
    return created.uid;
  }

  private async resolverScopeVeterinario(
    user: AuthUser,
    veterinariaIdInput?: string,
  ): Promise<ScopeVeterinario> {
    const rol = this.rolCanonico(user);
    let veterinariaId: string | undefined;
    if (rol === 'admin_veterinaria') {
      veterinariaId = user.veterinariaId ?? user.accountId;
      if (veterinariaIdInput && veterinariaIdInput !== veterinariaId) {
        throw new ForbiddenException('No puedes crear veterinarios en otra sede.');
      }
    } else {
      veterinariaId = veterinariaIdInput;
      if (!veterinariaId) {
        throw new BadRequestException('veterinariaId requerido para crear el veterinario.');
      }
    }
    if (!veterinariaId) {
      throw new ForbiddenException('No hay una veterinaria en tu scope para vincular al veterinario.');
    }
    const vet = await this.tenant.obtenerVeterinaria(veterinariaId);
    if (!vet) throw new NotFoundException('Veterinaria no encontrada.');
    this.assertPuedeOperarVeterinaria(user, vet);
    return {
      orgId: vet.orgId ?? vet.legacyOrgId ?? undefined,
      accountId: vet.accountId,
      veterinariaId: vet.id,
      entidadId: vet.entidadId ?? undefined,
      planOwnerType: vet.planOwnerType,
      planOwnerId: vet.planOwnerId,
    };
  }

  async actualizarVeterinaria(
    user: AuthUser,
    id: string,
    dto: ActualizarVeterinariaBackofficeDto,
  ): Promise<VeterinariaDoc> {
    const actual = await this.tenant.obtenerVeterinaria(id);
    if (!actual) throw new NotFoundException('Veterinaria no encontrada.');
    this.assertPuedeOperarVeterinaria(user, actual);
    const payload = stripUndefined({
      nombre: dto.nombre,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      pais: dto.pais,
      telefono: dto.telefono,
      emailContacto: dto.emailContacto,
      logoUrl: dto.logoUrl,
      estado: dto.estado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (Object.keys(payload).length > 0) {
      await this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc(id).set(payload, { merge: true });
      await this.auditoria.registrar({
        accion: 'veterinaria.editar',
        actorUid: user.uid,
        orgId: actual.orgId ?? user.orgId ?? null,
        recurso: id,
        meta: { entidadId: actual.entidadId ?? null },
      });
    }
    const updated = await this.tenant.obtenerVeterinaria(id);
    if (!updated) throw new NotFoundException('Veterinaria no encontrada.');
    return updated;
  }

  async listarMiembros(user: AuthUser): Promise<BackofficeMiembro[]> {
    const rol = this.rolCanonico(user);
    if (rol === 'veterinario') throw new ForbiddenException('Veterinario no accede al backoffice admin.');
    const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).get();
    return snap.docs
      .map((doc) => this.mapMiembro(doc))
      .filter((m): m is BackofficeMiembro => m !== null)
      .filter((m) => this.miembroVisiblePara(user, m));
  }

  async listarVeterinarios(user: AuthUser): Promise<BackofficeMiembro[]> {
    return (await this.listarMiembros(user)).filter((m) => m.role === 'veterinario' || m.rol === 'vet');
  }

  async setBloqueoMiembro(
    user: AuthUser,
    memberId: string,
    bloqueado: boolean,
  ): Promise<{ id: string; uid: string; bloqueado: boolean }> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(memberId).get();
    if (!snap.exists) throw new NotFoundException('Miembro no encontrado.');
    const miembro = this.mapMiembro(snap);
    if (!miembro || !this.miembroVisiblePara(user, miembro)) {
      throw new ForbiddenException('No puedes modificar miembros fuera de tu scope.');
    }
    const uid = miembro.uid ?? memberId;
    if (bloqueado && uid === user.uid) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta desde esta sesion.');
    }
    await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(memberId).set(
      {
        bloqueado,
        estado: bloqueado ? 'bloqueado' : 'activo',
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    try {
      await this.firebase.auth.updateUser(uid, { disabled: bloqueado });
    } catch {
      /* tests/local pueden no tener Auth real */
    }
    await this.auditoria.registrar({
      accion: bloqueado ? 'miembro.desactivar' : 'miembro.activar',
      actorUid: user.uid,
      orgId: miembro.orgId ?? user.orgId ?? null,
      recurso: memberId,
      meta: { uid, role: miembro.role ?? miembro.rol },
    });
    await this.notificaciones.crear({
      destinatarioUid: uid,
      orgId: miembro.orgId ?? user.orgId ?? null,
      tipo: bloqueado ? 'miembro_desactivado' : 'miembro_activado',
      titulo: bloqueado ? 'Cuenta desactivada' : 'Cuenta activada',
      cuerpo: bloqueado
        ? 'Tu acceso fue desactivado por un administrador.'
        : 'Tu acceso fue reactivado por un administrador.',
      resourceType: 'miembro',
      resourceId: memberId,
      resourcePath: `${COLLECTIONS.miembros}/${memberId}`,
      dedupeKey: `miembro_estado:${memberId}:${bloqueado ? 'off' : 'on'}`,
    });
    return { id: memberId, uid, bloqueado };
  }

  async listarConsumos(user: AuthUser): Promise<BackofficeConsumo[]> {
    const rol = this.rolCanonico(user);
    if (rol === 'veterinario') throw new ForbiddenException('Veterinario no accede al consumo consolidado.');
    const veterinariosVisibles =
      rol === 'admin_veterinaria' ? await this.veterinarioIdsVisiblesPara(user) : new Set<string>();
    const snap = await this.firebase.firestore.collection(COLLECTIONS.consumos).get();
    return snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const limite = num(data.limite);
        const usados = num(data.usados) ?? 0;
        return stripUndefined({
          id: doc.id,
          periodo: str(data.periodo) ?? periodoActual(),
          scopeId: str(data.scopeId),
          orgId: str(data.orgId) ?? null,
          entidadId: str(data.entidadId) ?? null,
          veterinariaId: str(data.veterinariaId) ?? null,
          veterinarioId: str(data.veterinarioId) ?? null,
          usados,
          limite: limite ?? null,
          porcentaje: limite && limite > 0 ? Math.round((usados / limite) * 100) : null,
          bloqueado: data.bloqueado === true || Boolean(limite && usados >= limite),
        }) as BackofficeConsumo;
      })
      .filter((c) => this.consumoVisiblePara(user, c, veterinariosVisibles));
  }

  async listarSuscripciones(user: AuthUser): Promise<Record<string, unknown>[]> {
    const rol = this.rolCanonico(user);
    if (rol === 'veterinario') throw new ForbiddenException('Veterinario no accede a suscripciones consolidadas.');
    const snap = await this.firebase.firestore.collection(COLLECTIONS.suscripciones).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
      .filter((s) => this.suscripcionVisiblePara(user, s));
  }

  async listarAuditoria(user: AuthUser): Promise<Record<string, unknown>[]> {
    if (this.rolCanonico(user) !== 'superadmin') {
      throw new ForbiddenException('Solo Super Admin puede ver auditoria global.');
    }
    return this.auditoria.listar(user);
  }

  private assertAdminEntidad(user: AuthUser): void {
    const rol = this.rolCanonico(user);
    if (rol !== 'admin_entidad' && rol !== 'superadmin') {
      throw new ForbiddenException('Tu rol no permite gestionar entidad.');
    }
  }

  private assertAdminVeterinaria(user: AuthUser): void {
    const rol = this.rolCanonico(user);
    if (rol !== 'admin_veterinaria' && rol !== 'superadmin') {
      throw new ForbiddenException('Tu rol no permite gestionar veterinaria.');
    }
  }

  private assertSuperadmin(user: AuthUser): void {
    if (this.rolCanonico(user) !== 'superadmin') {
      throw new ForbiddenException('Solo Super Admin puede gestionar entidades globales.');
    }
  }

  private async obtenerEntidadPorId(id: string): Promise<EntidadDoc | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.entidades).doc(id).get();
    if (!snap.exists) return null;
    return this.mapEntidad(snap);
  }

  private assertPuedeOperarVeterinaria(user: AuthUser, vet: VeterinariaDoc): void {
    const rol = this.rolCanonico(user);
    if (rol === 'superadmin') return;
    if (rol === 'admin_entidad') {
      if (this.veterinariaVisibleParaAdminEntidad(user, vet)) return;
    }
    if (rol === 'admin_veterinaria' && this.veterinariaMatchesUser(vet, user)) return;
    throw new ForbiddenException('No puedes operar veterinarias fuera de tu scope.');
  }

  private veterinariaMatchesUser(vet: VeterinariaDoc, user: AuthUser): boolean {
    return Boolean(
      (user.veterinariaId && vet.id === user.veterinariaId) ||
        (user.accountId && vet.accountId === user.accountId),
    );
  }

  private veterinariaVisibleParaAdminEntidad(user: AuthUser, vet: VeterinariaDoc): boolean {
    if (user.entidadId) return vet.entidadId === user.entidadId;
    return Boolean(user.orgId && (vet.orgId === user.orgId || vet.legacyOrgId === user.orgId));
  }

  private miembroVisiblePara(user: AuthUser, miembro: BackofficeMiembro): boolean {
    const rol = this.rolCanonico(user);
    if (rol === 'superadmin') return true;
    if (rol === 'admin_entidad') {
      if (user.entidadId) return miembro.entidadId === user.entidadId;
      return Boolean(user.orgId && miembro.orgId === user.orgId);
    }
    if (rol === 'admin_veterinaria') {
      return Boolean(
        (user.veterinariaId && miembro.veterinariaId === user.veterinariaId) ||
          (user.accountId && miembro.accountId === user.accountId),
      );
    }
    return false;
  }

  private consumoVisiblePara(
    user: AuthUser,
    consumo: BackofficeConsumo,
    veterinariosVisibles = new Set<string>(),
  ): boolean {
    const rol = this.rolCanonico(user);
    if (rol === 'superadmin') return true;
    if (rol === 'admin_entidad') {
      if (user.entidadId) {
        return consumo.entidadId === user.entidadId || consumo.scopeId === user.entidadId;
      }
      return Boolean(user.orgId && consumo.orgId === user.orgId);
    }
    if (rol === 'admin_veterinaria') {
      return Boolean(
        (user.veterinariaId &&
          (consumo.veterinariaId === user.veterinariaId || consumo.scopeId === user.veterinariaId)) ||
          (user.accountId && consumo.scopeId === user.accountId) ||
          (consumo.veterinarioId && veterinariosVisibles.has(consumo.veterinarioId)) ||
          this.scopePerteneceAVeterinario(consumo.scopeId, veterinariosVisibles),
      );
    }
    return false;
  }

  private async veterinarioIdsVisiblesPara(user: AuthUser): Promise<Set<string>> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).get();
    const ids = snap.docs
      .map((doc) => this.mapMiembro(doc))
      .filter((m): m is BackofficeMiembro => m !== null)
      .filter((m) => this.miembroVisiblePara(user, m))
      .filter((m) => m.role === 'veterinario' || m.rol === 'vet')
      .map((m) => m.uid)
      .filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0);
    return new Set(ids);
  }

  private scopePerteneceAVeterinario(scopeId: string | undefined, veterinariosVisibles: Set<string>): boolean {
    if (!scopeId) return false;
    if (veterinariosVisibles.has(scopeId)) return true;
    return scopeId.startsWith('vet_') && veterinariosVisibles.has(scopeId.slice(4));
  }

  private suscripcionVisiblePara(user: AuthUser, sub: Record<string, unknown>): boolean {
    const rol = this.rolCanonico(user);
    if (rol === 'superadmin') return true;
    if (rol === 'admin_entidad') {
      if (user.entidadId) {
        return sub.entidadId === user.entidadId || sub.planOwnerId === user.entidadId;
      }
      return Boolean(user.orgId && sub.orgId === user.orgId);
    }
    if (rol === 'admin_veterinaria') {
      return Boolean(
        (user.veterinariaId &&
          (sub.veterinariaId === user.veterinariaId || sub.planOwnerId === user.veterinariaId)) ||
          (user.accountId && sub.planOwnerId === user.accountId) ||
          (user.orgId && sub.orgId === user.orgId),
      );
    }
    return false;
  }

  private rolCanonico(user: AuthUser): BackofficeRol {
    const role = user.role ?? this.roleDesdeLegacy(user.rol);
    if (role === 'superadmin' || role === 'admin_entidad' || role === 'admin_veterinaria') return role;
    return 'veterinario';
  }

  private roleDesdeLegacy(rol?: Rol): RolV2 | 'veterinario' {
    if (rol === 'superadmin') return 'superadmin';
    if (rol === 'admin') return 'admin_entidad';
    return 'veterinario';
  }

  private mapEntidad(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot): EntidadDoc | null {
    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) return null;
    return {
      id: doc.id,
      nombre: str(data.nombre) ?? 'Entidad',
      tipo: parseTipoEntidad(data.tipo) ?? null,
      direccion: str(data.direccion) ?? null,
      ciudad: str(data.ciudad) ?? null,
      pais: str(data.pais) ?? null,
      telefono: str(data.telefono) ?? null,
      emailContacto: str(data.emailContacto) ?? str(data.email) ?? str(data.correo) ?? null,
      logoUrl: str(data.logoUrl) ?? str(data.logo) ?? null,
      estado: data.estado === 'inactiva' ? 'inactiva' : 'activa',
      legacyOrgId: str(data.legacyOrgId) ?? null,
      planOwnerType: 'entidad',
      planOwnerId: str(data.planOwnerId) ?? doc.id,
      createdAt: data.createdAt ?? data.creadoEn,
      updatedAt: data.updatedAt ?? data.actualizadoEn,
    };
  }

  private mapVeterinaria(
    doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
  ): VeterinariaDoc | null {
    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) return null;
    return {
      id: doc.id,
      nombre: str(data.nombre) ?? 'Veterinaria',
      direccion: str(data.direccion) ?? null,
      ciudad: str(data.ciudad) ?? null,
      pais: str(data.pais) ?? null,
      telefono: str(data.telefono) ?? null,
      emailContacto: str(data.emailContacto) ?? str(data.email) ?? str(data.correo) ?? null,
      logoUrl: str(data.logoUrl) ?? str(data.logo) ?? null,
      orgId: str(data.orgId) ?? str(data.legacyOrgId) ?? null,
      legacyOrgId: str(data.legacyOrgId) ?? str(data.orgId) ?? null,
      entidadId: str(data.entidadId) ?? null,
      planOwnerType: data.planOwnerType === 'entidad' ? 'entidad' : 'veterinaria',
      planOwnerId: str(data.planOwnerId) ?? doc.id,
      accountType: 'veterinaria',
      accountId: str(data.accountId) ?? doc.id,
      estado: data.estado === 'inactiva' ? 'inactiva' : 'activa',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private mapMiembro(
    doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
  ): BackofficeMiembro | null {
    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) return null;
    const rol = parseRol(data.rol);
    if (!rol) return null;
    return stripUndefined({
      id: doc.id,
      uid: str(data.uid) ?? doc.id,
      email: str(data.email) ?? null,
      orgId: str(data.orgId),
      rol,
      role: parseRolV2(data.role),
      accountType: parseAccountType(data.accountType),
      accountId: str(data.accountId),
      entidadId: str(data.entidadId),
      veterinariaId: str(data.veterinariaId),
      membershipId: str(data.membershipId) ?? doc.id,
      planOwnerType: parsePlanOwnerType(data.planOwnerType),
      planOwnerId: str(data.planOwnerId),
      vinculoTipo: parseVinculoTipo(data.vinculoTipo),
      estado: parseEstadoMembership(data.estado),
      bloqueado: data.bloqueado === true || data.estado === 'bloqueado',
      creadoEn: data.creadoEn ?? data.createdAt ?? null,
      createdAt: data.createdAt ?? data.creadoEn ?? null,
    }) as BackofficeMiembro;
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseRol(value: unknown): Rol | undefined {
  return value === 'superadmin' || value === 'admin' || value === 'vet' || value === 'asistente'
    ? value
    : undefined;
}

function parseRolV2(value: unknown): RolV2 | undefined {
  return value === 'superadmin' ||
    value === 'admin_entidad' ||
    value === 'admin_veterinaria' ||
    value === 'veterinario'
    ? value
    : undefined;
}

function parseAccountType(value: unknown): BackofficeMiembro['accountType'] {
  return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad'
    ? value
    : undefined;
}

function parsePlanOwnerType(value: unknown): BackofficeMiembro['planOwnerType'] {
  return value === 'vet' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
}

function parseVinculoTipo(value: unknown): BackofficeMiembro['vinculoTipo'] {
  return value === 'staff' || value === 'freelance' || value === 'owner' ? value : undefined;
}

function parseEstadoMembership(value: unknown): BackofficeMiembro['estado'] {
  return value === 'activo' || value === 'inactivo' || value === 'bloqueado' ? value : undefined;
}

function parseTipoEntidad(value: unknown): EntidadDoc['tipo'] | undefined {
  return value === 'gobierno' || value === 'cadena' || value === 'ong' || value === 'entidad'
    ? value
    : undefined;
}
