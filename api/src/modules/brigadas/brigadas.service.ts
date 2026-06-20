import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { BrigadasRepository } from './brigadas.repository';
import { BrigadaAtencionDoc, BrigadaConsolidado, BrigadaDoc, EstadoBrigada } from './brigada.types';
import { AuthUser, Rol, RolV2 } from '../../common/auth/auth-user.interface';
import { filtroTenantRuntime, scopeClinicoParaCrearV2 } from '../../common/auth/access';
import { COLLECTIONS } from '../../common/firebase/collections';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { CrearBrigadaDto, ActualizarBrigadaDto, CrearAtencionBrigadaDto } from './dto/brigada.dto';

type RolOperativoBrigada = 'admin_entidad' | 'admin_veterinaria' | 'veterinario';

interface VeterinariaScope {
  id: string;
  accountId?: string;
  entidadId?: string;
  orgId?: string;
  legacyOrgId?: string;
  planOwnerType?: 'veterinaria' | 'entidad';
  planOwnerId?: string;
}

interface MiembroScope {
  id: string;
  uid: string;
  rol?: Rol;
  role?: RolV2;
  orgId?: string;
  accountType?: 'vet_individual' | 'veterinaria' | 'entidad';
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  bloqueado?: boolean;
  estado?: string;
}

@Injectable()
export class BrigadasService {
  constructor(
    private readonly repo: BrigadasRepository,
    private readonly firebase: FirebaseService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(user: AuthUser): Promise<BrigadaDoc[]> {
    this.assertRolOperativo(user);
    const list = await this.repo.listar(filtroTenantRuntime(user));
    return list.filter((brigada) => this.puedeVerBrigada(user, brigada));
  }

  async obtener(id: string, user: AuthUser): Promise<BrigadaDoc> {
    this.assertRolOperativo(user);
    const brigada = await this.repo.getById(id);
    if (!this.puedeVerBrigada(user, brigada)) {
      throw new ForbiddenException('No tienes acceso a esta brigada.');
    }
    return brigada;
  }

  async crear(dto: CrearBrigadaDto, user: AuthUser): Promise<BrigadaDoc> {
    const rol = this.assertRolOperativo(user);
    const scope = await this.scopeParaCrear(dto, user, rol);
    const veterinarioIds = await this.normalizarParticipantes(dto.veterinarioIds ?? [], user, rol, scope);
    const creada = await this.repo.crear({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      fecha: dto.fecha,
      ubicacion: { ...dto.ubicacion },
      veterinarioIds,
      orgId: user.orgId,
      ...scope,
      estado: dto.estado ?? 'planificada',
    });
    await this.auditoria.registrar({
      accion: 'brigada.crear',
      actorUid: user.uid,
      orgId: user.orgId ?? creada.orgId ?? null,
      recurso: creada.id,
      meta: {
        entidadId: creada.entidadId ?? null,
        veterinariaId: creada.veterinariaId ?? null,
      },
    });
    return creada;
  }

  async actualizar(id: string, dto: ActualizarBrigadaDto, user: AuthUser): Promise<BrigadaDoc> {
    const rol = this.assertRolOperativo(user);
    const brigada = await this.obtener(id, user);
    this.assertPuedeEditar(user, rol, brigada, dto);

    const payload: Record<string, unknown> = stripUndefinedFields({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      fecha: dto.fecha,
      estado: dto.estado,
    });

    if (dto.estado !== undefined) {
      this.assertTransicionValida(brigada.estado, dto.estado);
    }

    if (dto.ubicacion) {
      payload.ubicacion = { ...dto.ubicacion };
    }

    if (dto.veterinariaId !== undefined) {
      payload.veterinariaId = dto.veterinariaId;
    }

    if (dto.veterinarioIds !== undefined) {
      payload.veterinarioIds = await this.normalizarParticipantes(dto.veterinarioIds, user, rol, brigada);
    }

    if (Object.keys(payload).length > 0) {
      await this.repo.mergeRaw(id, payload);
      await this.auditoria.registrar({
        accion: 'brigada.editar',
        actorUid: user.uid,
        orgId: user.orgId ?? brigada.orgId ?? null,
        recurso: id,
        meta: {
          entidadId: brigada.entidadId ?? null,
          veterinariaId: brigada.veterinariaId ?? null,
        },
      });
    }

    return this.obtener(id, user);
  }

  async listarAtenciones(id: string, user: AuthUser): Promise<BrigadaAtencionDoc[]> {
    await this.obtener(id, user);
    return this.repo.listarAtenciones(id);
  }

  async registrarAtencion(
    id: string,
    dto: CrearAtencionBrigadaDto,
    user: AuthUser,
  ): Promise<BrigadaAtencionDoc> {
    const rol = this.assertRolOperativo(user);
    const brigada = await this.obtener(id, user);
    if (rol !== 'veterinario') {
      throw new ForbiddenException('Solo un veterinario participante registra atenciones de brigada.');
    }
    if (!brigada.veterinarioIds.includes(user.uid)) {
      throw new ForbiddenException('Solo puedes registrar atenciones en brigadas donde participas.');
    }
    if (dto.veterinarioId && dto.veterinarioId !== user.uid) {
      throw new ForbiddenException('No puedes registrar atenciones a nombre de otro veterinario.');
    }

    await this.validarVinculosClinicos(brigada, dto);
    const atencion = await this.repo.crearAtencion({
      brigadaId: brigada.id,
      pacienteId: dto.pacienteId,
      consultaId: dto.consultaId,
      veterinarioId: user.uid,
      motivo: dto.motivo,
      notas: dto.notas,
      especie: dto.especie,
      fechaHora: dto.fechaHora ?? new Date().toISOString(),
      orgId: brigada.orgId,
      accountType: brigada.accountType,
      accountId: brigada.accountId,
      entidadId: brigada.entidadId,
      veterinariaId: brigada.veterinariaId,
      planOwnerType: brigada.planOwnerType,
      planOwnerId: brigada.planOwnerId,
      membershipId: brigada.membershipId,
      legacyOrgId: brigada.legacyOrgId,
      createdBy: user.uid,
    });
    await this.auditoria.registrar({
      accion: 'brigada.atencion_crear',
      actorUid: user.uid,
      orgId: user.orgId ?? brigada.orgId ?? null,
      recurso: atencion.id,
      meta: { brigadaId: brigada.id, pacienteId: dto.pacienteId ?? null, consultaId: dto.consultaId ?? null },
    });
    return atencion;
  }

  async consolidado(id: string, user: AuthUser): Promise<BrigadaConsolidado> {
    const brigada = await this.obtener(id, user);
    const atenciones = await this.repo.listarAtenciones(id);
    const pacientes = new Set(atenciones.map((a) => a.pacienteId).filter(Boolean));
    const vetsConAtencion = new Set(atenciones.map((a) => a.veterinarioId).filter(Boolean));
    return {
      brigadaId: brigada.id,
      nombre: brigada.nombre,
      estado: brigada.estado,
      fecha: brigada.fecha,
      entidadId: brigada.entidadId,
      veterinariaId: brigada.veterinariaId,
      totalAtenciones: atenciones.length,
      pacientesUnicos: pacientes.size,
      veterinariosParticipantes: new Set(brigada.veterinarioIds).size,
      veterinariosConAtencion: vetsConAtencion.size,
    };
  }

  private async scopeParaCrear(
    dto: CrearBrigadaDto,
    user: AuthUser,
    rol: RolOperativoBrigada,
  ): Promise<Partial<BrigadaDoc>> {
    if (rol === 'admin_entidad') {
      const entidadId = user.entidadId ?? user.accountId ?? undefined;
      if (!entidadId && !user.orgId) {
        throw new ForbiddenException('Admin Entidad requiere entidadId u orgId.');
      }
      if (dto.veterinariaId) {
        const sede = await this.obtenerVeterinaria(dto.veterinariaId);
        if (!sede || !this.veterinariaPerteneceAEntidad(sede, user)) {
          throw new ForbiddenException('La sede seleccionada no pertenece a tu entidad.');
        }
        return stripUndefinedFields({
          accountType: 'veterinaria',
          accountId: sede.accountId ?? sede.id,
          entidadId: entidadId ?? sede.entidadId,
          veterinariaId: sede.id,
          planOwnerType: sede.planOwnerType ?? user.planOwnerType ?? 'entidad',
          planOwnerId: sede.planOwnerId ?? user.planOwnerId ?? entidadId,
          membershipId: user.membershipId,
          legacyOrgId: user.orgId,
        }) as Partial<BrigadaDoc>;
      }
      return stripUndefinedFields({
        accountType: user.accountType ?? 'entidad',
        accountId: user.accountId ?? entidadId,
        entidadId,
        planOwnerType: user.planOwnerType ?? 'entidad',
        planOwnerId: user.planOwnerId ?? entidadId,
        membershipId: user.membershipId,
        legacyOrgId: user.orgId,
      }) as Partial<BrigadaDoc>;
    }

    if (rol === 'admin_veterinaria') {
      const veterinariaId = user.veterinariaId ?? user.accountId;
      if (!veterinariaId) throw new ForbiddenException('Admin Veterinaria requiere veterinariaId.');
      if (dto.veterinariaId && dto.veterinariaId !== veterinariaId) {
        throw new ForbiddenException('No puedes crear brigadas para otra veterinaria.');
      }
      return stripUndefinedFields({
        accountType: 'veterinaria',
        accountId: user.accountId ?? veterinariaId,
        entidadId: user.entidadId,
        veterinariaId,
        planOwnerType: user.planOwnerType,
        planOwnerId: user.planOwnerId,
        membershipId: user.membershipId,
        legacyOrgId: user.orgId,
      }) as Partial<BrigadaDoc>;
    }

    return scopeClinicoParaCrearV2(user) as Partial<BrigadaDoc>;
  }

  private assertPuedeEditar(
    user: AuthUser,
    rol: RolOperativoBrigada,
    brigada: BrigadaDoc,
    dto: ActualizarBrigadaDto,
  ): void {
    if (!this.puedeVerBrigada(user, brigada)) {
      throw new ForbiddenException('No puedes editar esta brigada.');
    }
    if (rol === 'veterinario') {
      const keys = Object.entries(dto).filter(([, value]) => value !== undefined).map(([key]) => key);
      if (!brigada.veterinarioIds.includes(user.uid) || keys.some((key) => key !== 'estado')) {
        throw new ForbiddenException('Veterinario solo puede cambiar estado en brigadas asignadas.');
      }
    }
    if (dto.veterinariaId && rol === 'admin_veterinaria' && dto.veterinariaId !== brigada.veterinariaId) {
      throw new ForbiddenException('No puedes mover una brigada fuera de tu veterinaria.');
    }
  }

  private assertTransicionValida(actual: EstadoBrigada, siguiente: EstadoBrigada): void {
    if (actual === siguiente) return;
    const permitidas: Record<EstadoBrigada, EstadoBrigada[]> = {
      planificada: ['en_curso'],
      en_curso: ['finalizada'],
      finalizada: [],
    };
    if (!permitidas[actual].includes(siguiente)) {
      throw new BadRequestException(`Transicion de brigada no permitida: ${actual} -> ${siguiente}.`);
    }
  }

  private async normalizarParticipantes(
    veterinarioIds: string[],
    user: AuthUser,
    rol: RolOperativoBrigada,
    scope: Partial<BrigadaDoc>,
  ): Promise<string[]> {
    if (rol === 'veterinario') return [user.uid];
    const ids = [...new Set(veterinarioIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return [];
    const miembros = await this.miembrosVisibles(scope, user);
    const visibles = new Set(miembros.map((m) => m.uid));
    const invalidos = ids.filter((id) => !visibles.has(id));
    if (invalidos.length > 0) {
      throw new ForbiddenException('La brigada incluye veterinarios fuera de tu scope.');
    }
    return ids;
  }

  private async validarVinculosClinicos(brigada: BrigadaDoc, dto: CrearAtencionBrigadaDto): Promise<void> {
    let pacienteId = dto.pacienteId;
    if (pacienteId) {
      const pac = await this.obtenerDoc(COLLECTIONS.pacientes, pacienteId);
      if (!this.recursoComparteScope(brigada, pac)) {
        throw new ForbiddenException('El paciente no pertenece al scope de la brigada.');
      }
    }
    if (dto.consultaId) {
      const consulta = await this.obtenerDoc(COLLECTIONS.consultas, dto.consultaId);
      if (!this.recursoComparteScope(brigada, consulta)) {
        throw new ForbiddenException('La consulta no pertenece al scope de la brigada.');
      }
      const consultaPaciente = str(consulta.pacienteId);
      if (pacienteId && consultaPaciente && pacienteId !== consultaPaciente) {
        throw new BadRequestException('La consulta no corresponde al paciente informado.');
      }
      pacienteId = pacienteId ?? consultaPaciente;
    }
  }

  private recursoComparteScope(brigada: BrigadaDoc, data: Record<string, unknown>): boolean {
    const entidadId = str(data.entidadId);
    const veterinariaId = str(data.veterinariaId);
    const accountId = str(data.accountId);
    const orgId = str(data.orgId);
    const veterinarioId = str(data.veterinarioId);
    if (brigada.veterinariaId) return veterinariaId === brigada.veterinariaId || accountId === brigada.accountId;
    if (brigada.accountId) return accountId === brigada.accountId;
    if (brigada.entidadId) return entidadId === brigada.entidadId;
    if (brigada.orgId) return orgId === brigada.orgId;
    return Boolean(veterinarioId && brigada.veterinarioIds.includes(veterinarioId));
  }

  private async obtenerDoc(collection: string, id: string): Promise<Record<string, unknown>> {
    const snap = await this.firebase.firestore.collection(collection).doc(id).get();
    if (!snap.exists) throw new NotFoundException(`${collection}/${id} no existe.`);
    return (snap.data() ?? {}) as Record<string, unknown>;
  }

  private puedeVerBrigada(user: AuthUser, brigada: BrigadaDoc): boolean {
    const rol = this.rolCanonico(user);
    if (rol === 'admin_entidad') {
      if (user.entidadId) return brigada.entidadId === user.entidadId;
      return Boolean(user.orgId && brigada.orgId === user.orgId);
    }
    if (rol === 'admin_veterinaria') {
      return Boolean(
        (user.veterinariaId && brigada.veterinariaId === user.veterinariaId) ||
          (user.accountId && brigada.accountId === user.accountId),
      );
    }
    if (rol === 'veterinario') {
      if (!brigada.veterinarioIds.includes(user.uid)) return false;
      if (user.entidadId && brigada.entidadId) return user.entidadId === brigada.entidadId;
      if (user.veterinariaId && brigada.veterinariaId) return user.veterinariaId === brigada.veterinariaId;
      if (user.accountId && brigada.accountId) return user.accountId === brigada.accountId;
      if (user.orgId && brigada.orgId) return user.orgId === brigada.orgId;
      return !brigada.entidadId && !brigada.veterinariaId && !brigada.accountId;
    }
    return false;
  }

  private assertRolOperativo(user: AuthUser): RolOperativoBrigada {
    const rol = this.rolCanonico(user);
    if (rol === 'admin_entidad' || rol === 'admin_veterinaria' || rol === 'veterinario') return rol;
    throw new ForbiddenException('Tu rol no permite operar brigadas.');
  }

  private rolCanonico(user: AuthUser): RolV2 | 'asistente' {
    if (user.role) return user.role;
    if (user.rol === 'superadmin') return 'superadmin';
    if (user.rol === 'admin') return 'admin_entidad';
    if (user.rol === 'vet') return 'veterinario';
    return 'asistente';
  }

  private async obtenerVeterinaria(id: string): Promise<VeterinariaScope | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc(id).get();
    if (!snap.exists) return null;
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    return {
      id: snap.id,
      accountId: str(data.accountId) ?? snap.id,
      entidadId: str(data.entidadId),
      orgId: str(data.orgId),
      legacyOrgId: str(data.legacyOrgId),
      planOwnerType: data.planOwnerType === 'veterinaria' ? 'veterinaria' : 'entidad',
      planOwnerId: str(data.planOwnerId),
    };
  }

  private veterinariaPerteneceAEntidad(sede: VeterinariaScope, user: AuthUser): boolean {
    if (user.entidadId) return sede.entidadId === user.entidadId;
    return Boolean(user.orgId && (sede.orgId === user.orgId || sede.legacyOrgId === user.orgId));
  }

  private async miembrosVisibles(scope: Partial<BrigadaDoc>, user: AuthUser): Promise<MiembroScope[]> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).get();
    return snap.docs
      .map((doc) => this.mapMiembro(doc))
      .filter((m): m is MiembroScope => m !== null)
      .filter((m) => this.esVeterinarioActivo(m))
      .filter((m) => this.miembroComparteScope(m, scope, user));
  }

  private miembroComparteScope(miembro: MiembroScope, scope: Partial<BrigadaDoc>, user: AuthUser): boolean {
    if (scope.veterinariaId) {
      return miembro.veterinariaId === scope.veterinariaId || miembro.accountId === scope.accountId;
    }
    if (scope.entidadId) return miembro.entidadId === scope.entidadId;
    if (scope.accountId) return miembro.accountId === scope.accountId;
    return Boolean(user.orgId && miembro.orgId === user.orgId);
  }

  private esVeterinarioActivo(miembro: MiembroScope): boolean {
    const esVet = miembro.role === 'veterinario' || miembro.rol === 'vet';
    return esVet && miembro.bloqueado !== true && miembro.estado !== 'bloqueado' && miembro.estado !== 'inactivo';
  }

  private mapMiembro(
    doc: admin.firestore.DocumentSnapshot,
  ): MiembroScope | null {
    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) return null;
    return {
      id: doc.id,
      uid: str(data.uid) ?? doc.id,
      rol: parseRol(data.rol),
      role: parseRolV2(data.role),
      orgId: str(data.orgId),
      accountType: parseAccountType(data.accountType),
      accountId: str(data.accountId),
      entidadId: str(data.entidadId),
      veterinariaId: str(data.veterinariaId),
      membershipId: str(data.membershipId) ?? doc.id,
      bloqueado: data.bloqueado === true,
      estado: str(data.estado),
    };
  }
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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

function parseAccountType(value: unknown): MiembroScope['accountType'] {
  return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
}
