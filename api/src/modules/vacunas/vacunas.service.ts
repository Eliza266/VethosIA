import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VacunasRepository } from './vacunas.repository';
import {
  VacunaDoc,
  VacunaCatalogoCustomDoc,
  calcularEstadoVacuna,
  fechaIsoDia,
  parseFechaVacuna,
  sumarDiasFechaVacuna,
  type EstadoVacuna,
  type FuenteVacuna,
} from './vacuna.types';
import { AuthUser } from '../../common/auth/auth-user.interface';
import {
  assertAcceso,
  assertOperacionClinica,
  filtroTenantRuntime,
  scopeClinicoParaCrearV2,
} from '../../common/auth/access';
import { PacientesService } from '../pacientes/pacientes.service';
import { PacienteDoc } from '../pacientes/paciente.types';
import { stripUndefinedFields } from '../../common/utils/strip-undefined-fields';
import { buscarVacunaCatalogo, CATALOGO_VACUNAS_BASE, type VacunaCatalogoBase } from './catalogo-vacunas';
import { NotificacionesService } from '../plataforma/notificaciones.service';

export interface CrearVacunaInput {
  pacienteId: string;
  nombre: string;
  especie?: string;
  catalogoCodigo?: string;
  intervaloDias?: number;
  fuente?: FuenteVacuna;
  aplicada?: string;
  proximaDosis?: string;
  notas?: string;
}

export interface FiltrarVacunasInput {
  pacienteId?: string;
  especie?: string;
  estado?: EstadoVacuna | 'proxima';
  proximas?: string;
  vencidas?: string;
  tipo?: string;
}

export interface AplicarVacunaInput {
  aplicada?: string;
  intervaloDias?: number;
  notas?: string;
}

export interface ResumenPendientesVacunas {
  proximas: number;
  vencidas: number;
}

@Injectable()
export class VacunasService {
  constructor(
    private readonly repo: VacunasRepository,
    private readonly pacientes: PacientesService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  // Devuelve la vacuna con su estado calculado (no se persiste el estado).
  private conEstado(v: VacunaDoc, hoy = new Date()): VacunaDoc {
    return { ...v, estado: calcularEstadoVacuna(v.proximaDosis, hoy) };
  }

  catalogoBase(): typeof CATALOGO_VACUNAS_BASE {
    return CATALOGO_VACUNAS_BASE;
  }

  async catalogoCompleto(
    user: AuthUser,
  ): Promise<Array<(VacunaCatalogoBase & { origen: 'base' }) | VacunaCatalogoCustomDoc>> {
    const baseMapped = this.catalogoBase().map((b) => ({ ...b, origen: 'base' as const }));
    const tenant = filtroTenantRuntime(user);
    const custom = await this.repo.listarCatalogoCustom(tenant);
    return [...baseMapped, ...custom];
  }

  async crearEntradaCatalogo(
    data: { nombre: string; especie: string; intervaloDias?: number; descripcion?: string },
    user: AuthUser,
  ): Promise<VacunaCatalogoCustomDoc> {
    assertOperacionClinica(user);
    const scope = scopeClinicoParaCrearV2(user);
    const payload = stripUndefinedFields({
      nombre: data.nombre,
      especie: data.especie,
      intervaloDias: data.intervaloDias,
      descripcion: data.descripcion,
    }) as Omit<VacunaCatalogoCustomDoc, 'id' | 'origen' | 'archivada' | 'creadoEn'>;

    const created = await this.repo.crearCatalogo(
      {
        orgId: user.orgId,
        veterinarioId: user.uid,
        ...scope,
      },
      payload,
    );
    return created;
  }

  async actualizarEntradaCatalogo(
    id: string,
    data: { nombre?: string; especie?: string; intervaloDias?: number; descripcion?: string },
    user: AuthUser,
  ): Promise<VacunaCatalogoCustomDoc> {
    const actual = await this.repo.getCatalogoById(id);
    assertAcceso(user, actual);
    assertOperacionClinica(user, actual);

    if (actual.origen !== 'custom') {
      throw new BadRequestException('Las entradas base del catálogo son inmutables.');
    }

    const payload = stripUndefinedFields({
      nombre: data.nombre,
      especie: data.especie,
      intervaloDias: data.intervaloDias,
      descripcion: data.descripcion,
    });

    await this.repo.actualizarCatalogo(id, filtroTenantRuntime(user), payload);
    return { ...actual, ...payload };
  }

  async archivarEntradaCatalogo(id: string, user: AuthUser): Promise<{ archivado: true }> {
    const actual = await this.repo.getCatalogoById(id);
    assertAcceso(user, actual);
    assertOperacionClinica(user, actual);

    if (actual.origen !== 'custom') {
      throw new BadRequestException('Las entradas base del catálogo no se pueden archivar.');
    }

    await this.repo.archivarCatalogo(id, filtroTenantRuntime(user));
    return { archivado: true };
  }

  async crear(input: CrearVacunaInput, user: AuthUser): Promise<VacunaDoc> {
    const paciente = await this.assertPacienteDelTenant(input.pacienteId, user);
    assertOperacionClinica(user, paciente);
    const payload = stripUndefinedFields({
      ...this.normalizarPayloadCreacion(input, paciente),
      orgId: user.orgId,
      veterinarioId: user.uid,
      ...scopeClinicoParaCrearV2(user, paciente),
    }) as Omit<VacunaDoc, 'id' | 'estado'>;
    const v = await this.repo.crear(payload);
    const conEstado = this.conEstado(v);
    await this.notificarSiPendiente(conEstado, user);
    return conEstado;
  }

  async listarPorPaciente(pacienteId: string, user: AuthUser): Promise<VacunaDoc[]> {
    return this.listar({ pacienteId }, user);
  }

  async listar(
    filtros: FiltrarVacunasInput,
    user: AuthUser,
    hoy = new Date(),
  ): Promise<VacunaDoc[]> {
    const vacunas = filtros.pacienteId
      ? await this.listarBasePaciente(filtros.pacienteId, user)
      : await this.repo.listarPorTenant(filtroTenantRuntime(user));

    return vacunas
      .filter((v) => this.accesible(user, v))
      .map((v) => this.conEstado(v, hoy))
      .filter((v) => this.aplicaFiltros(v, filtros));
  }

  async actualizar(id: string, campos: Partial<CrearVacunaInput>, user: AuthUser): Promise<VacunaDoc> {
    const v = await this.repo.getById(id);
    assertAcceso(user, v);
    const paciente = await this.assertPacienteDelTenant(v.pacienteId, user);
    assertOperacionClinica(user, paciente);
    const payload = stripUndefinedFields(
      this.normalizarPayloadActualizacion(v, campos, paciente),
    ) as Partial<VacunaDoc>;
    await this.repo.actualizar(id, payload);
    const actualizada = this.conEstado({ ...v, ...payload });
    await this.notificarSiPendiente(actualizada, user);
    return actualizada;
  }

  async actualizarPorPaciente(
    pacienteId: string,
    vacunaId: string,
    campos: Partial<CrearVacunaInput>,
    user: AuthUser,
  ): Promise<VacunaDoc> {
    const paciente = await this.assertPacienteDelTenant(pacienteId, user);
    assertOperacionClinica(user, paciente);
    const v = await this.repo.getById(vacunaId);
    assertAcceso(user, v);
    if (v.pacienteId !== pacienteId) {
      throw new NotFoundException(`Vacuna ${vacunaId} no pertenece al paciente ${pacienteId}.`);
    }
    const payload = stripUndefinedFields(
      this.normalizarPayloadActualizacion(v, campos, paciente),
    ) as Partial<VacunaDoc>;
    await this.repo.actualizar(vacunaId, payload);
    const actualizada = this.conEstado({ ...v, ...payload });
    await this.notificarSiPendiente(actualizada, user);
    return actualizada;
  }

  async marcarAplicada(
    id: string,
    input: AplicarVacunaInput,
    user: AuthUser,
    hoy = new Date(),
  ): Promise<VacunaDoc> {
    const v = await this.repo.getById(id);
    assertAcceso(user, v);
    const paciente = await this.assertPacienteDelTenant(v.pacienteId, user);
    assertOperacionClinica(user, paciente);
    const actualizada = await this.aplicarVacuna(v, input, user, hoy);
    return actualizada;
  }

  async marcarAplicadaPorPaciente(
    pacienteId: string,
    vacunaId: string,
    input: AplicarVacunaInput,
    user: AuthUser,
    hoy = new Date(),
  ): Promise<VacunaDoc> {
    const paciente = await this.assertPacienteDelTenant(pacienteId, user);
    assertOperacionClinica(user, paciente);
    const v = await this.repo.getById(vacunaId);
    assertAcceso(user, v);
    if (v.pacienteId !== pacienteId) {
      throw new NotFoundException(`Vacuna ${vacunaId} no pertenece al paciente ${pacienteId}.`);
    }
    return this.aplicarVacuna(v, input, user, hoy);
  }

  async eliminar(id: string, user: AuthUser): Promise<{ eliminado: true }> {
    const v = await this.repo.getById(id);
    assertAcceso(user, v);
    const paciente = await this.assertPacienteDelTenant(v.pacienteId, user);
    assertOperacionClinica(user, paciente);
    await this.repo.softDelete(id);
    return { eliminado: true };
  }

  async eliminarPorPaciente(
    pacienteId: string,
    vacunaId: string,
    user: AuthUser,
  ): Promise<{ eliminado: true }> {
    const paciente = await this.assertPacienteDelTenant(pacienteId, user);
    assertOperacionClinica(user, paciente);
    const v = await this.repo.getById(vacunaId);
    assertAcceso(user, v);
    if (v.pacienteId !== pacienteId) {
      throw new NotFoundException(`Vacuna ${vacunaId} no pertenece al paciente ${pacienteId}.`);
    }
    await this.repo.softDelete(vacunaId);
    return { eliminado: true };
  }

  // Recordatorio activo: cuenta vacunas proximas/vencidas del tenant. El scheduler
  // automatico de recordatorios diarios queda para el worker de plataforma.
  // TODO(vacunas-worker): ejecutar sincronizacion diaria sin depender de navegacion del usuario.
  async contarProximas(user: AuthUser, hoy = new Date()): Promise<number> {
    return (await this.contarPendientes(user, hoy)).proximas;
  }

  async contarPendientes(user: AuthUser, hoy = new Date()): Promise<ResumenPendientesVacunas> {
    const vacunas = await this.listar({}, user, hoy);
    return {
      proximas: vacunas.filter((v) => v.estado === 'proxima_a_vencer').length,
      vencidas: vacunas.filter((v) => v.estado === 'vencida').length,
    };
  }

  private async assertPacienteDelTenant(pacienteId: string, user: AuthUser): Promise<PacienteDoc> {
    return this.pacientes.obtener(pacienteId, user);
  }

  private accesible(user: AuthUser, v: VacunaDoc): boolean {
    try {
      assertAcceso(user, v);
      return true;
    } catch {
      return false;
    }
  }

  private async listarBasePaciente(pacienteId: string, user: AuthUser): Promise<VacunaDoc[]> {
    await this.assertPacienteDelTenant(pacienteId, user);
    return this.repo.listarPorPaciente(pacienteId);
  }

  private normalizarPayloadCreacion(
    input: CrearVacunaInput,
    paciente: PacienteDoc,
  ): Omit<VacunaDoc, 'id' | 'estado'> {
    const catalogo = buscarVacunaCatalogo(input.catalogoCodigo);
    const nombre = this.nombreVacuna(input.nombre, catalogo?.nombre);
    const especie = input.especie ?? paciente.especie ?? catalogo?.especie;
    const intervaloDias = input.intervaloDias ?? catalogo?.intervaloDias;
    const aplicada = this.fechaDia(input.aplicada);
    const proximaDosis =
      this.fechaDia(input.proximaDosis) ?? sumarDiasFechaVacuna(aplicada, intervaloDias);
    const fuente = input.fuente ?? (catalogo ? 'catalogo_base' : 'personalizada');

    return {
      pacienteId: input.pacienteId,
      nombre,
      especie,
      catalogoCodigo: catalogo?.codigo ?? input.catalogoCodigo,
      intervaloDias,
      fuente,
      aplicada,
      aplicaciones: aplicada ? [aplicada] : undefined,
      proximaDosis,
      notas: input.notas,
    };
  }

  private normalizarPayloadActualizacion(
    actual: VacunaDoc,
    campos: Partial<CrearVacunaInput>,
    paciente: PacienteDoc,
  ): Partial<VacunaDoc> {
    const catalogo = buscarVacunaCatalogo(campos.catalogoCodigo ?? actual.catalogoCodigo);
    const aplicada = campos.aplicada !== undefined ? this.fechaDia(campos.aplicada) : undefined;
    const intervaloDias = campos.intervaloDias ?? actual.intervaloDias ?? catalogo?.intervaloDias;
    const proximaDosis =
      campos.proximaDosis !== undefined
        ? this.fechaDia(campos.proximaDosis)
        : aplicada
          ? sumarDiasFechaVacuna(aplicada, intervaloDias)
          : undefined;
    const aplicaciones = aplicada
      ? this.aplicacionesCon(actual, aplicada)
      : undefined;

    return {
      nombre:
        campos.nombre !== undefined
          ? this.nombreVacuna(campos.nombre, catalogo?.nombre)
          : undefined,
      especie: campos.especie ?? (campos.catalogoCodigo ? catalogo?.especie : undefined) ?? paciente.especie,
      catalogoCodigo: campos.catalogoCodigo,
      intervaloDias: campos.intervaloDias ?? (campos.catalogoCodigo ? catalogo?.intervaloDias : undefined),
      fuente: campos.fuente ?? (campos.catalogoCodigo ? 'catalogo_base' : undefined),
      aplicada,
      aplicaciones,
      proximaDosis,
      notas: campos.notas,
    };
  }

  private async aplicarVacuna(
    actual: VacunaDoc,
    input: AplicarVacunaInput,
    user: AuthUser,
    hoy: Date,
  ): Promise<VacunaDoc> {
    const fechaAplicada = this.fechaDia(input.aplicada) ?? fechaIsoDia(hoy);
    const catalogo = buscarVacunaCatalogo(actual.catalogoCodigo);
    const intervaloDias = input.intervaloDias ?? actual.intervaloDias ?? catalogo?.intervaloDias;
    const payload = stripUndefinedFields({
      aplicada: fechaAplicada,
      aplicaciones: this.aplicacionesCon(actual, fechaAplicada),
      intervaloDias,
      proximaDosis: sumarDiasFechaVacuna(fechaAplicada, intervaloDias),
      notas: input.notas,
    }) as Partial<VacunaDoc>;
    await this.repo.actualizar(actual.id, payload);
    const actualizada = this.conEstado({ ...actual, ...payload }, hoy);
    await this.notificarSiPendiente(actualizada, user);
    return actualizada;
  }

  private aplicaFiltros(v: VacunaDoc, filtros: FiltrarVacunasInput): boolean {
    const estadoFiltro = filtros.estado === 'proxima' ? 'proxima_a_vencer' : filtros.estado;
    if (estadoFiltro && v.estado !== estadoFiltro) return false;
    if (filtros.proximas === 'true' && v.estado !== 'proxima_a_vencer') return false;
    if (filtros.vencidas === 'true' && v.estado !== 'vencida') return false;
    if (filtros.especie && v.especie !== filtros.especie) return false;
    if (filtros.tipo) {
      const tipo = filtros.tipo.trim().toLowerCase();
      const nombre = v.nombre.trim().toLowerCase();
      const codigo = v.catalogoCodigo?.trim().toLowerCase();
      if (nombre !== tipo && codigo !== tipo) return false;
    }
    return true;
  }

  private nombreVacuna(nombre?: string, fallback?: string): string {
    const value = (nombre ?? fallback ?? '').trim();
    if (!value) throw new BadRequestException('El nombre de la vacuna es requerido.');
    return value.slice(0, 120);
  }

  private fechaDia(value?: string): string | undefined {
    if (!value) return undefined;
    const fecha = parseFechaVacuna(value);
    if (!fecha) throw new BadRequestException('Fecha de vacuna invalida.');
    return fechaIsoDia(fecha);
  }

  private aplicacionesCon(actual: VacunaDoc, aplicada: string): string[] {
    const base = actual.aplicaciones?.length
      ? actual.aplicaciones
      : actual.aplicada
        ? [actual.aplicada]
        : [];
    return [...new Set([...base, aplicada])].sort();
  }

  private async notificarSiPendiente(v: VacunaDoc, user: AuthUser): Promise<void> {
    if (v.estado !== 'proxima_a_vencer' && v.estado !== 'vencida') return;
    const estadoTexto = v.estado === 'vencida' ? 'vencida' : 'proxima a vencer';
    await this.notificaciones.crear({
      destinatarioUid: user.uid,
      orgId: v.orgId ?? user.orgId ?? null,
      tipo: 'vacunas_pendientes',
      titulo: `Vacuna ${estadoTexto}`,
      cuerpo: `${v.nombre} esta ${estadoTexto}${v.proximaDosis ? ` desde/proxima ${v.proximaDosis}` : ''}.`,
      dedupeKey: `vacuna:${v.id}:${v.estado}:${v.proximaDosis ?? 'sin-fecha'}`,
    });
  }
}
