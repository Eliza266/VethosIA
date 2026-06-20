import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuditoriaService } from '../../src/modules/plataforma/auditoria.service';
import { NotificacionesService } from '../../src/modules/plataforma/notificaciones.service';
import { MetricasService } from '../../src/modules/plataforma/metricas.service';
import {
  SystemJobsService,
  SystemJobEvent,
  jobEventKey,
  planificarCitaJobs,
  planificarConsumoJobs,
  planificarInvitacionJobs,
  planificarSuscripcionJobs,
  planificarVacunaJobs,
} from '../../src/modules/plataforma/system-jobs.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { fakeFirebase } from './saas.fakes';
import { WorkerGuard } from '../../src/modules/ia/worker.guard';

const admin: AuthUser = { uid: 'a1', orgId: 'orgA', rol: 'admin' };
const vet: AuthUser = { uid: 'v1', orgId: 'orgA', rol: 'vet' };
const superadmin: AuthUser = { uid: 'root', rol: 'superadmin' };

function ctx(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: (h: string) => headers[h.toLowerCase()] }),
    }),
  } as unknown as ExecutionContext;
}

function hasUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefinedDeep);
  if (value && typeof value === 'object' && isPlainRecord(value)) {
    return Object.values(value).some(hasUndefinedDeep);
  }
  return false;
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

describe('AuditoriaService', () => {
  it('registra un evento con actor/orgId/recurso y retencion', async () => {
    const { fb, fs } = fakeFirebase();
    const svc = new AuditoriaService(fb);
    const { id } = await svc.registrar({ accion: 'historia.aprobar', actorUid: 'v1', orgId: 'orgA', recurso: 'c1' });
    const doc = fs.store.get(`auditoria/${id}`);
    expect(doc).toMatchObject({ accion: 'historia.aprobar', actorUid: 'v1', orgId: 'orgA', recurso: 'c1' });
    expect(doc!.retencionHasta).toBeDefined();
  });

  it('listar: admin ve su org; vet no superadmin sin org no ve', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('auditoria/l1', { accion: 'login', orgId: 'orgA' });
    fs.store.set('auditoria/l2', { accion: 'login', orgId: 'orgB' });
    const svc = new AuditoriaService(fb);
    const delAdmin = await svc.listar(admin);
    expect(delAdmin.every((d) => (d as Record<string, unknown>).orgId === 'orgA')).toBe(true);
    const delSuper = await svc.listar(superadmin);
    expect(delSuper.length).toBe(2);
  });
});

describe('NotificacionesService', () => {
  it('crea notificacion para el destinatario correcto y la lista', async () => {
    const { fb } = fakeFirebase();
    const svc = new NotificacionesService(fb);
    await svc.crear({ destinatarioUid: 'v1', orgId: 'orgA', tipo: 'consumo_80', titulo: '80%', cuerpo: 'ojo' });
    const delVet = await svc.listar(vet);
    expect(delVet.length).toBe(1);
    const deOtro = await svc.listar({ uid: 'otro', rol: 'vet' });
    expect(deOtro.length).toBe(0);
  });

  it('guarda metadata de consulta para deep links sin exponer otros destinatarios', async () => {
    const { fb } = fakeFirebase();
    const svc = new NotificacionesService(fb);
    await svc.crear({
      destinatarioUid: 'v1',
      orgId: 'orgA',
      tipo: 'consulta_aprobada',
      titulo: 'Consulta aprobada',
      cuerpo: 'HC lista',
      resourceType: 'consulta',
      resourceId: 'c1',
      resourcePath: '/pacientes/p1/consultas/c1',
      pacienteId: 'p1',
      consultaId: 'c1',
    });

    await expect(svc.listar(vet)).resolves.toEqual([
      expect.objectContaining({
        resourceType: 'consulta',
        resourceId: 'c1',
        resourcePath: '/pacientes/p1/consultas/c1',
        pacienteId: 'p1',
        consultaId: 'c1',
      }),
    ]);
    await expect(svc.listar({ uid: 'otro', orgId: 'orgA', rol: 'vet' })).resolves.toEqual([]);
  });

  it('marcarLeida solo afecta la del destinatario', async () => {
    const { fb, fs } = fakeFirebase();
    const svc = new NotificacionesService(fb);
    const { id } = await svc.crear({ destinatarioUid: 'v1', tipo: 'bienvenida', titulo: 'hola', cuerpo: 'x' });
    await svc.marcarLeida(id, vet);
    expect(fs.store.get(`notificaciones/${id}`)).toMatchObject({ leida: true });
    await expect(svc.marcarLeida(id, { uid: 'otro', rol: 'vet' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marca todas las notificaciones propias como leidas', async () => {
    const { fb, fs } = fakeFirebase();
    const svc = new NotificacionesService(fb);
    await svc.crear({ destinatarioUid: 'v1', tipo: 'bienvenida', titulo: 'hola', cuerpo: 'x' });
    await svc.crear({ destinatarioUid: 'v1', tipo: 'consumo_80', titulo: '80%', cuerpo: 'x' });
    await svc.crear({ destinatarioUid: 'otro', tipo: 'bienvenida', titulo: 'otro', cuerpo: 'x' });

    await expect(svc.marcarTodasLeidas(vet)).resolves.toMatchObject({ actualizadas: 2 });

    const propias = [...fs.store.values()].filter((v) => v.destinatarioUid === 'v1');
    expect(propias.every((v) => v.leida === true)).toBe(true);
    const ajena = [...fs.store.values()].find((v) => v.destinatarioUid === 'otro');
    expect(ajena).toMatchObject({ leida: false });
  });

  it('deduplica notificaciones por destinatario y dedupeKey', async () => {
    const { fb, fs } = fakeFirebase();
    const svc = new NotificacionesService(fb);
    const a = await svc.crear({
      destinatarioUid: 'v1',
      tipo: 'vacunas_pendientes',
      titulo: 'Vacuna vencida',
      cuerpo: 'Rabia',
      dedupeKey: 'vacuna:v1:vencida:2026-01-01',
    });
    const b = await svc.crear({
      destinatarioUid: 'v1',
      tipo: 'vacunas_pendientes',
      titulo: 'Vacuna vencida',
      cuerpo: 'Rabia',
      dedupeKey: 'vacuna:v1:vencida:2026-01-01',
    });

    expect(a.id).toBe(b.id);
    expect([...fs.store.keys()].filter((k) => k.startsWith('notificaciones/'))).toHaveLength(1);
  });

  it('notifica admins legacy y V2 con recurso y dedupe por destinatario', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('miembros/admin-legacy', { orgId: 'orgA', rol: 'admin' });
    fs.store.set('miembros/admin-v2', { orgId: 'orgA', role: 'admin_veterinaria' });
    fs.store.set('miembros/vet', { orgId: 'orgA', rol: 'vet' });
    fs.store.set('miembros/admin-otro', { orgId: 'orgB', rol: 'admin' });
    const svc = new NotificacionesService(fb);

    await svc.notificarAdminsEntidad('orgA', 'consumo_80', '80%', 'ojo', {
      dedupeKey: 'consumo_80:orgA:2026-06',
      resourceType: 'consumo',
      resourceId: 'orgA_2026-06',
      resourcePath: 'consumos/orgA_2026-06',
    });
    await svc.notificarAdminsEntidad('orgA', 'consumo_80', '80%', 'ojo', {
      dedupeKey: 'consumo_80:orgA:2026-06',
      resourceType: 'consumo',
      resourceId: 'orgA_2026-06',
      resourcePath: 'consumos/orgA_2026-06',
    });

    const notificaciones = [...fs.store.values()].filter((v) => v.tipo === 'consumo_80');
    expect(notificaciones).toHaveLength(2);
    expect(notificaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destinatarioUid: 'admin-legacy', resourceType: 'consumo' }),
        expect.objectContaining({ destinatarioUid: 'admin-v2', resourcePath: 'consumos/orgA_2026-06' }),
      ]),
    );
  });

  it('notifica admins por scope V2 sin mezclar entidades que comparten orgId', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('miembros/admin-ent-a', { orgId: 'orgA', role: 'admin_entidad', entidadId: 'entA' });
    fs.store.set('miembros/admin-ent-b', { orgId: 'orgA', role: 'admin_entidad', entidadId: 'entB' });
    fs.store.set('miembros/admin-vet-a', {
      orgId: 'orgA',
      role: 'admin_veterinaria',
      entidadId: 'entA',
      veterinariaId: 'vetA',
    });
    fs.store.set('miembros/admin-vet-b', {
      orgId: 'orgA',
      role: 'admin_veterinaria',
      entidadId: 'entA',
      veterinariaId: 'vetB',
    });
    fs.store.set('miembros/admin-legacy-org', { orgId: 'orgA', rol: 'admin' });
    const svc = new NotificacionesService(fb);

    await svc.notificarAdminsEntidad('orgA', 'consumo_100', '100%', 'limite', {
      entidadId: 'entA',
      veterinariaId: 'vetA',
      dedupeKey: 'consumo_100:entA:2026-06',
      resourceType: 'consumo',
      resourceId: 'entA_2026-06',
    });
    await svc.notificarAdminsEntidad('orgA', 'consumo_100', '100%', 'limite', {
      entidadId: 'entA',
      veterinariaId: 'vetA',
      dedupeKey: 'consumo_100:entA:2026-06',
      resourceType: 'consumo',
      resourceId: 'entA_2026-06',
    });

    const notificaciones = [...fs.store.values()].filter((v) => v.tipo === 'consumo_100');
    expect(notificaciones).toHaveLength(2);
    expect(notificaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destinatarioUid: 'admin-ent-a', entidadId: 'entA', veterinariaId: 'vetA' }),
        expect.objectContaining({ destinatarioUid: 'admin-vet-a', entidadId: 'entA', veterinariaId: 'vetA' }),
      ]),
    );
    expect(notificaciones.some((n) => n.destinatarioUid === 'admin-ent-b')).toBe(false);
    expect(notificaciones.some((n) => n.destinatarioUid === 'admin-vet-b')).toBe(false);
    expect(notificaciones.some((n) => n.destinatarioUid === 'admin-legacy-org')).toBe(false);
  });
});

describe('MetricasService', () => {
  it('alcance individual para vet; entidad para admin; global para superadmin', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('pacientes/p1', { orgId: 'orgA', veterinarioId: 'v1' });
    fs.store.set('pacientes/p2', { orgId: 'orgA', veterinarioId: 'otro' });
    fs.store.set('pacientes/p3', { orgId: 'orgB', veterinarioId: 'z' });
    const svc = new MetricasService(fb);

    const mVet = await svc.resumen(vet);
    expect(mVet.alcance).toBe('individual');
    expect(mVet.pacientes).toBe(1);

    const mAdmin = await svc.resumen(admin);
    expect(mAdmin.alcance).toBe('entidad');
    expect(mAdmin.pacientes).toBe(2);

    const mSuper = await svc.resumen(superadmin);
    expect(mSuper.alcance).toBe('global');
    expect(mSuper.pacientes).toBe(3);
  });

  it('calcula top diagnosticos solo desde consultas aprobadas y por alcance', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('consultas/c1', {
      estado: 'aprobada',
      orgId: 'orgA',
      veterinarioId: 'v1',
      diagnosticoEstructurado: [
        {
          id: 'd1',
          nombre: 'Gastroenteritis',
          tipo: 'principal',
          estado: 'presuntivo',
          origen: 'manual',
          creadoEn: '2026-06-18T00:00:00.000Z',
        },
      ],
    });
    fs.store.set('consultas/c2', {
      estado: 'aprobada',
      orgId: 'orgA',
      veterinarioId: 'v2',
      soap: { analisis: 'Otitis externa' },
    });
    fs.store.set('consultas/c3', {
      estado: 'borrador',
      orgId: 'orgA',
      veterinarioId: 'v1',
      diagnosticoEstructurado: [
        {
          id: 'd3',
          nombre: 'No contar',
          tipo: 'principal',
          estado: 'presuntivo',
          origen: 'manual',
          creadoEn: '2026-06-18T00:00:00.000Z',
        },
      ],
    });
    fs.store.set('consultas/c4', {
      estado: 'aprobada',
      orgId: 'orgB',
      veterinarioId: 'v1',
      diagnosticoEstructurado: [
        {
          id: 'd4',
          nombre: 'Dermatitis',
          tipo: 'principal',
          estado: 'confirmado',
          origen: 'manual',
          creadoEn: '2026-06-18T00:00:00.000Z',
        },
      ],
    });

    const svc = new MetricasService(fb);
    await expect(svc.resumen(vet)).resolves.toMatchObject({
      topDiagnosticos: [{ nombre: 'Gastroenteritis', total: 1 }],
    });
    await expect(svc.resumen(admin)).resolves.toMatchObject({
      topDiagnosticos: [
        { nombre: 'Gastroenteritis', total: 1 },
        { nombre: 'Otitis externa', total: 1 },
      ],
    });
  });

  it('calcula vacunas proximas vencidas y cumplimiento por alcance', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('vacunas/v1', {
      orgId: 'orgA',
      veterinarioId: 'v1',
      proximaDosis: '2999-01-01',
    });
    fs.store.set('vacunas/v2', {
      orgId: 'orgA',
      veterinarioId: 'v1',
      proximaDosis: '2000-01-01',
    });
    fs.store.set('vacunas/v3', {
      orgId: 'orgA',
      veterinarioId: 'v2',
      proximaDosis: '2000-01-01',
    });
    fs.store.set('vacunas/v4', {
      orgId: 'orgB',
      veterinarioId: 'v1',
      proximaDosis: '2000-01-01',
    });
    fs.store.set('vacunas/deleted', {
      orgId: 'orgA',
      veterinarioId: 'v1',
      proximaDosis: '2000-01-01',
      eliminadaEn: '2026-06-01',
    });

    const svc = new MetricasService(fb);
    await expect(svc.resumen(vet)).resolves.toMatchObject({
      vacunas: 2,
      vacunasVencidas: 1,
      cumplimientoVacunacion: 50,
    });
    await expect(svc.resumen(admin)).resolves.toMatchObject({
      vacunas: 3,
      vacunasVencidas: 2,
      cumplimientoVacunacion: 33,
    });
  });

  it('calcula metricas Fase 1 por admin veterinaria, admin entidad y superadmin sin cross-tenant', async () => {
    const { fb, fs } = fakeFirebase();
    const adminVet: AuthUser = {
      uid: 'adminVet',
      orgId: 'orgA',
      rol: 'admin',
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    };
    const adminEnt: AuthUser = {
      uid: 'adminEnt',
      orgId: 'orgA',
      rol: 'admin',
      role: 'admin_entidad',
      accountType: 'entidad',
      accountId: 'ent_1',
      entidadId: 'ent_1',
    };

    fs.store.set('pacientes/p1', { orgId: 'orgA', entidadId: 'ent_1', veterinariaId: 'vetclin_1', especie: 'perro' });
    fs.store.set('pacientes/p2', { orgId: 'orgA', entidadId: 'ent_1', veterinariaId: 'vetclin_2', especie: 'gato' });
    fs.store.set('pacientes/p3', { orgId: 'orgB', entidadId: 'ent_2', veterinariaId: 'vetclin_3', especie: 'ave' });
    fs.store.set('consultas/c1', {
      estado: 'aprobada',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      veterinarioId: 'vet1',
      pacienteId: 'p1',
      fechaHora: '2026-06-10T10:00:00Z',
      soap: { analisis: 'Otitis externa' },
    });
    fs.store.set('consultas/c2', {
      estado: 'borrador',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      veterinarioId: 'vet2',
      pacienteId: 'p2',
      fechaHora: '2026-06-10T11:00:00Z',
      soap: { analisis: 'Borrador no top' },
    });
    fs.store.set('consultas/c3', {
      estado: 'aprobada',
      orgId: 'orgB',
      entidadId: 'ent_2',
      veterinariaId: 'vetclin_3',
      veterinarioId: 'vet3',
      pacienteId: 'p3',
      fechaHora: '2026-06-10T12:00:00Z',
      soap: { analisis: 'Dermatitis' },
    });
    fs.store.set('citas/cta1', {
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      estado: 'no_asistio',
      fecha: '2026-06-10T13:00:00Z',
    });
    fs.store.set('citas/cta2', {
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      estado: 'realizada',
      fecha: '2026-06-10T14:00:00Z',
    });
    fs.store.set('vacunas/vac1', {
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      proximaDosis: '2000-01-01',
      especie: 'perro',
    });
    fs.store.set('vacunas/vac2', {
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      proximaDosis: '2999-01-01',
      especie: 'gato',
    });
    fs.store.set('consumos/vet1_2026-06', {
      scopeId: 'vet1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      veterinarioId: 'vet1',
      periodo: '2026-06',
      usados: 8,
      limite: 10,
    });
    fs.store.set('consumos/vet3_2026-06', {
      scopeId: 'vet3',
      orgId: 'orgB',
      entidadId: 'ent_2',
      veterinariaId: 'vetclin_3',
      veterinarioId: 'vet3',
      periodo: '2026-06',
      usados: 9,
      limite: 10,
    });

    const svc = new MetricasService(fb);
    await expect(svc.resumen(adminVet, { hoy: new Date('2026-06-18T00:00:00Z') })).resolves.toMatchObject({
      alcance: 'veterinaria',
      pacientes: 1,
      consultas: 1,
      consultasAprobadas: 1,
      pacientesAtendidos: 1,
      soapUsados: 8,
      soapLimite: 10,
      citasNoAsistio: 1,
      vacunasVencidas: 1,
      topDiagnosticos: [{ nombre: 'Otitis externa', total: 1 }],
      distribucionEspecies: [{ clave: 'perro', total: 1 }],
    });
    await expect(svc.resumen(adminEnt, { hoy: new Date('2026-06-18T00:00:00Z') })).resolves.toMatchObject({
      alcance: 'entidad',
      pacientes: 2,
      consultas: 2,
      soapUsados: 8,
      citasRealizadas: 1,
      consolidadoVeterinarias: expect.arrayContaining([
        expect.objectContaining({ veterinariaId: 'vetclin_1', pacientes: 1 }),
        expect.objectContaining({ veterinariaId: 'vetclin_2', pacientes: 1 }),
      ]),
    });
    await expect(svc.resumen(superadmin, { hoy: new Date('2026-06-18T00:00:00Z') })).resolves.toMatchObject({
      alcance: 'global',
      pacientes: 3,
      soapUsados: 17,
    });
  });

  it('admin entidad usa entidadId antes que orgId y evita doble conteo de consumo maestro', async () => {
    const { fb, fs } = fakeFirebase();
    const adminEnt: AuthUser = {
      uid: 'adminEnt',
      orgId: 'orgA',
      rol: 'admin',
      role: 'admin_entidad',
      accountType: 'entidad',
      accountId: 'ent_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    };

    fs.store.set('pacientes/p1', { orgId: 'orgA', entidadId: 'ent_1', veterinariaId: 'vetclin_1' });
    fs.store.set('pacientes/p2', { orgId: 'orgA', entidadId: 'ent_2', veterinariaId: 'vetclin_2' });
    fs.store.set('consumos/ent_1_2026-06', {
      scopeId: 'ent_1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      periodo: '2026-06',
      usados: 12,
      limite: 30,
    });
    fs.store.set('consumos/vet1_2026-06', {
      scopeId: 'vet1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      veterinarioId: 'vet1',
      periodo: '2026-06',
      usados: 8,
      limite: 10,
    });
    fs.store.set('consumos/ent_2_2026-06', {
      scopeId: 'ent_2',
      orgId: 'orgA',
      entidadId: 'ent_2',
      periodo: '2026-06',
      usados: 99,
      limite: 100,
    });

    const svc = new MetricasService(fb);

    await expect(svc.resumen(adminEnt, { hoy: new Date('2026-06-18T00:00:00Z') })).resolves.toMatchObject({
      alcance: 'entidad',
      pacientes: 1,
      soapUsados: 12,
      soapLimite: 30,
      soapRestante: 18,
    });
  });

  it('resuelve el limite de SOAP desde suscripcion cuando consumo legacy no tiene limite', async () => {
    const { fb, fs } = fakeFirebase();
    fs.store.set('consultas/c1', {
      estado: 'aprobada',
      orgId: 'orgA',
      veterinarioId: 'v1',
      soap: { subjetivo: 's', objetivo: 'o', analisis: 'a', plan: 'p' },
    });
    fs.store.set('consultas/c2', {
      estado: 'aprobada',
      orgId: 'orgA',
      veterinarioId: 'v1',
      soap: { subjetivo: 's', objetivo: 'o', analisis: 'a', plan: 'p' },
    });
    fs.store.set('consumos/orgA_2026-06', {
      scopeId: 'orgA',
      orgId: 'orgA',
      periodo: '2026-06',
      usados: 2,
    });
    fs.store.set('suscripciones/sub-orgA', {
      orgId: 'orgA',
      planId: 'trial',
      estado: 'trial_activa',
      limiteHistoriasMes: 30,
    });

    const svc = new MetricasService(fb);

    await expect(svc.resumen(admin, { hoy: new Date('2026-06-18T00:00:00Z') })).resolves.toMatchObject({
      soapUsados: 2,
      soapLimite: 30,
      soapRestante: 28,
      soapPorcentaje: 7,
    });
  });
});

describe('SystemJobsController security', () => {
  const OLD = process.env;

  afterEach(() => {
    process.env = OLD;
  });

  it('rechaza endpoint interno sin x-worker-secret cuando IA_WORKER_SECRET existe', () => {
    process.env = { ...OLD, IA_WORKER_SECRET: 'secret-worker-system-jobs-min-32-chars' };
    const guard = new WorkerGuard();

    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
    expect(guard.canActivate(ctx({ 'x-worker-secret': 'secret-worker-system-jobs-min-32-chars' }))).toBe(true);
  });

  it('falla cerrado en produccion sin secreto seguro', () => {
    process.env = { ...OLD, NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '', IA_WORKER_SECRET: '' };
    const guard = new WorkerGuard();

    expect(() => guard.canActivate(ctx({ authorization: 'Bearer token' }))).toThrow(UnauthorizedException);
  });

  it('rechaza secreto corto en produccion', () => {
    process.env = { ...OLD, NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '', IA_WORKER_SECRET: 'corto' };
    const guard = new WorkerGuard();

    expect(() => guard.canActivate(ctx({ 'x-worker-secret': 'corto' }))).toThrow(UnauthorizedException);
  });
});

describe('SystemJobsService', () => {
  const hoy = new Date('2026-06-17T12:00:00Z');

  it('construye claves idempotentes estables por evento/recurso/periodo', () => {
    expect(jobEventKey('cita_proximas_2h', 'cita/1', '2026-06-17T13')).toBe(
      'cita_proximas_2h_cita_1_2026-06-17T13',
    );
  });

  it('planifica suscripciones, citas, vacunas, consumo e invitaciones sin canales externos', () => {
    expect(
      planificarSuscripcionJobs(
        [
          { id: 'sub1', estado: 'activa', vigenteHasta: '2026-06-18T00:00:00Z', orgId: 'orgA' },
          { id: 'sub2', estado: 'vencida', vigenteHasta: '2026-06-01T00:00:00Z', orgId: 'orgA' },
          { id: 'sub3', estado: 'trial_activa', trialHasta: '2026-06-01T00:00:00Z', orgId: 'orgA' },
        ],
        hoy,
      ).map((e) => e.kind),
    ).toEqual(['suscripcion_por_vencer', 'suscripcion_bloqueada_mora', 'trial_finalizado']);

    expect(
      planificarCitaJobs(
        [{ id: 'c1', estado: 'programada', fecha: '2026-06-17T13:30:00Z', veterinarioId: 'v1' }],
        hoy,
      )[0].kind,
    ).toBe('cita_proximas_2h');
    expect(
      planificarCitaJobs(
        [{ id: 'c2', estado: 'programada', fecha: '2026-06-18T15:00:00Z', veterinarioId: 'v1' }],
        hoy,
      )[0].kind,
    ).toBe('cita_dia_anterior');

    expect(
      planificarVacunaJobs(
        [{ id: 'v1', nombre: 'Rabia', proximaDosis: '2026-06-10T00:00:00Z', veterinarioId: 'vet1' }],
        hoy,
      ).map((e) => e.kind),
    ).toEqual(['vacuna_vencida']);
    expect(
      planificarVacunaJobs(
        [{ id: 'v1', nombre: 'Rabia', proximaDosis: '2026-06-10T00:00:00Z', veterinarioId: 'vet1' }],
        new Date('2026-06-22T12:00:00Z'),
      ).map((e) => e.kind),
    ).toEqual(['vacuna_vencida', 'vacunas_resumen_semanal']);

    expect(
      planificarConsumoJobs(
        [
          { id: 'vet_v1_2026-06', scopeId: 'vet_v1', periodo: '2026-06', usados: 8, limite: 10, orgId: 'orgA' },
          { id: 'vet_v2_2026-06', scopeId: 'vet_v2', periodo: '2026-06', usados: 10, limite: 10, orgId: 'orgA' },
          { id: 'vet_v3_2026-05', scopeId: 'vet_v3', periodo: '2026-05', usados: 3, limite: 10, orgId: 'orgA' },
        ],
        new Date('2026-06-01T12:00:00Z'),
      ).map((e) => e.kind),
    ).toEqual(['consumo_80', 'consumo_100', 'consumo_reinicio_mensual']);

    expect(
      planificarInvitacionJobs(
        [{ id: 'inv1', orgId: 'orgA', creadoPor: 'admin1', exp: Date.parse('2026-06-15T12:00:00Z') }],
        hoy,
      )[0].kind,
    ).toBe('invitacion_expirada');
  });

  it('planifica suscripciones con gracia logica sin estado nuevo', () => {
    const eventos = planificarSuscripcionJobs(
      [
        { id: 'por-vencer', estado: 'activa', vigenteHasta: '2026-06-20T00:00:00Z', orgId: 'orgA' },
        { id: 'vencida', estado: 'activa', vigenteHasta: '2026-06-16T00:00:00Z', orgId: 'orgA' },
        { id: 'en-gracia', estado: 'vencida', vigenteHasta: '2026-06-15T00:00:00Z', orgId: 'orgA' },
        { id: 'bloquear', estado: 'vencida', vigenteHasta: '2026-06-01T00:00:00Z', orgId: 'orgA' },
        { id: 'trial', estado: 'trial_activa', trialHasta: '2026-06-01T00:00:00Z', orgId: 'orgA' },
      ],
      hoy,
    );

    expect(eventos.map((e) => [e.resourceId, e.kind, e.targetEstado])).toEqual([
      ['por-vencer', 'suscripcion_por_vencer', 'por_vencer'],
      ['vencida', 'suscripcion_vencida', 'vencida'],
      ['bloquear', 'suscripcion_bloqueada_mora', 'bloqueada_mora'],
      ['trial', 'trial_finalizado', 'bloqueado_fin_trial'],
    ]);
    expect(eventos.some((e) => e.resourceId === 'en-gracia')).toBe(false);
  });

  it('planifica citas solo si estan programadas', () => {
    const eventos = planificarCitaJobs(
      [
        { id: 'manana', estado: 'programada', fecha: '2026-06-18T15:00:00Z', veterinarioId: 'vet1' },
        { id: 'dos-horas', estado: 'programada', fecha: '2026-06-17T13:00:00Z', veterinarioId: 'vet1' },
        { id: 'no-asistio', estado: 'programada', fecha: '2026-06-15T11:00:00Z', veterinarioId: 'vet1' },
        { id: 'realizada', estado: 'realizada', fecha: '2026-06-15T11:00:00Z', veterinarioId: 'vet1' },
        { id: 'sin-estado', fecha: '2026-06-15T11:00:00Z', veterinarioId: 'vet1' },
      ],
      hoy,
    );

    expect(eventos.map((e) => [e.resourceId, e.kind, e.targetEstado])).toEqual([
      ['manana', 'cita_dia_anterior', undefined],
      ['dos-horas', 'cita_proximas_2h', undefined],
      ['no-asistio', 'cita_no_asistio', 'no_asistio'],
    ]);
  });

  it('planifica invitaciones expiradas solo si siguen pendientes', () => {
    const eventos = planificarInvitacionJobs(
      [
        { id: 'pendiente', estado: 'pendiente', orgId: 'orgA', exp: Date.parse('2026-06-15T00:00:00Z') },
        { id: 'legacy', orgId: 'orgA', exp: Date.parse('2026-06-15T00:00:00Z') },
        { id: 'aceptada', estado: 'aceptada', orgId: 'orgA', exp: Date.parse('2026-06-15T00:00:00Z') },
        { id: 'revision', estado: 'revision_tecnica', orgId: 'orgA', exp: Date.parse('2026-06-15T00:00:00Z') },
        { id: 'revocada', estado: 'pendiente', orgId: 'orgA', revocadaEn: {}, exp: Date.parse('2026-06-15T00:00:00Z') },
      ],
      hoy,
    );

    expect(eventos.map((e) => e.resourceId)).toEqual(['pendiente', 'legacy']);
  });

  it('ejecuta jobs de sistema de forma idempotente', async () => {
    const { fb, fs } = fakeFirebase();
    const notificaciones = new NotificacionesService(fb);
    const auditoria = new AuditoriaService(fb);
    const jobs = new SystemJobsService(fb, notificaciones, auditoria);

    fs.store.set('miembros/admin-orgA', { orgId: 'orgA', rol: 'admin' });
    fs.store.set('miembros/admin-orgB', { orgId: 'orgB', rol: 'admin' });
    fs.store.set('miembros/vet1', { orgId: 'orgA', rol: 'vet', uid: 'vet1' });
    fs.store.set('suscripciones/sub-vencida', {
      estado: 'vencida',
      vigenteHasta: '2026-06-01T00:00:00Z',
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('suscripciones/sub-trial', {
      estado: 'trial_activa',
      trialHasta: '2026-06-01T00:00:00Z',
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('citas/cita1', {
      estado: 'programada',
      fecha: '2026-06-17T13:00:00Z',
      orgId: 'orgA',
      veterinarioId: 'vet1',
      pacienteId: 'pac1',
      consultaId: 'cons1',
    });
    fs.store.set('vacunas/vacuna1', {
      nombre: 'Rabia',
      proximaDosis: '2026-06-10T00:00:00Z',
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('consumos/vet_vet1_2026-06', {
      scopeId: 'vet_vet1',
      periodo: '2026-06',
      usados: 10,
      limite: 10,
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('consumos/vet_vet1_2026-05', {
      scopeId: 'vet_vet1',
      periodo: '2026-05',
      usados: 7,
      limite: 10,
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('invitaciones/inv1', {
      orgId: 'orgA',
      creadoPor: 'admin-orgA',
      email: 'vet@x.com',
      rol: 'vet',
      exp: Date.parse('2026-06-15T00:00:00Z'),
    });

    const first = await jobs.ejecutar(hoy);
    const second = await jobs.ejecutar(hoy);

    expect(first.created).toBeGreaterThan(0);
    expect(first.updated).toBe(1);
    expect(first.errors).toBe(0);
    expect(second.created).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
    expect(fs.store.get('suscripciones/sub-vencida')).toMatchObject({ estado: 'bloqueada_mora' });
    expect(fs.store.get('suscripciones/sub-trial')).toMatchObject({ estado: 'bloqueado_fin_trial' });
    expect(fs.store.get('vacunas/vacuna1')).toMatchObject({ estado: 'vencida' });
    expect(fs.store.get('consumos/vet_vet1_2026-06')).toMatchObject({ bloqueado: true });
    expect(fs.store.get('miembros/vet1')).not.toHaveProperty('bloqueado');
    expect(fs.store.get('invitaciones/inv1')).toMatchObject({ expiradaEn: expect.anything() });
    expect([...fs.store.keys()].filter((k) => k.startsWith('jobEventos/'))).toHaveLength(first.events.length);
    const notis = [...fs.store.values()].filter((v) => v.leida === false);
    expect(notis.some((n) => n.tipo === 'consumo_100' && n.destinatarioUid === 'vet1')).toBe(true);
    expect(notis.some((n) => n.tipo === 'consumo_100' && n.destinatarioUid === 'admin-orgA')).toBe(true);
    expect(notis.some((n) => n.destinatarioUid === 'admin-orgB')).toBe(false);
    expect(notis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'cita_recordatorio',
          destinatarioUid: 'vet1',
          resourceType: 'cita',
          resourceId: 'cita1',
          pacienteId: 'pac1',
          consultaId: 'cons1',
        }),
      ]),
    );
    const auditorias = [...fs.store.values()].filter((v) => v.accion === 'job.sistema');
    expect(auditorias.length).toBeGreaterThanOrEqual(first.events.length);
    expect([...fs.store.values()].some((v) => v.accion === 'cuenta.bloquear')).toBe(true);
    expect([...fs.store.values()].some((v) => v.accion === 'invitacion.expirada')).toBe(true);
    expect([...fs.store.values()].filter((v) => v.accion === 'cuenta.bloquear')).toHaveLength(2);
  });

  it('notifica consumo por scope V2 sin mezclar entidades que comparten orgId', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('miembros/admin-ent-a', { orgId: 'orgA', role: 'admin_entidad', entidadId: 'entA' });
    fs.store.set('miembros/admin-ent-b', { orgId: 'orgA', role: 'admin_entidad', entidadId: 'entB' });
    fs.store.set('miembros/admin-vet-a', {
      orgId: 'orgA',
      role: 'admin_veterinaria',
      entidadId: 'entA',
      veterinariaId: 'vetA',
    });
    fs.store.set('miembros/admin-legacy', { orgId: 'orgA', rol: 'admin' });
    fs.store.set('consumos/entA_2026-06', {
      scopeId: 'entA',
      periodo: '2026-06',
      usados: 8,
      limite: 10,
      orgId: 'orgA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      veterinarioId: 'vet1',
    });

    const first = await jobs.ejecutar(new Date('2026-06-17T12:00:00Z'));
    const second = await jobs.ejecutar(new Date('2026-06-17T12:00:00Z'));

    expect(first.errors).toBe(0);
    expect(second.created).toBe(0);
    const notis = [...fs.store.values()].filter((v) => v.tipo === 'consumo_80');
    expect(notis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destinatarioUid: 'vet1', entidadId: 'entA', veterinariaId: 'vetA' }),
        expect.objectContaining({ destinatarioUid: 'admin-ent-a', entidadId: 'entA', veterinariaId: 'vetA' }),
        expect.objectContaining({ destinatarioUid: 'admin-vet-a', entidadId: 'entA', veterinariaId: 'vetA' }),
      ]),
    );
    expect(notis.some((n) => n.destinatarioUid === 'admin-ent-b')).toBe(false);
    expect(notis.some((n) => n.destinatarioUid === 'admin-legacy')).toBe(false);
    expect(notis).toHaveLength(3);
  });

  it('aplicarEvento notifica admins por entidadId aunque orgId sea null', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('miembros/admin-ent-a', { role: 'admin_entidad', entidadId: 'entA' });
    fs.store.set('miembros/admin-ent-b', { role: 'admin_entidad', entidadId: 'entB' });
    const aplicarEvento = (jobs as unknown as { aplicarEvento(event: SystemJobEvent): Promise<void> }).aplicarEvento;

    await aplicarEvento.call(jobs, {
      id: 'consumo_100_entA_2026-06',
      kind: 'consumo_100',
      resourceId: 'entA_2026-06',
      period: '2026-06',
      orgId: null,
      entidadId: 'entA',
      veterinariaId: null,
    });

    const notis = [...fs.store.values()].filter((v) => v.tipo === 'consumo_100');
    expect(notis).toEqual([
      expect.objectContaining({ destinatarioUid: 'admin-ent-a', orgId: null, entidadId: 'entA' }),
    ]);
    expect(notis.some((n) => n.destinatarioUid === 'admin-ent-b')).toBe(false);
  });

  it('aplicarEvento notifica admins por veterinariaId aunque orgId sea null', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('miembros/admin-vet-a', { role: 'admin_veterinaria', veterinariaId: 'vetA' });
    fs.store.set('miembros/admin-vet-b', { role: 'admin_veterinaria', veterinariaId: 'vetB' });
    const aplicarEvento = (jobs as unknown as { aplicarEvento(event: SystemJobEvent): Promise<void> }).aplicarEvento;

    await aplicarEvento.call(jobs, {
      id: 'consumo_100_vetA_2026-06',
      kind: 'consumo_100',
      resourceId: 'vetA_2026-06',
      period: '2026-06',
      orgId: null,
      entidadId: null,
      veterinariaId: 'vetA',
    });

    const notis = [...fs.store.values()].filter((v) => v.tipo === 'consumo_100');
    expect(notis).toEqual([
      expect.objectContaining({ destinatarioUid: 'admin-vet-a', orgId: null, veterinariaId: 'vetA' }),
    ]);
    expect(notis.some((n) => n.destinatarioUid === 'admin-vet-b')).toBe(false);
  });

  it('no muta suscripcion cuando la transicion es invalida', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('suscripciones/sub-cancelada', {
      estado: 'cancelada',
      orgId: 'orgA',
    });
    const aplicarEvento = (jobs as unknown as { aplicarEvento(event: SystemJobEvent): Promise<void> }).aplicarEvento;

    await expect(
      aplicarEvento.call(jobs, {
        id: 'suscripcion_vencida_sub-cancelada_2026-06-17',
        kind: 'suscripcion_vencida',
        resourceId: 'sub-cancelada',
        period: '2026-06-17',
        orgId: 'orgA',
        targetEstado: 'vencida',
      }),
    ).rejects.toThrow(/transicion/i);
    expect(fs.store.get('suscripciones/sub-cancelada')).toMatchObject({ estado: 'cancelada' });
  });

  it('guarda evento vacuna proxima sin campos undefined y deduplica al reintentar', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));

    fs.store.set('vacunas/vacuna-proxima', {
      nombre: 'Rabia',
      proximaDosis: '2026-06-25',
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });

    const first = await jobs.ejecutar(hoy);

    expect(first).toMatchObject({
      created: 1,
      skipped: 0,
      updated: 1,
      errors: 0,
      errorDetails: [],
    });

    const eventEntry = [...fs.store.entries()].find(([key]) => key.startsWith('jobEventos/vacuna_proxima'));
    expect(eventEntry).toBeDefined();
    const eventDoc = eventEntry![1];
    expect(eventDoc).toMatchObject({
      kind: 'vacuna_proxima',
      resourceType: 'vacuna',
      resourcePath: 'vacunas/vacuna-proxima',
    });
    expect(eventDoc).not.toHaveProperty('targetEstado');
    expect(eventDoc.meta).not.toHaveProperty('pacienteId');
    expect(hasUndefinedDeep(eventDoc)).toBe(false);

    const notificaciones = [...fs.store.values()].filter((v) => v.tipo === 'vacunas_pendientes');
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]).toMatchObject({
      destinatarioUid: 'vet1',
      resourceType: 'vacuna',
      resourceId: 'vacuna-proxima',
      dedupeKey: eventDoc.id,
    });

    const second = await jobs.ejecutar(hoy);

    expect(second).toMatchObject({ created: 0, skipped: 1, updated: 0, errors: 0 });
    expect([...fs.store.keys()].filter((k) => k.startsWith('jobEventos/vacuna_proxima'))).toHaveLength(1);
    expect([...fs.store.values()].filter((v) => v.tipo === 'vacunas_pendientes')).toHaveLength(1);
  });

  it('reinicia contador mensual en dia 1 sin duplicar el nuevo periodo', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('consumos/vet_vet1_2026-05', {
      scopeId: 'vet_vet1',
      periodo: '2026-05',
      usados: 9,
      limite: 10,
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });

    await jobs.ejecutar(new Date('2026-06-01T08:00:00Z'));
    await jobs.ejecutar(new Date('2026-06-01T08:00:00Z'));

    expect(fs.store.get('consumos/vet_vet1_2026-06')).toMatchObject({
      scopeId: 'vet_vet1',
      periodo: '2026-06',
      usados: 0,
      bloqueado: false,
    });
    expect([...fs.store.keys()].filter((k) => k.startsWith('jobEventos/consumo_reinicio_mensual'))).toHaveLength(1);
  });

  it('no sobrescribe consumo existente del nuevo periodo al reiniciar contador', async () => {
    const { fb, fs } = fakeFirebase();
    const jobs = new SystemJobsService(fb, new NotificacionesService(fb), new AuditoriaService(fb));
    fs.store.set('consumos/vet_vet1_2026-05', {
      scopeId: 'vet_vet1',
      periodo: '2026-05',
      usados: 9,
      limite: 10,
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });
    fs.store.set('consumos/vet_vet1_2026-06', {
      scopeId: 'vet_vet1',
      periodo: '2026-06',
      usados: 2,
      limite: 10,
      bloqueado: false,
      orgId: 'orgA',
      veterinarioId: 'vet1',
    });

    await jobs.ejecutar(new Date('2026-06-01T08:00:00Z'));

    expect(fs.store.get('consumos/vet_vet1_2026-06')).toMatchObject({
      usados: 2,
      limite: 10,
      bloqueado: false,
    });
  });
});
