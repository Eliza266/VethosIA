import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CitasRepository } from './citas.repository';
import { CitaDoc, EstadoCita, puedeTransicionar } from './cita.types';
import { AuthUser } from '../../common/auth/auth-user.interface';
import {
  assertAcceso,
  assertOperacionClinica,
  filtroTenantRuntime,
  scopeClinicoParaCrearV2,
} from '../../common/auth/access';
import { runtimeScopeFromRecord } from '../../common/auth/runtime-v2';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { stripUndefinedFields } from '../../common/utils/strip-undefined-fields';

export interface CrearCitaInput {
  motivo: string;
  fecha: string;
  pacienteId: string;
  notas?: string;
  titulo?: string;
}

interface PacienteSnapshot {
  id: string;
  orgId?: string;
  veterinarioId?: string;
  accountType?: CitaDoc['accountType'];
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: CitaDoc['planOwnerType'];
  planOwnerId?: string;
  membershipId?: string;
  legacyOrgId?: string;
  nombre: string;
  propietarioNombre?: string;
  propietarioTelefono?: string;
}

@Injectable()
export class CitasService {
  constructor(
    private readonly repo: CitasRepository,
    private readonly firebase: FirebaseService,
  ) {}

  async crear(input: CrearCitaInput, user: AuthUser): Promise<CitaDoc> {
    const paciente = await this.cargarPaciente(input.pacienteId);
    this.assertPacienteTenant(user, paciente);
    assertOperacionClinica(user, paciente);

    const pacienteNombre = paciente.nombre;
    const titulo = `${pacienteNombre} · ${input.motivo}`;

    return this.repo.crear(
      stripUndefinedFields({
        orgId: user.orgId,
        veterinarioId: user.uid,
        ...scopeClinicoParaCrearV2(user, paciente),
        estado: 'programada',
        pacienteId: paciente.id,
        pacienteNombre,
        propietarioNombre: paciente.propietarioNombre,
        propietarioTelefono: paciente.propietarioTelefono,
        motivo: input.motivo,
        titulo,
        fecha: input.fecha,
        notas: input.notas,
      }) as Omit<CitaDoc, 'id'>,
    );
  }

  async listar(user: AuthUser): Promise<CitaDoc[]> {
    return this.repo.listar(filtroTenantRuntime(user));
  }

  async proximasHoras(user: AuthUser, horas = 2, ahora = new Date()): Promise<CitaDoc[]> {
    const limiteMs = Math.max(1, horas) * 60 * 60 * 1000;
    const citas = await this.listar(user);
    return citas
      .filter((cita) => {
        if (cita.estado !== 'programada') return false;
        const fecha = new Date(cita.fecha);
        if (Number.isNaN(fecha.getTime())) return false;
        const diff = fecha.getTime() - ahora.getTime();
        return diff > 0 && diff <= limiteMs;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  async obtener(id: string, user: AuthUser): Promise<CitaDoc> {
    const cita = await this.repo.getById(id);
    assertAcceso(user, cita);
    return cita;
  }

  async actualizar(
    id: string,
    campos: Partial<CrearCitaInput>,
    user: AuthUser,
  ): Promise<CitaDoc> {
    const cita = await this.obtener(id, user);
    assertOperacionClinica(user, cita);
    const patch: Partial<CitaDoc> = { ...campos };

    if (campos.pacienteId && campos.pacienteId !== cita.pacienteId) {
      const paciente = await this.cargarPaciente(campos.pacienteId);
      this.assertPacienteTenant(user, paciente);
      assertOperacionClinica(user, paciente);
      patch.pacienteId = paciente.id;
      patch.pacienteNombre = paciente.nombre;
      patch.propietarioNombre = paciente.propietarioNombre;
      patch.propietarioTelefono = paciente.propietarioTelefono;
      Object.assign(patch, scopeClinicoParaCrearV2(user, paciente));
    }

    const motivo = campos.motivo ?? cita.motivo ?? cita.titulo;
    const nombre = patch.pacienteNombre ?? cita.pacienteNombre;
    if (nombre && motivo) {
      patch.titulo = `${nombre} · ${motivo}`;
    }

    await this.repo.actualizar(id, stripUndefinedFields(patch) as Partial<CitaDoc>);
    return this.obtener(id, user);
  }

  /** Vincula manualmente una cita legacy (sin pacienteId) a un paciente real del tenant. */
  async vincularPaciente(id: string, pacienteId: string, user: AuthUser): Promise<CitaDoc> {
    const cita = await this.obtener(id, user);
    assertOperacionClinica(user, cita);
    if (cita.pacienteId) {
      throw new BadRequestException('La cita ya tiene un paciente vinculado.');
    }
    const paciente = await this.cargarPaciente(pacienteId);
    this.assertPacienteTenant(user, paciente);
    assertOperacionClinica(user, paciente);
    const motivo = cita.motivo ?? cita.titulo;
    await this.repo.actualizar(id, {
      pacienteId: paciente.id,
      pacienteNombre: paciente.nombre,
      propietarioNombre: paciente.propietarioNombre,
      propietarioTelefono: paciente.propietarioTelefono,
      ...scopeClinicoParaCrearV2(user, paciente),
      motivo,
      titulo: `${paciente.nombre} · ${motivo}`,
    });
    return this.obtener(id, user);
  }

  /** Enlaza consulta recien creada desde flujo Atender (citaId en nueva consulta). */
  async vincularConsulta(
    citaId: string,
    consultaId: string,
    pacienteId: string,
    user: AuthUser,
  ): Promise<void> {
    const cita = await this.obtener(citaId, user);
    assertOperacionClinica(user, cita);
    if (cita.pacienteId && cita.pacienteId !== pacienteId) {
      throw new BadRequestException('La cita no corresponde al paciente de la consulta.');
    }
    if (cita.consultaId && cita.consultaId !== consultaId) {
      throw new BadRequestException('La cita ya tiene otra consulta vinculada.');
    }
    const patch: Partial<CitaDoc> = {
      consultaId,
      estado: cita.estado === 'programada' ? 'en_atencion' : cita.estado,
    };
    if (!cita.pacienteId) {
      const paciente = await this.cargarPaciente(pacienteId);
      this.assertPacienteTenant(user, paciente);
      assertOperacionClinica(user, paciente);
      patch.pacienteId = paciente.id;
      patch.pacienteNombre = paciente.nombre;
      patch.propietarioNombre = paciente.propietarioNombre;
      patch.propietarioTelefono = paciente.propietarioTelefono;
      Object.assign(patch, scopeClinicoParaCrearV2(user, paciente));
    }
    await this.repo.actualizar(citaId, patch);
  }

  /** Al aprobar consulta: cierra la cita vinculada. */
  async cerrarDesdeConsulta(
    citaId: string,
    consultaId: string,
    historiaClinicaId: string | undefined,
    user: AuthUser,
  ): Promise<void> {
    const cita = await this.obtener(citaId, user);
    assertOperacionClinica(user, cita);
    if (cita.consultaId && cita.consultaId !== consultaId) return;
    await this.repo.actualizar(citaId, {
      consultaId,
      estado: 'realizada',
      ...(historiaClinicaId ? { historiaClinicaId } : {}),
    });
  }

  async cambiarEstado(id: string, nuevo: EstadoCita, user: AuthUser): Promise<CitaDoc> {
    const cita = await this.obtener(id, user);
    assertOperacionClinica(user, cita);
    if (cita.estado === nuevo) return cita;
    if (!puedeTransicionar(cita.estado, nuevo)) {
      throw new BadRequestException(`Transicion invalida: ${cita.estado} -> ${nuevo}.`);
    }
    if (nuevo === 'realizada' && cita.pacienteId && !cita.consultaId) {
      throw new BadRequestException(
        'Vincule una consulta antes de marcar la cita como realizada (use Atender).',
      );
    }
    await this.repo.actualizar(id, { estado: nuevo });
    return { ...cita, estado: nuevo };
  }

  private async cargarPaciente(pacienteId: string): Promise<PacienteSnapshot> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.pacientes).doc(pacienteId).get();
    if (!snap.exists) throw new NotFoundException(`Paciente ${pacienteId} no existe.`);
    const d = snap.data() ?? {};
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const nombre = str(d.nombre);
    if (!nombre) throw new BadRequestException('Paciente sin nombre.');
    const prop = d.propietario as Record<string, unknown> | undefined;
    return {
      id: snap.id,
      orgId: str(d.orgId),
      veterinarioId: str(d.veterinarioId),
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      membershipId: scope.membershipId,
      legacyOrgId: scope.legacyOrgId,
      nombre,
      propietarioNombre: prop && typeof prop.nombre === 'string' ? prop.nombre : undefined,
      propietarioTelefono:
        prop && typeof prop.telefono === 'string'
          ? prop.telefono
          : prop && typeof prop.whatsapp === 'string'
            ? prop.whatsapp
            : undefined,
    };
  }

  private assertPacienteTenant(user: AuthUser, paciente: PacienteSnapshot): void {
    assertAcceso(user, paciente);
  }
}
