import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsultasService } from '../../src/modules/consultas/consultas.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { ConsumoService } from '../../src/modules/saas/consumo.service';
import { CitasService } from '../../src/modules/citas/citas.service';
import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { ConsultaDoc } from '../../src/modules/consultas/consulta.types';
import { DiagnosticoEstructurado } from '../../src/modules/consultas/diagnostico-estructurado';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { fakeFirebase } from './saas.fakes';

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };
const asistente: AuthUser = { uid: 'assist', orgId: 'orgA', rol: 'asistente' };
const superadmin: AuthUser = { uid: 'root', rol: 'superadmin' };

function build(consulta: ConsultaDoc) {
  const { fb, fs } = fakeFirebase();
  fs.store.set(`consultas/${consulta.id}`, {
    ...consulta,
    signosVitales: { peso: 12, talla: 30 },
    pacienteId: consulta.pacienteId,
  });
  fs.store.set(`pacientes/${consulta.pacienteId ?? 'p1'}`, { orgId: 'orgA' });
  const repoState = { ...consulta };
  const repo = {
    getById: jest.fn(async () => ({ ...repoState })),
    ref: (id: string) => fs.makeRef(`consultas/${id}`, id),
    update: jest.fn(async (_id: string, data: Partial<ConsultaDoc>) => {
      Object.assign(repoState, data);
      const prev = fs.store.get(`consultas/${_id}`) ?? {};
      fs.store.set(`consultas/${_id}`, { ...prev, ...data });
    }),
  } as unknown as ConsultasRepository;
  const consumo = new ConsumoService(fb);
  const subs = { limiteHistoriasMes: jest.fn(async () => 10) } as unknown as SuscripcionesService;
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) };
  const notificaciones = {
    crear: jest.fn().mockResolvedValue({ id: 'n' }),
    notificarAdminsEntidad: jest.fn().mockResolvedValue(undefined),
  };
  const citas = {
    cerrarDesdeConsulta: jest.fn().mockResolvedValue(undefined),
    vincularConsulta: jest.fn().mockResolvedValue(undefined),
  } as unknown as CitasService;
  const svc = new ConsultasService(
    fb,
    repo,
    consumo,
    subs,
    auditoria as never,
    notificaciones as never,
    citas,
  );
  return { svc, repo, consumo, subs, fs, repoState, auditoria, notificaciones, citas };
}

function buildCrud(pacienteData: Record<string, unknown> = {}) {
  const { fb, fs } = fakeFirebase();
  fs.store.set('pacientes/p1', { orgId: 'orgA', veterinarioId: 'u1', nombre: 'Rex', ...pacienteData });
  const repoState: ConsultaDoc = { id: 'c-new', orgId: 'orgA', veterinarioId: 'u1', pacienteId: 'p1', estado: 'borrador' };
  const repo = {
    crear: jest.fn(async (data: Omit<ConsultaDoc, 'id'>) => {
      Object.assign(repoState, data, { id: 'c-new' });
      fs.store.set('consultas/c-new', {
        signosVitales: { peso: 12, talla: 30 },
        pacienteId: 'p1',
        orgId: 'orgA',
        veterinarioId: 'u1',
        estado: 'borrador',
      });
      return { ...repoState, fechaHora: new Date(), creadoEn: new Date() };
    }),
    listar: jest.fn(async () => []),
    getById: jest.fn(async () => ({ ...repoState })),
    update: jest.fn(),
    mergeRaw: jest.fn(async (_id: string, data: Record<string, unknown>) => {
      Object.assign(repoState, data);
      const existing = fs.store.get('consultas/c-new') ?? {};
      fs.store.set('consultas/c-new', { ...existing, ...data });
    }),
    eliminar: jest.fn(async (id: string) => {
      fs.store.delete(`consultas/${id}`);
      if (repoState.id === id) repoState.estado = undefined;
    }),
  } as unknown as ConsultasRepository;
  const consumo = {
    registrarUso: jest.fn(),
    puedeGenerar: jest.fn(async () => true),
  } as unknown as ConsumoService;
  const subs = { limiteHistoriasMes: jest.fn(async () => 10) } as unknown as SuscripcionesService;
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) };
  const notificaciones = {
    crear: jest.fn(),
    notificarAdminsEntidad: jest.fn(),
  };
  const citas = {
    cerrarDesdeConsulta: jest.fn(),
    vincularConsulta: jest.fn(),
  } as unknown as CitasService;
  const svc = new ConsultasService(
    fb,
    repo,
    consumo,
    subs,
    auditoria as never,
    notificaciones as never,
    citas,
  );
  return { svc, repo, fs, repoState };
}

const adminEntidadV2: AuthUserV2 = {
  uid: 'admin-ent-a',
  orgId: 'orgA',
  rol: 'admin',
  v: 2,
  role: 'admin_entidad',
  accountType: 'entidad',
  accountId: 'entA',
  entidadId: 'entA',
  membershipId: 'm-ent-a',
  planOwnerType: 'entidad',
  planOwnerId: 'entA',
};

const adminVeterinariaV2: AuthUserV2 = {
  uid: 'admin-vet-a',
  orgId: 'orgA',
  rol: 'admin',
  v: 2,
  role: 'admin_veterinaria',
  accountType: 'veterinaria',
  accountId: 'vetA',
  entidadId: 'entA',
  veterinariaId: 'vetA',
  membershipId: 'm-vet-a',
  planOwnerType: 'entidad',
  planOwnerId: 'entA',
};

describe('ConsultasService.crear', () => {
  it('persiste orgId, veterinarioId y estado borrador', async () => {
    const { svc, repo } = buildCrud();
    const res = await svc.crear({ pacienteId: 'p1' }, user);
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 'p1',
        orgId: 'orgA',
        veterinarioId: 'u1',
        estado: 'borrador',
      }),
    );
    expect(res.id).toBe('c-new');
    expect(res.orgId).toBe('orgA');
  });

  it('persiste scope V2 desde el paciente al crear consulta', async () => {
    const { svc, repo } = buildCrud({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    const res = await svc.crear({ pacienteId: 'p1' }, adminVeterinariaV2);
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 'p1',
        orgId: 'orgA',
        veterinarioId: 'admin-vet-a',
        accountType: 'veterinaria',
        accountId: 'vetA',
        entidadId: 'entA',
        veterinariaId: 'vetA',
        planOwnerType: 'entidad',
        planOwnerId: 'entA',
        membershipId: 'm-vet-a',
      }),
    );
    expect(res.accountId).toBe('vetA');
  });

  it('admin_entidad V2 rechaza paciente de otra entidad aunque orgId legacy coincida', async () => {
    const { svc, fs } = buildCrud();
    fs.store.set('pacientes/p-ent-b', {
      orgId: 'orgA',
      veterinarioId: 'u2',
      nombre: 'B',
      accountType: 'veterinaria',
      accountId: 'vetB',
      entidadId: 'entB',
      veterinariaId: 'vetB',
      planOwnerType: 'entidad',
      planOwnerId: 'entB',
    });
    await expect(svc.crear({ pacienteId: 'p-ent-b' }, adminEntidadV2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('admin_entidad V2 rechaza crear consulta clinica directa aun en su entidad', async () => {
    const { svc } = buildCrud({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.crear({ pacienteId: 'p1' }, adminEntidadV2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('admin_veterinaria rechaza crear consulta en veterinaria hermana', async () => {
    const { svc, fs } = buildCrud();
    fs.store.set('pacientes/p-vet-b', {
      orgId: 'orgA',
      veterinarioId: 'u2',
      nombre: 'B',
      accountType: 'veterinaria',
      accountId: 'vetB',
      entidadId: 'entA',
      veterinariaId: 'vetB',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.crear({ pacienteId: 'p-vet-b' }, adminVeterinariaV2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
  ])('%s no crea consultas por endpoint clinico', async (_label, actor) => {
    const { svc } = buildCrud();
    await expect(svc.crear({ pacienteId: 'p1' }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza paciente inexistente', async () => {
    const { svc } = buildCrud();
    await expect(svc.crear({ pacienteId: 'missing' }, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza paciente de otro tenant', async () => {
    const { svc, fs } = buildCrud();
    fs.store.set('pacientes/p2', { orgId: 'orgB', veterinarioId: 'u2' });
    await expect(svc.crear({ pacienteId: 'p2' }, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ConsultasService.listar', () => {
  it('filtra por orgId del usuario', async () => {
    const { svc, repo } = buildCrud();
    await svc.listar(user);
    expect(repo.listar).toHaveBeenCalledWith({ orgId: 'orgA' }, undefined);
  });

  it('pasa pacienteId opcional al repositorio', async () => {
    const { svc, repo } = buildCrud();
    await svc.listar(user, 'p1');
    expect(repo.listar).toHaveBeenCalledWith({ orgId: 'orgA' }, 'p1');
  });

  it('usuario legacy usa uid en lugar de orgId', async () => {
    const { svc, repo } = buildCrud();
    const legacy: AuthUser = { uid: 'legacy-vet', rol: 'vet' };
    await svc.listar(legacy);
    expect(repo.listar).toHaveBeenCalledWith({ uid: 'legacy-vet' }, undefined);
  });
});

describe('ConsultasService.actualizar', () => {
  it('persiste campos permitidos y actualizadoEn', async () => {
    const { svc, repo, repoState } = buildCrud();
    repoState.id = 'c-new';
    const res = await svc.actualizar('c-new', { motivo: 'tos', transcripcion: 'texto' }, user);
    expect(repo.mergeRaw).toHaveBeenCalledWith(
      'c-new',
      expect.objectContaining({ motivo: 'tos', transcripcion: 'texto', actualizadoEn: expect.anything() }),
    );
    expect(res.motivo).toBe('tos');
  });

  it('guarda borrador con diagnostico estructurado normalizado', async () => {
    const { svc, repo, repoState } = buildCrud();
    repoState.id = 'c-new';
    await svc.actualizar(
      'c-new',
      {
        diagnosticoEstructurado: [
          {
            id: 'd1',
            nombre: 'Gastroenteritis',
            tipo: 'principal',
            estado: 'presuntivo',
            sistema: 'digestivo',
            origen: 'ia',
            creadoEn: '2026-06-18T00:00:00.000Z',
            extra: 'se descarta',
          },
        ],
      },
      user,
    );

    expect(repo.mergeRaw).toHaveBeenCalledWith(
      'c-new',
      expect.objectContaining({
        diagnosticoEstructurado: [
          expect.objectContaining({
            id: 'd1',
            nombre: 'Gastroenteritis',
            tipo: 'principal',
            estado: 'presuntivo',
            sistema: 'digestivo',
            origen: 'ia',
          }),
        ],
      }),
    );
    expect(repoState.diagnosticoEstructurado?.[0]).not.toHaveProperty('extra');
  });

  it('normaliza diagnostico con tipo invalido a default (no rechaza, evita 400 al editar)', async () => {
    const { svc, repo, repoState } = buildCrud();
    repoState.id = 'c-new';
    await svc.actualizar(
      'c-new',
      {
        diagnosticoEstructurado: [
          { id: 'd1', nombre: 'Otitis', tipo: 'raro', estado: 'presuntivo', origen: 'manual', creadoEn: 'x' },
        ],
      },
      user,
    );
    // strict:false rellena defaults en vez de tirar 400: tipo invalido -> 'principal'.
    expect(repo.mergeRaw).toHaveBeenCalledWith(
      'c-new',
      expect.objectContaining({
        diagnosticoEstructurado: [
          expect.objectContaining({ nombre: 'Otitis', tipo: 'principal', estado: 'presuntivo' }),
        ],
      }),
    );
  });

  it('rechaza estado aprobada: debe usar POST /aprobar', async () => {
    const { svc, repo, repoState } = buildCrud();
    repoState.id = 'c-new';
    await expect(svc.actualizar('c-new', { estado: 'aprobada' }, user)).rejects.toThrow(
      'Use POST /v1/consultas/:id/aprobar para aprobar la consulta.',
    );
    expect(repo.mergeRaw).not.toHaveBeenCalled();
  });

  it('rechaza PATCH sobre consulta ya aprobada', async () => {
    const { svc, repoState } = buildCrud();
    repoState.id = 'c-new';
    repoState.estado = 'aprobada';
    await expect(svc.actualizar('c-new', { motivo: 'x' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('permite limpiar pacientePendienteConfirmar aun en consulta aprobada (no es contenido clinico)', async () => {
    const { svc, repo, repoState } = buildCrud();
    repoState.id = 'c-new';
    repoState.estado = 'aprobada';
    const res = await svc.actualizar('c-new', { pacientePendienteConfirmar: false }, user);
    expect(res.pacientePendienteConfirmar).toBe(false);
    expect(repo.mergeRaw).toHaveBeenCalledWith(
      'c-new',
      expect.objectContaining({ pacientePendienteConfirmar: false }),
    );
  });

  it('rechaza mezclar pacientePendienteConfirmar con un campo clinico en consulta aprobada', async () => {
    const { svc, repoState } = buildCrud();
    repoState.id = 'c-new';
    repoState.estado = 'aprobada';
    await expect(
      svc.actualizar('c-new', { pacientePendienteConfirmar: false, motivo: 'x' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza consulta de otro tenant', async () => {
    const { svc, repoState } = buildCrud();
    repoState.orgId = 'orgB';
    repoState.veterinarioId = 'u2';
    await expect(svc.actualizar('c-new', { motivo: 'x' }, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no actualiza consulta clinica directa', async (_label, actor) => {
    const { svc, repoState } = buildCrud({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    Object.assign(repoState, {
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.actualizar('c-new', { motivo: 'x' }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ConsultasService.eliminar', () => {
  it('elimina borrador del propio tenant (hard delete)', async () => {
    const { svc, repo, fs, repoState } = buildCrud();
    repoState.id = 'c-new';
    repoState.estado = 'borrador';
    const res = await svc.eliminar('c-new', user);
    expect(res.eliminado).toBe(true);
    expect(repo.eliminar).toHaveBeenCalledWith('c-new');
    expect(fs.store.has('consultas/c-new')).toBe(false);
  });

  it('rechaza eliminar consulta aprobada', async () => {
    const { svc, repoState, repo } = buildCrud();
    repoState.id = 'c-new';
    repoState.estado = 'aprobada';
    await expect(svc.eliminar('c-new', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('rechaza cross-tenant', async () => {
    const { svc, repoState } = buildCrud();
    repoState.orgId = 'orgB';
    repoState.veterinarioId = 'u2';
    await expect(svc.eliminar('c-new', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza consulta inexistente', async () => {
    const { svc, repo } = buildCrud();
    (repo.getById as jest.Mock).mockRejectedValueOnce(new NotFoundException('no existe'));
    await expect(svc.eliminar('missing', user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no elimina consulta clinica directa', async (_label, actor) => {
    const { svc, repoState } = buildCrud({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    Object.assign(repoState, {
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.eliminar('c-new', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ConsultasService.aprobar', () => {
  it('aprueba un borrador, descuenta 1 del consumo y propaga peso/talla', async () => {
    const { svc, fs, notificaciones } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    const res = await svc.aprobar('c1', user);
    expect(res.estado).toBe('aprobada');
    expect(res.consumo?.usados).toBe(1);
    expect(fs.store.get('pacientes/p1')).toMatchObject({ ultimoPeso: 12, ultimaTalla: 30 });
    expect(notificaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'consulta_aprobada',
        resourceType: 'consulta',
        resourceId: 'c1',
        resourcePath: '/pacientes/p1/consultas/c1',
        pacienteId: 'p1',
        consultaId: 'c1',
        dedupeKey: 'consulta_aprobada:c1:u1',
      }),
    );
  });

  it('aprobar conserva el snapshot de diagnostico estructurado', async () => {
    const diagnosticoEstructurado: DiagnosticoEstructurado[] = [
      {
        id: 'd1',
        nombre: 'Dermatitis alergica',
        tipo: 'principal',
        estado: 'confirmado',
        origen: 'manual',
        creadoEn: '2026-06-18T00:00:00.000Z',
      },
    ];
    const { svc, fs } = build({
      id: 'c1',
      estado: 'borrador',
      pacienteId: 'p1',
      orgId: 'orgA',
      diagnosticoEstructurado,
    });
    await svc.aprobar('c1', user);
    expect(fs.store.get('consultas/c1')?.diagnosticoEstructurado).toEqual(diagnosticoEstructurado);
    expect(fs.store.get('consultas/c1')?.estado).toBe('aprobada');
  });

  it('re-aprobar una ya aprobada es idempotente: NO descuenta de nuevo', async () => {
    const { svc, fs } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    fs.store.set('consumos/orgA_2026-06', { usados: 5, scopeId: 'orgA', periodo: '2026-06' });
    const res = await svc.aprobar('c1', user);
    expect(res.consumo).toBeNull();
    expect(fs.store.get('consumos/orgA_2026-06')?.usados).toBe(5);
  });

  it('no se puede aprobar una consulta en procesando/error', async () => {
    const { svc } = build({ id: 'c1', estado: 'procesando', pacienteId: 'p1', orgId: 'orgA' });
    await expect(svc.aprobar('c1', user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no aprueba consulta clinica directa', async (_label, actor) => {
    const { svc } = build({
      id: 'c1',
      estado: 'borrador',
      pacienteId: 'p1',
      orgId: 'orgA',
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.aprobar('c1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ConsultasService.prepararProcesamiento (gate consumo 100%)', () => {
  it('lanza 403 si el consumo esta bloqueado (limite alcanzado)', async () => {
    const { svc, fs } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    const periodo = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    fs.store.set(`consumos/orgA_${periodo}`, { usados: 10, scopeId: 'orgA', periodo });
    await expect(svc.prepararProcesamiento('c1', user)).rejects.toMatchObject({ status: 403 });
  });

  it('permite y audita soap.inicio cuando hay cupo', async () => {
    const { svc, auditoria } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    await svc.prepararProcesamiento('c1', user);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'soap.inicio' }));
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no prepara procesamiento IA clinico', async (_label, actor) => {
    const { svc } = build({
      id: 'c1',
      estado: 'borrador',
      pacienteId: 'p1',
      orgId: 'orgA',
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(svc.prepararProcesamiento('c1', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ConsultasService notificaciones de consumo', () => {
  it('al cruzar 100% notifica consumo_100 al vet', async () => {
    const { svc, notificaciones, fs } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    const periodo = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    fs.store.set(`consumos/orgA_${periodo}`, { usados: 9, scopeId: 'orgA', periodo });
    await svc.aprobar('c1', user);
    expect(notificaciones.crear).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'consumo_100', destinatarioUid: 'u1' }));
  });

  it('al cruzar 80% exacto notifica consumo_80', async () => {
    const { svc, notificaciones, fs } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    const periodo = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    fs.store.set(`consumos/orgA_${periodo}`, { usados: 7, scopeId: 'orgA', periodo });
    await svc.aprobar('c1', user);
    expect(notificaciones.crear).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'consumo_80' }));
  });

  it('por debajo del 80% no notifica consumo, solo evento de consulta', async () => {
    const { svc, notificaciones } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    await svc.aprobar('c1', user);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'consulta_aprobada', consultaId: 'c1', pacienteId: 'p1' }),
    );
    expect(notificaciones.crear).not.toHaveBeenCalledWith(expect.objectContaining({ tipo: 'consumo_80' }));
    expect(notificaciones.crear).not.toHaveBeenCalledWith(expect.objectContaining({ tipo: 'consumo_100' }));
  });
});

describe('ConsultasService.crearEnmienda', () => {
  it('crea una enmienda enlazada sin sobrescribir la original', async () => {
    const { svc, fs } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const { enmiendaId } = await svc.crearEnmienda('c1', user, { plan: 'corregido' });
    expect(enmiendaId).toBeTruthy();
    const enmienda = fs.store.get(`enmiendas/${enmiendaId}`);
    expect(enmienda).toMatchObject({ consultaIdOrigen: 'c1', autorUid: 'u1' });
    // la consulta original sigue intacta (la enmienda es un doc aparte)
    expect(fs.store.get('consultas/c1')).toBeDefined();
  });

  it('permite diagnostico propio en la enmienda', async () => {
    const { svc, fs } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const { enmiendaId } = await svc.crearEnmienda('c1', user, {
      diagnosticoEstructurado: [
        {
          id: 'd-enm',
          nombre: 'Otitis externa',
          tipo: 'secundario',
          estado: 'confirmado',
          origen: 'manual',
          creadoEn: '2026-06-18T00:00:00.000Z',
        },
      ],
    });
    expect(fs.store.get(`enmiendas/${enmiendaId}`)?.contenido).toMatchObject({
      diagnosticoEstructurado: [expect.objectContaining({ nombre: 'Otitis externa' })],
    });
  });

  it('solo se enmiendan historias aprobadas', async () => {
    const { svc } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA' });
    await expect(svc.crearEnmienda('c1', user, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
