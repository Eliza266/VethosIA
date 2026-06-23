import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS, consumoDocId } from '../../common/firebase/collections';
import { ConsultasRepository } from './consultas.repository';
import { ConsultaDoc } from './consulta.types';
import { CrearConsultaDto } from './dto/crear-consulta.dto';
import { ActualizarConsultaDto } from './dto/actualizar-consulta.dto';
import { AuthUser } from '../../common/auth/auth-user.interface';
import {
  assertAcceso,
  assertOperacionClinica,
  filtroTenantRuntime,
  scopeClinicoParaCrearV2,
} from '../../common/auth/access';
import { runtimeScopeFromRecord } from '../../common/auth/runtime-v2';
import { ConsumoService, EstadoConsumo } from '../saas/consumo.service';
import { SuscripcionesService } from '../saas/suscripciones.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { jobEventKey } from '../plataforma/system-jobs.service';
import { CitasService } from '../citas/citas.service';
import {
  DiagnosticoEstructuradoValidationError,
  normalizarDiagnosticosEstructurados,
} from './diagnostico-estructurado';

export interface AprobarResult {
  estado: 'aprobada';
  consumo: EstadoConsumo | null;
}

// Reglas de la historia (PDF 02.5 / 03.5 / 06.D):
//  - procesar IA: BLOQUEADO si el consumo del plan llego al 100% del periodo.
//  - aprobar: borrador -> aprobada (solo lectura), propaga peso/talla, DESCUENTA 1 del plan,
//    audita y notifica al cruzar 80%/100%. Re-aprobar es idempotente (no re-descuenta).
//  - enmienda: corregir una aprobada NO sobrescribe; crea documento de enmienda enlazado.
@Injectable()
export class ConsultasService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly consultas: ConsultasRepository,
    private readonly consumo: ConsumoService,
    private readonly subs: SuscripcionesService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly citas: CitasService,
  ) {}

  async crear(dto: CrearConsultaDto, user: AuthUser): Promise<ConsultaDoc> {
    const pacSnap = await this.firebase.firestore
      .collection(COLLECTIONS.pacientes)
      .doc(dto.pacienteId)
      .get();
    if (!pacSnap.exists) {
      throw new NotFoundException(`Paciente ${dto.pacienteId} no existe.`);
    }
    const pacData = pacSnap.data() ?? {};
    const pacienteScope = runtimeScopeFromRecord(pacData);
    assertAcceso(user, pacienteScope);
    assertOperacionClinica(user, pacienteScope);

    const doc: Omit<ConsultaDoc, 'id'> = {
      pacienteId: dto.pacienteId,
      veterinarioId: user.uid,
      orgId: user.orgId,
      ...scopeClinicoParaCrearV2(user, pacienteScope),
      estado: 'borrador',
      ...(dto.numeroHC ? { numeroHC: dto.numeroHC } : {}),
      ...(dto.citaId ? { citaId: dto.citaId } : {}),
    };
    const creada = await this.consultas.crear(doc);
    if (dto.citaId) {
      await this.citas.vincularConsulta(dto.citaId, creada.id, dto.pacienteId, user);
    }
    return creada;
  }

  async listar(user: AuthUser, pacienteId?: string): Promise<ConsultaDoc[]> {
    const tenant = filtroTenantRuntime(user);
    return this.consultas.listar(tenant, pacienteId);
  }

  async obtener(id: string, user: AuthUser): Promise<ConsultaDoc> {
    const consulta = await this.consultas.getById(id);
    assertAcceso(user, consulta);
    return consulta;
  }

  // Hard delete (legacy deleteDoc). Soft delete seria preferible para auditoria/HC,
  // pero mantenemos paridad con el cliente Firestore hasta una migracion dedicada.
  async eliminar(id: string, user: AuthUser): Promise<{ eliminado: true }> {
    const consulta = await this.consultas.getById(id);
    assertAcceso(user, consulta);
    assertOperacionClinica(user, consulta);

    if (consulta.estado === 'aprobada') {
      throw new BadRequestException(
        'Las consultas aprobadas no se pueden eliminar; use POST /v1/consultas/:id/enmienda para correcciones.',
      );
    }

    await this.consultas.eliminar(id);
    return { eliminado: true };
  }

  async actualizar(id: string, dto: ActualizarConsultaDto, user: AuthUser): Promise<ConsultaDoc> {
    const consulta = await this.consultas.getById(id);
    assertAcceso(user, consulta);
    assertOperacionClinica(user, consulta);

    if (dto.estado === 'aprobada') {
      throw new BadRequestException(
        'Use POST /v1/consultas/:id/aprobar para aprobar la consulta.',
      );
    }

    if (consulta.estado === 'aprobada') {
      throw new BadRequestException(
        'Las consultas aprobadas son inmutables; use POST /v1/consultas/:id/enmienda para correcciones.',
      );
    }

    const payload = stripUndefinedFields({ ...dto }) as Record<string, unknown>;
    if (dto.diagnosticoEstructurado !== undefined) {
      try {
        payload.diagnosticoEstructurado = normalizarDiagnosticosEstructurados(
          dto.diagnosticoEstructurado,
          // strict:false = rellena defaults (tipo/estado/id) y salta vacios en vez de
          // tirar 400 cuando el vet edita un diagnostico parcial. Coherente con lectura/PDF.
          { origenDefault: 'manual', strict: false },
        );
      } catch (err) {
        if (err instanceof DiagnosticoEstructuradoValidationError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }
    await this.consultas.mergeRaw(id, {
      ...payload,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    return this.obtener(id, user);
  }

  // Gate previo a encolar IA: si el plan llego al 100%, no se permite generar (PDF 06.D).
  // Tambien deja el evento 'soap.inicio' en auditoria (PDF 07.C).
  async prepararProcesamiento(consultaId: string, user: AuthUser): Promise<void> {
    const consulta = await this.consultas.getById(consultaId);
    assertAcceso(user, consulta);
    assertOperacionClinica(user, consulta);

    const limite = await this.subs.limiteHistoriasMes(user);
    if (!(await this.consumo.puedeGenerar(user, limite))) {
      throw new ForbiddenException(
        'Limite de historias con IA del plan alcanzado para este periodo. Actualiza el plan o espera al reinicio.',
      );
    }
    await this.auditoria.registrar({
      accion: 'soap.inicio',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: consultaId,
    });
  }

  async aprobar(consultaId: string, user: AuthUser): Promise<AprobarResult> {
    const consultaPrev = await this.consultas.getById(consultaId);
    assertAcceso(user, consultaPrev);
    assertOperacionClinica(user, consultaPrev);

    const limite = await this.subs.limiteHistoriasMes(user);
    const db = this.firebase.firestore;
    const consultaRef = this.consultas.ref(consultaId);

    type TxResult =
      | { kind: 'already' }
      | { kind: 'approved'; consumo: EstadoConsumo; pacienteId?: string; citaId?: string; numeroHC?: string };

    const txResult = await db.runTransaction(async (tx): Promise<TxResult> => {
      const snap = await tx.get(consultaRef);
      if (!snap.exists) {
        throw new NotFoundException(`Consulta ${consultaId} no existe.`);
      }
      const data = snap.data() ?? {};
      const estado = typeof data.estado === 'string' ? data.estado : undefined;

      if (estado === 'aprobada') {
        return { kind: 'already' };
      }
      if (estado !== 'borrador') {
        throw new BadRequestException(
          `Solo se puede aprobar una historia en estado 'borrador' (actual: ${estado ?? 'desconocido'}).`,
        );
      }

      const consumo = await this.consumo.reservarUsoEnTransaccion(tx, user, limite);
      tx.set(
        consultaRef,
        {
          estado: 'aprobada',
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        kind: 'approved',
        consumo,
        pacienteId: typeof data.pacienteId === 'string' ? data.pacienteId : undefined,
        citaId: typeof data.citaId === 'string' ? data.citaId : undefined,
        numeroHC: typeof data.numeroHC === 'string' ? data.numeroHC : undefined,
      };
    });

    if (txResult.kind === 'already') {
      return { estado: 'aprobada', consumo: null };
    }

    await this.propagarSignos(consultaId, txResult.pacienteId);

    if (txResult.citaId) {
      await this.citas.cerrarDesdeConsulta(txResult.citaId, consultaId, txResult.numeroHC, user);
    }

    await this.auditoria.registrar({
      accion: 'historia.aprobar',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: consultaId,
    });
    await this.notificarConsultaAprobada(user, consultaId, txResult.pacienteId, txResult.numeroHC);
    await this.notificarConsumo(user, txResult.consumo);
    return { estado: 'aprobada', consumo: txResult.consumo };
  }

  async crearEnmienda(
    consultaId: string,
    user: AuthUser,
    contenido: Record<string, unknown>,
  ): Promise<{ enmiendaId: string }> {
    const consulta = await this.consultas.getById(consultaId);
    assertAcceso(user, consulta);
    assertOperacionClinica(user, consulta);
    if (consulta.estado !== 'aprobada') {
      throw new BadRequestException('Solo se enmiendan historias aprobadas.');
    }
    const ref = this.firebase.firestore.collection(COLLECTIONS.enmiendas).doc();
    const contenidoNormalizado = { ...contenido };
    if (contenido.diagnosticoEstructurado !== undefined) {
      try {
        contenidoNormalizado.diagnosticoEstructurado = normalizarDiagnosticosEstructurados(
          contenido.diagnosticoEstructurado,
          { origenDefault: 'manual', strict: false },
        );
      } catch (err) {
        if (err instanceof DiagnosticoEstructuradoValidationError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }
    await ref.set({
      consultaIdOrigen: consultaId,
      orgId: consulta.orgId ?? null,
      veterinarioId: consulta.veterinarioId ?? null,
      ...scopeClinicoParaCrearV2(user, consulta),
      autorUid: user.uid,
      contenido: contenidoNormalizado,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await this.auditoria.registrar({
      accion: 'historia.enmienda',
      actorUid: user.uid,
      orgId: user.orgId ?? null,
      recurso: consultaId,
    });
    return { enmiendaId: ref.id };
  }

  // Notifica al cruzar EXACTAMENTE el 80% y el 100% (una sola vez, porque el contador
  // sube de 1 en 1). Destinatario: el veterinario; admins de la entidad best-effort.
  private async notificarConsumo(user: AuthUser, c: EstadoConsumo): Promise<void> {
    if (c.limite <= 0) return;
    const umbral80 = Math.ceil(c.limite * 0.8);
    const resourceId = consumoDocId(c.scopeId, c.periodo);
    const resourcePath = `${COLLECTIONS.consumos}/${resourceId}`;
    if (c.usados === c.limite) {
      const dedupeKey = jobEventKey('consumo_100', resourceId, c.periodo);
      await this.notificaciones.crear({
        destinatarioUid: user.uid,
        orgId: user.orgId ?? null,
        entidadId: user.entidadId ?? null,
        veterinariaId: user.veterinariaId ?? null,
        tipo: 'consumo_100',
        titulo: 'Limite de IA alcanzado',
        cuerpo: `Llegaste al 100% (${c.usados}/${c.limite}) de historias con IA este periodo.`,
        resourceType: 'consumo',
        resourceId,
        resourcePath,
        dedupeKey,
      });
      await this.notificaciones.notificarAdminsEntidad(user.orgId, 'consumo_100', 'Entidad al 100% de consumo IA', `La entidad alcanzo el limite de IA (${c.usados}/${c.limite}).`, {
        entidadId: user.entidadId ?? null,
        veterinariaId: user.veterinariaId ?? null,
        resourceType: 'consumo',
        resourceId,
        resourcePath,
        dedupeKey,
      });
    } else if (c.usados === umbral80) {
      const dedupeKey = jobEventKey('consumo_80', resourceId, c.periodo);
      await this.notificaciones.crear({
        destinatarioUid: user.uid,
        orgId: user.orgId ?? null,
        entidadId: user.entidadId ?? null,
        veterinariaId: user.veterinariaId ?? null,
        tipo: 'consumo_80',
        titulo: 'Consumo de IA al 80%',
        cuerpo: `Vas en ${c.usados}/${c.limite} historias con IA este periodo.`,
        resourceType: 'consumo',
        resourceId,
        resourcePath,
        dedupeKey,
      });
      await this.notificaciones.notificarAdminsEntidad(user.orgId, 'consumo_80', 'Entidad al 80% de consumo IA', `La entidad va en ${c.usados}/${c.limite} de IA.`, {
        entidadId: user.entidadId ?? null,
        veterinariaId: user.veterinariaId ?? null,
        resourceType: 'consumo',
        resourceId,
        resourcePath,
        dedupeKey,
      });
    }
  }

  private async notificarConsultaAprobada(
    user: AuthUser,
    consultaId: string,
    pacienteId?: string,
    numeroHC?: string,
  ): Promise<void> {
    await this.notificaciones.crear({
      destinatarioUid: user.uid,
      orgId: user.orgId ?? null,
      tipo: 'consulta_aprobada',
      titulo: 'Consulta aprobada',
      cuerpo: numeroHC
        ? `La historia clinica ${numeroHC} quedo aprobada.`
        : 'La consulta quedo aprobada y lista para PDF.',
      resourceType: 'consulta',
      resourceId: consultaId,
      resourcePath: rutaConsultaPaciente(pacienteId, consultaId),
      pacienteId,
      consultaId,
      dedupeKey: `consulta_aprobada:${consultaId}:${user.uid}`,
    });
  }

  private async propagarSignos(consultaId: string, pacienteId?: string): Promise<void> {
    if (!pacienteId) return;
    const snap = await this.firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const sv = (data.signosVitales ?? {}) as Record<string, unknown>;
    const updates: Record<string, number> = {};
    if (typeof sv.peso === 'number') updates.ultimoPeso = sv.peso;
    const talla = sv.talla ?? sv.altura;
    if (typeof talla === 'number') updates.ultimaTalla = talla;
    if (Object.keys(updates).length > 0) {
      await this.firebase.firestore.collection(COLLECTIONS.pacientes).doc(pacienteId).set(updates, {
        merge: true,
      });
    }
  }
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function rutaConsultaPaciente(pacienteId: string | undefined, consultaId: string): string {
  return pacienteId ? `/pacientes/${pacienteId}/consultas/${consultaId}` : '/pacientes';
}
