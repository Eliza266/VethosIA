import { Injectable, NotFoundException } from '@nestjs/common';
import { PacientesRepository } from './pacientes.repository';
import { PacienteDoc } from './paciente.types';
import { AuthUser } from '../../common/auth/auth-user.interface';
import {
  assertAcceso,
  assertOperacionClinica,
  filtroTenantRuntime,
  particionTenant,
  scopeClinicoParaCrearV2,
} from '../../common/auth/access';
import { CrearPacienteDto, ActualizarPacienteDto } from './dto/paciente.dto';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { ConsultasRepository } from '../consultas/consultas.repository';

// Logica de negocio de pacientes: aislamiento por tenant, id legible y soft delete.
// Regla: un paciente eliminado (deletedAt) NO aparece en listados ni es accesible/
// exportable, pero SIGUE existiendo en la BD (nunca borrado fisico). Cada accion se audita.
@Injectable()
export class PacientesService {
  constructor(
    private readonly repo: PacientesRepository,
    private readonly auditoria: AuditoriaService,
    private readonly consultasRepo: ConsultasRepository,
  ) {}

  async crear(dto: CrearPacienteDto, user: AuthUser): Promise<PacienteDoc> {
    assertOperacionClinica(user);
    const tenant = particionTenant(user);
    // ValidationPipe instancia PropietarioDto; Firestore exige POJO plano. Ademas,
    // Firestore rechaza (500) cualquier campo en `undefined` en cualquier nivel del
    // documento -- orgId/campos opcionales del DTO/scope V2 pueden venir undefined
    // segun la cuenta, asi que se limpian aqui igual que en actualizar().
    const propietario = dto.propietario
      ? stripUndefinedFields({ ...dto.propietario })
      : undefined;
    const doc = stripUndefinedFields({
      ...dto,
      propietario,
      orgId: user.orgId,
      veterinarioId: user.uid,
      ...scopeClinicoParaCrearV2(user),
    }) as Omit<PacienteDoc, 'id' | 'codigo'>;
    const creado = await this.repo.crear(doc, tenant);
    await this.auditoria.registrar({
      accion: 'paciente.crear',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: creado.id,
    });
    return creado;
  }

  async obtener(id: string, user: AuthUser): Promise<PacienteDoc> {
    const p = await this.repo.getById(id);
    assertAcceso(user, p);
    if (p.deletedAt != null) {
      throw new NotFoundException(`Paciente ${id} no existe.`);
    }
    return p;
  }

  async listar(user: AuthUser): Promise<PacienteDoc[]> {
    return this.repo.listar(filtroTenantRuntime(user));
  }

  async actualizar(id: string, dto: ActualizarPacienteDto, user: AuthUser): Promise<PacienteDoc> {
    const paciente = await this.obtener(id, user); // valida acceso + no eliminado
    assertOperacionClinica(user, paciente);
    // ValidationPipe instancia ActualizarPacienteDto; Firestore exige POJO plano sin undefined.
    const payload = stripUndefinedFields({
      ...dto,
      propietario: dto.propietario ? { ...dto.propietario } : undefined,
    }) as Partial<PacienteDoc>;
    await this.repo.actualizar(id, payload);
    await this.auditoria.registrar({
      accion: 'paciente.editar',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: id,
    });
    return this.obtener(id, user);
  }

  // Consulta rapida (Opcion B): el vet grabo sin elegir paciente, la IA detecto que en
  // realidad era una mascota YA registrada. Movemos la consulta a ese paciente real y
  // borramos (soft delete) el placeholder que se habia creado para arrancar a grabar.
  async vincularConsulta(
    pacienteId: string,
    consultaId: string,
    user: AuthUser,
  ): Promise<{ ok: true }> {
    const paciente = await this.obtener(pacienteId, user); // valida acceso + no eliminado
    assertOperacionClinica(user, paciente);

    const consulta = await this.consultasRepo.getById(consultaId);
    assertAcceso(user, consulta);
    assertOperacionClinica(user, consulta);

    const pacienteAnteriorId = consulta.pacienteId;
    await this.consultasRepo.update(consultaId, {
      pacienteId,
      pacientePendienteConfirmar: false,
    });

    if (pacienteAnteriorId && pacienteAnteriorId !== pacienteId) {
      const anterior = await this.repo.getById(pacienteAnteriorId).catch(() => null);
      if (anterior?.esPlaceholder) {
        await this.repo.softDelete(pacienteAnteriorId);
      }
    }

    await this.auditoria.registrar({
      accion: 'paciente.vincularConsulta',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: consultaId,
    });
    return { ok: true };
  }

  async eliminar(id: string, user: AuthUser): Promise<{ eliminado: true }> {
    const p = await this.repo.getById(id);
    assertAcceso(user, p);
    assertOperacionClinica(user, p);
    await this.repo.softDelete(id);
    await this.auditoria.registrar({
      accion: 'paciente.eliminar',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: id,
    });
    return { eliminado: true };
  }
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
