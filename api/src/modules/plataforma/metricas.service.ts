import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS, periodoActual } from '../../common/firebase/collections';
import { AuthUser, Rol, RolV2 } from '../../common/auth/auth-user.interface';
import { normalizarDiagnosticosEstructurados } from '../consultas/diagnostico-estructurado';
import { calcularEstadoVacuna } from '../vacunas/vacuna.types';
import {
  resolverLimiteHistoriasGlobal,
  resolverLimiteHistoriasMes,
} from '../saas/plan-limits';

export interface TopDiagnostico {
  nombre: string;
  total: number;
}

export interface ConteoPorClave {
  clave: string;
  total: number;
}

export interface ConsumoPorVeterinario {
  veterinarioId: string;
  usados: number;
  limite: number;
  porcentaje: number;
  bloqueado: boolean;
}

export interface ConsolidadoVeterinaria {
  veterinariaId: string;
  pacientes: number;
  consultas: number;
  soapGenerados: number;
  vacunasVencidas: number;
  citasProgramadas: number;
}

export interface PuntoMensual {
  mes: string;
  total: number;
}

export interface ConsultasPorVeterinario {
  veterinarioId: string;
  total: number;
}

export interface Metricas {
  alcance: 'global' | 'entidad' | 'veterinaria' | 'individual';
  periodo: { desde?: string; hasta?: string; consumo: string };
  pacientes: number;
  pacientesAtendidos: number;
  consultas: number;
  consultasAprobadas: number;
  soapGenerados: number;
  soapUsados: number;
  soapLimite: number;
  soapRestante: number;
  soapPorcentaje: number;
  tiempoAhorradoMinutos: number;
  citas: number;
  citasProgramadas: number;
  citasEnAtencion: number;
  citasRealizadas: number;
  citasNoAsistio: number;
  citasCanceladas: number;
  vacunas: number;
  vacunasAlDia: number;
  vacunasProximas: number;
  vacunasVencidas: number;
  cumplimientoVacunacion: number;
  brigadas: number;
  brigadasPlanificadas: number;
  brigadasEnCurso: number;
  brigadasFinalizadas: number;
  brigadasParticipantes: number;
  topDiagnosticos: TopDiagnostico[];
  distribucionEspecies: ConteoPorClave[];
  consumoIaPorVeterinario: ConsumoPorVeterinario[];
  consolidadoVeterinarias: ConsolidadoVeterinaria[];
  pacientesPorMes: PuntoMensual[];
  consultasPorMes: PuntoMensual[];
  consultasPorVeterinario: ConsultasPorVeterinario[];
}

export interface PeriodoMetricas {
  desde?: string;
  hasta?: string;
  hoy?: Date;
  /** Filtra el resumen a un solo veterinario (drill-down para admin_veterinaria). */
  veterinarioId?: string;
  /** Filtra el resumen a una sola veterinaria (drill-down para admin_entidad). */
  veterinariaId?: string;
}

type RolMetrica = 'superadmin' | 'admin_entidad' | 'admin_veterinaria' | 'veterinario';
type Registro = { id: string; data: Record<string, unknown> };

const MINUTOS_AHORRO_POR_SOAP = 12;

@Injectable()
export class MetricasService {
  constructor(private readonly firebase: FirebaseService) {}

  async resumen(user: AuthUser, periodo: PeriodoMetricas = {}): Promise<Metricas> {
    const alcance = this.alcanceDe(user);
    const consumoPeriodo = periodoActual(periodo.hoy ?? new Date());
    const [pacientesAllConPlaceholders, consultasAll, citasAll, vacunasAll, consumosAll, brigadasAll] = await Promise.all([
      this.listarColeccion(COLLECTIONS.pacientes),
      this.listarColeccion(COLLECTIONS.consultas),
      this.listarColeccion(COLLECTIONS.citas),
      this.listarColeccion(COLLECTIONS.vacunas),
      this.listarColeccion(COLLECTIONS.consumos),
      this.listarColeccion(COLLECTIONS.brigadas),
    ]);
    // Los placeholders de "consulta rapida" (paciente temporal sin confirmar) no son
    // pacientes reales; el listado de Pacientes ya los excluye y las metricas deben
    // coincidir con ese mismo conteo, no inflarlo.
    const pacientesAll = pacientesAllConPlaceholders.filter((r) => r.data.esPlaceholder !== true);

    const porVeterinario = (r: Registro) =>
      !periodo.veterinarioId || this.str(r.data.veterinarioId) === periodo.veterinarioId;
    const porVeterinarioConsumo = (r: Registro) =>
      !periodo.veterinarioId ||
      this.str(r.data.veterinarioId) === periodo.veterinarioId ||
      this.str(r.data.scopeId) === periodo.veterinarioId;
    const porVeterinaria = (r: Registro) =>
      !periodo.veterinariaId || this.scopeVeterinaria(r.data) === periodo.veterinariaId;
    const porVeterinariaConsumo = (r: Registro) =>
      !periodo.veterinariaId ||
      this.scopeVeterinaria(r.data) === periodo.veterinariaId ||
      this.str(r.data.scopeId) === periodo.veterinariaId;

    const pacientesVisibles = pacientesAll.filter((r) => this.visiblePara(user, alcance, r.data));
    const consultasVisibles = consultasAll.filter((r) => this.visiblePara(user, alcance, r.data));
    const pacientes = pacientesVisibles.filter(porVeterinario).filter(porVeterinaria);
    const consultas = consultasVisibles
      .filter(porVeterinario)
      .filter(porVeterinaria)
      .filter((r) => this.enPeriodo(r.data, periodo));
    const citas = citasAll
      .filter((r) => this.visiblePara(user, alcance, r.data))
      .filter(porVeterinario)
      .filter(porVeterinaria)
      .filter((r) => this.enPeriodo(r.data, periodo));
    const vacunas = vacunasAll
      .filter((r) => this.visiblePara(user, alcance, r.data))
      .filter(porVeterinario)
      .filter(porVeterinaria)
      .filter((r) => !r.data.eliminadaEn)
      .filter((r) => this.enPeriodo(r.data, periodo));
    const consumos = consumosAll
      .filter((r) => this.visibleConsumo(user, alcance, r.data))
      .filter(porVeterinarioConsumo)
      .filter(porVeterinariaConsumo)
      .filter((r) => this.str(r.data.periodo) === consumoPeriodo || !this.str(r.data.periodo));
    // Las brigadas no tienen un veterinarioId singular (son varios participantes en
    // veterinarioIds), por eso el filtro de "ver un veterinario puntual" se hace distinto
    // al resto de colecciones.
    const porVeterinarioBrigada = (r: Registro) =>
      !periodo.veterinarioId || this.stringArray(r.data.veterinarioIds).includes(periodo.veterinarioId);
    const brigadas = brigadasAll
      .filter((r) => this.visiblePara(user, alcance, r.data))
      .filter(porVeterinarioBrigada)
      .filter(porVeterinaria)
      .filter((r) => this.enPeriodo(r.data, periodo));

    const consultasAprobadas = consultas.filter((r) => r.data.estado === 'aprobada');
    const soapGenerados = consultas.filter((r) => this.tieneSoap(r.data)).length;
    const pacientesAtendidos = new Set(
      consultasAprobadas.map((r) => this.str(r.data.pacienteId)).filter((v): v is string => Boolean(v)),
    ).size;
    const vacunasResumen = this.resumenVacunas(vacunas, periodo.hoy);
    const citasResumen = this.resumenCitas(citas);
    const brigadasResumen = this.resumenBrigadas(brigadas);
    const consumoResumen = await this.resumenConsumo(user, alcance, consumos, soapGenerados);

    return {
      alcance,
      periodo: {
        ...(periodo.desde ? { desde: periodo.desde } : {}),
        ...(periodo.hasta ? { hasta: periodo.hasta } : {}),
        consumo: consumoPeriodo,
      },
      pacientes: pacientes.length,
      pacientesAtendidos,
      consultas: consultas.length,
      consultasAprobadas: consultasAprobadas.length,
      soapGenerados,
      soapUsados: consumoResumen.usados,
      soapLimite: consumoResumen.limite,
      soapRestante: Math.max(0, consumoResumen.limite - consumoResumen.usados),
      soapPorcentaje: consumoResumen.porcentaje,
      tiempoAhorradoMinutos: soapGenerados * MINUTOS_AHORRO_POR_SOAP,
      citas: citas.length,
      ...citasResumen,
      vacunas: vacunas.length,
      ...vacunasResumen,
      brigadas: brigadas.length,
      ...brigadasResumen,
      topDiagnosticos: this.topDiagnosticos(consultasAprobadas),
      distribucionEspecies: this.distribucionEspecies(pacientes),
      consumoIaPorVeterinario: this.consumoPorVeterinario(consumos),
      consolidadoVeterinarias: this.consolidadoVeterinarias(pacientes, consultas, vacunas, citas),
      pacientesPorMes: this.serieMensual(pacientesVisibles.filter(porVeterinario).filter(porVeterinaria), periodo.hoy),
      consultasPorMes: this.serieMensual(consultasVisibles.filter(porVeterinario).filter(porVeterinaria), periodo.hoy),
      consultasPorVeterinario: this.consultasPorVeterinario(consultasVisibles),
    };
  }

  private async listarColeccion(col: string): Promise<Registro[]> {
    const snap = await this.firebase.firestore.collection(col).get();
    return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
  }

  private alcanceDe(user: AuthUser): Metricas['alcance'] {
    const role = this.rolCanonico(user);
    if (role === 'superadmin') return 'global';
    if (role === 'admin_entidad') return 'entidad';
    if (role === 'admin_veterinaria') return 'veterinaria';
    return 'individual';
  }

  private rolCanonico(user: AuthUser): RolMetrica {
    const role = user.role ?? this.roleDesdeLegacy(user.rol);
    if (role === 'superadmin' || role === 'admin_entidad' || role === 'admin_veterinaria') return role;
    return 'veterinario';
  }

  private roleDesdeLegacy(rol?: Rol): RolV2 | 'veterinario' {
    if (rol === 'superadmin') return 'superadmin';
    if (rol === 'admin') return 'admin_entidad';
    return 'veterinario';
  }

  private visiblePara(user: AuthUser, alcance: Metricas['alcance'], data: Record<string, unknown>): boolean {
    if (alcance === 'global') return true;
    if (alcance === 'entidad') {
      if (user.entidadId) return this.str(data.entidadId) === user.entidadId;
      return Boolean(user.orgId && (this.str(data.orgId) === user.orgId || this.str(data.legacyOrgId) === user.orgId));
    }
    if (alcance === 'veterinaria') {
      if (user.veterinariaId || user.accountId) {
        return Boolean(
          (user.veterinariaId && this.str(data.veterinariaId) === user.veterinariaId) ||
            (user.accountId && this.str(data.accountId) === user.accountId),
        );
      }
      return Boolean(user.orgId && this.str(data.orgId) === user.orgId);
    }
    const mismoVet =
      this.str(data.veterinarioId) === user.uid ||
      this.stringArray(data.veterinarioIds).includes(user.uid) ||
      this.stringArray(data.assignedVeterinarioIds).includes(user.uid);
    if (!mismoVet) return false;
    return !user.orgId || !this.str(data.orgId) || this.str(data.orgId) === user.orgId;
  }

  private visibleConsumo(user: AuthUser, alcance: Metricas['alcance'], data: Record<string, unknown>): boolean {
    if (alcance === 'global') return true;
    if (alcance === 'entidad') {
      if (user.entidadId) {
        return this.str(data.entidadId) === user.entidadId || this.str(data.scopeId) === user.entidadId;
      }
      return Boolean(user.orgId && this.str(data.orgId) === user.orgId);
    }
    if (alcance === 'veterinaria') {
      return Boolean(
        (user.veterinariaId &&
          (this.str(data.veterinariaId) === user.veterinariaId || this.str(data.scopeId) === user.veterinariaId)) ||
          (user.accountId && this.str(data.scopeId) === user.accountId) ||
          (!user.veterinariaId && !user.accountId && user.orgId && this.str(data.orgId) === user.orgId),
      );
    }
    return Boolean(
      this.str(data.veterinarioId) === user.uid ||
        this.str(data.scopeId) === user.uid ||
        this.str(data.scopeId) === `vet_${user.uid}`,
    );
  }

  private enPeriodo(data: Record<string, unknown>, periodo: PeriodoMetricas): boolean {
    if (!periodo.desde && !periodo.hasta) return true;
    const fecha = this.fechaRegistro(data);
    if (!fecha) return false;
    if (periodo.desde && fecha.getTime() < Date.parse(periodo.desde)) return false;
    if (periodo.hasta) {
      const hasta = new Date(periodo.hasta);
      hasta.setUTCHours(23, 59, 59, 999);
      if (fecha.getTime() > hasta.getTime()) return false;
    }
    return true;
  }

  private fechaRegistro(data: Record<string, unknown>): Date | null {
    for (const key of ['fechaHora', 'fecha', 'aplicada', 'creadoEn', 'createdAt', 'actualizadoEn', 'updatedAt']) {
      const fecha = this.aFecha(data[key]);
      if (fecha) return fecha;
    }
    return null;
  }

  // Los campos de auditoria (creadoEn, actualizadoEn, ...) se escriben con
  // admin.firestore.FieldValue.serverTimestamp() y vuelven como Timestamp de Firestore,
  // no como string ni como Date — sin este caso las metricas mensuales quedaban en cero
  // para cualquier registro que solo tuviera esos campos de auditoria.
  private aFecha(value: unknown): Date | null {
    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (value instanceof Date) return value;
    if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
    return null;
  }

  private tieneSoap(data: Record<string, unknown>): boolean {
    if (data.soap && typeof data.soap === 'object') return true;
    return ['subjetivo', 'objetivo', 'analisis', 'plan'].some((key) => typeof data[key] === 'string');
  }

  private resumenVacunas(
    vacunas: Registro[],
    hoy?: Date,
  ): Pick<Metricas, 'vacunasAlDia' | 'vacunasProximas' | 'vacunasVencidas' | 'cumplimientoVacunacion'> {
    let alDia = 0;
    let proximas = 0;
    let vencidas = 0;
    for (const { data } of vacunas) {
      const estado =
        data.estado === 'al_dia' || data.estado === 'proxima_a_vencer' || data.estado === 'vencida'
          ? data.estado
          : calcularEstadoVacuna(this.str(data.proximaDosis), hoy);
      if (estado === 'al_dia') alDia += 1;
      else if (estado === 'proxima_a_vencer') proximas += 1;
      else if (estado === 'vencida') vencidas += 1;
    }
    return {
      vacunasAlDia: alDia,
      vacunasProximas: proximas,
      vacunasVencidas: vencidas,
      cumplimientoVacunacion: vacunas.length > 0 ? Math.round((alDia / vacunas.length) * 100) : 100,
    };
  }

  private resumenCitas(
    citas: Registro[],
  ): Pick<Metricas, 'citasProgramadas' | 'citasEnAtencion' | 'citasRealizadas' | 'citasNoAsistio' | 'citasCanceladas'> {
    return {
      citasProgramadas: citas.filter((r) => r.data.estado === 'programada').length,
      citasEnAtencion: citas.filter((r) => r.data.estado === 'en_atencion').length,
      citasRealizadas: citas.filter((r) => r.data.estado === 'realizada').length,
      citasNoAsistio: citas.filter((r) => r.data.estado === 'no_asistio').length,
      citasCanceladas: citas.filter((r) => r.data.estado === 'cancelada').length,
    };
  }

  private resumenBrigadas(
    brigadas: Registro[],
  ): Pick<Metricas, 'brigadasPlanificadas' | 'brigadasEnCurso' | 'brigadasFinalizadas' | 'brigadasParticipantes'> {
    const participantes = new Set<string>();
    let planificadas = 0;
    let enCurso = 0;
    let finalizadas = 0;
    for (const { data } of brigadas) {
      if (data.estado === 'planificada') planificadas += 1;
      else if (data.estado === 'en_curso') enCurso += 1;
      else if (data.estado === 'finalizada') finalizadas += 1;
      for (const vetId of this.stringArray(data.veterinarioIds)) participantes.add(vetId);
    }
    return {
      brigadasPlanificadas: planificadas,
      brigadasEnCurso: enCurso,
      brigadasFinalizadas: finalizadas,
      brigadasParticipantes: participantes.size,
    };
  }

  private async resumenConsumo(
    user: AuthUser,
    alcance: Metricas['alcance'],
    consumos: Registro[],
    soapGenerados: number,
  ): Promise<{
    usados: number;
    limite: number;
    porcentaje: number;
  }> {
    const consumosResumen = this.consumosParaResumen(user, alcance, consumos);
    const usados = consumosResumen.reduce((acc, r) => acc + (this.num(r.data.usados) ?? 0), 0);
    const limitePersistido = consumosResumen.reduce((acc, r) => acc + (this.num(r.data.limite) ?? 0), 0);
    const limite =
      limitePersistido > 0
        ? limitePersistido
        : alcance === 'global'
          ? await resolverLimiteHistoriasGlobal(this.firebase)
          : await resolverLimiteHistoriasMes(this.firebase, user);
    const fallbackUsados = usados > 0 ? usados : soapGenerados;
    return {
      usados: fallbackUsados,
      limite,
      porcentaje: limite > 0 ? Math.min(100, Math.round((fallbackUsados / limite) * 100)) : 0,
    };
  }

  private consumosParaResumen(user: AuthUser, alcance: Metricas['alcance'], consumos: Registro[]): Registro[] {
    const planOwnerId =
      alcance === 'entidad'
        ? user.entidadId
        : alcance === 'veterinaria'
          ? user.veterinariaId ?? user.accountId
          : undefined;
    if (!planOwnerId) return consumos;
    const maestro = consumos.filter(
      (r) =>
        this.str(r.data.scopeId) === planOwnerId &&
        !this.str(r.data.veterinariaId) &&
        !this.str(r.data.veterinarioId),
    );
    return maestro.length > 0 ? maestro : consumos;
  }

  private topDiagnosticos(consultasAprobadas: Registro[]): TopDiagnostico[] {
    const counts = new Map<string, number>();
    for (const { data } of consultasAprobadas) {
      const diagnosticos = normalizarDiagnosticosEstructurados(data.diagnosticoEstructurado, { strict: false });
      const nombres =
        diagnosticos.length > 0
          ? diagnosticos.map((d) => d.nombre)
          : [this.diagnosticoLegacy(data)].filter((v): v is string => Boolean(v));
      for (const nombre of nombres) {
        const key = nombre.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return this.topCounts(counts, 5).map(({ clave, total }) => ({ nombre: clave, total }));
  }

  private diagnosticoLegacy(data: Record<string, unknown>): string | null {
    const soap = data.soap;
    if (!soap || typeof soap !== 'object') return null;
    const analisis = (soap as Record<string, unknown>).analisis;
    if (typeof analisis !== 'string') return null;
    const value = analisis.trim();
    return value || null;
  }

  private distribucionEspecies(pacientes: Registro[]): ConteoPorClave[] {
    const counts = new Map<string, number>();
    for (const { data } of pacientes) {
      const especie = this.str(data.especie) ?? 'sin_especie';
      counts.set(especie, (counts.get(especie) ?? 0) + 1);
    }
    return this.topCounts(counts, 12);
  }

  private consumoPorVeterinario(consumos: Registro[]): ConsumoPorVeterinario[] {
    const grouped = new Map<string, { usados: number; limite: number; bloqueado: boolean }>();
    for (const { data } of consumos) {
      const id = this.str(data.veterinarioId) ?? this.str(data.scopeId) ?? 'sin_veterinario';
      const current = grouped.get(id) ?? { usados: 0, limite: 0, bloqueado: false };
      current.usados += this.num(data.usados) ?? 0;
      current.limite += this.num(data.limite) ?? 0;
      current.bloqueado = current.bloqueado || data.bloqueado === true;
      grouped.set(id, current);
    }
    return [...grouped.entries()]
      .map(([veterinarioId, item]) => ({
        veterinarioId,
        usados: item.usados,
        limite: item.limite,
        porcentaje: item.limite > 0 ? Math.min(100, Math.round((item.usados / item.limite) * 100)) : 0,
        bloqueado: item.bloqueado || (item.limite > 0 && item.usados >= item.limite),
      }))
      .sort((a, b) => b.usados - a.usados || a.veterinarioId.localeCompare(b.veterinarioId));
  }

  // Ultimos 6 meses (incluido el actual), en orden cronologico, con meses sin datos en 0 —
  // asi el grafico de linea siempre tiene el mismo eje aunque no haya movimiento reciente.
  private serieMensual(registros: Registro[], hoy: Date = new Date(), meses = 6): PuntoMensual[] {
    const claves: string[] = [];
    for (let i = meses - 1; i >= 0; i -= 1) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      claves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const counts = new Map<string, number>(claves.map((c) => [c, 0]));
    for (const { data } of registros) {
      const fecha = this.fechaRegistro(data);
      if (!fecha) continue;
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (counts.has(clave)) counts.set(clave, (counts.get(clave) ?? 0) + 1);
    }
    return claves.map((mes) => ({ mes, total: counts.get(mes) ?? 0 }));
  }

  private consultasPorVeterinario(consultas: Registro[]): ConsultasPorVeterinario[] {
    const counts = new Map<string, number>();
    for (const { data } of consultas) {
      const id = this.str(data.veterinarioId) ?? 'sin_veterinario';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([veterinarioId, total]) => ({ veterinarioId, total }))
      .sort((a, b) => b.total - a.total || a.veterinarioId.localeCompare(b.veterinarioId));
  }

  private consolidadoVeterinarias(
    pacientes: Registro[],
    consultas: Registro[],
    vacunas: Registro[],
    citas: Registro[],
  ): ConsolidadoVeterinaria[] {
    const ids = new Set<string>();
    for (const r of [...pacientes, ...consultas, ...vacunas, ...citas]) {
      const id = this.str(r.data.veterinariaId) ?? this.str(r.data.accountId) ?? this.str(r.data.orgId);
      if (id) ids.add(id);
    }
    return [...ids]
      .sort()
      .map((veterinariaId) => ({
        veterinariaId,
        pacientes: pacientes.filter((r) => this.scopeVeterinaria(r.data) === veterinariaId).length,
        consultas: consultas.filter((r) => this.scopeVeterinaria(r.data) === veterinariaId).length,
        soapGenerados: consultas.filter((r) => this.scopeVeterinaria(r.data) === veterinariaId && this.tieneSoap(r.data)).length,
        vacunasVencidas: vacunas.filter(
          (r) => this.scopeVeterinaria(r.data) === veterinariaId && calcularEstadoVacuna(this.str(r.data.proximaDosis)) === 'vencida',
        ).length,
        citasProgramadas: citas.filter(
          (r) =>
            this.scopeVeterinaria(r.data) === veterinariaId &&
            (r.data.estado === 'programada' || r.data.estado === 'en_atencion'),
        ).length,
      }));
  }

  private scopeVeterinaria(data: Record<string, unknown>): string | undefined {
    return this.str(data.veterinariaId) ?? this.str(data.accountId) ?? this.str(data.orgId);
  }

  private topCounts(counts: Map<string, number>, limit: number): ConteoPorClave[] {
    return [...counts.entries()]
      .map(([clave, total]) => ({ clave, total }))
      .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave))
      .slice(0, limit);
  }

  private str(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  private num(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
