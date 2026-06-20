import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BrigadasService } from '../../src/modules/brigadas/brigadas.service';
import { BrigadasRepository } from '../../src/modules/brigadas/brigadas.repository';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { COLLECTIONS } from '../../src/common/firebase/collections';
import { BrigadaAtencionDoc, BrigadaDoc } from '../../src/modules/brigadas/brigada.types';

const legacyVet: AuthUser = { uid: 'vet-a', orgId: 'orgA', rol: 'vet' };
const asistente: AuthUser = { uid: 'assist', orgId: 'orgA', rol: 'asistente' };
const superadmin: AuthUser = { uid: 'root', rol: 'superadmin' };

const adminEntidad: AuthUserV2 = {
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

const adminVeterinaria: AuthUserV2 = {
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

const veterinarioV2: AuthUserV2 = {
  uid: 'vet-a',
  orgId: 'orgA',
  rol: 'vet',
  v: 2,
  role: 'veterinario',
  accountType: 'veterinaria',
  accountId: 'vetA',
  entidadId: 'entA',
  veterinariaId: 'vetA',
  membershipId: 'm-vet-a-1',
  planOwnerType: 'entidad',
  planOwnerId: 'entA',
};

const brigadaVetA: BrigadaDoc = {
  id: 'b-vet-a',
  nombre: 'Brigada Norte',
  fecha: '2026-06-01',
  ubicacion: { direccion: 'Calle 1', ciudad: 'Bogota' },
  veterinarioIds: ['vet-a'],
  orgId: 'orgA',
  accountType: 'veterinaria',
  accountId: 'vetA',
  entidadId: 'entA',
  veterinariaId: 'vetA',
  planOwnerType: 'entidad',
  planOwnerId: 'entA',
  estado: 'planificada',
};

const brigadaSinVet: BrigadaDoc = {
  ...brigadaVetA,
  id: 'b-vet-a-sin-participante',
  veterinarioIds: ['vet-x'],
};

const atenciones: BrigadaAtencionDoc[] = [
  {
    id: 'a1',
    brigadaId: 'b-vet-a',
    veterinarioId: 'vet-a',
    pacienteId: 'p1',
    motivo: 'Vacunacion',
    fechaHora: '2026-06-01T10:00:00.000Z',
    entidadId: 'entA',
    veterinariaId: 'vetA',
    accountType: 'veterinaria',
    accountId: 'vetA',
    createdBy: 'vet-a',
  },
  {
    id: 'a2',
    brigadaId: 'b-vet-a',
    veterinarioId: 'vet-a',
    pacienteId: 'p1',
    motivo: 'Control',
    fechaHora: '2026-06-01T11:00:00.000Z',
    entidadId: 'entA',
    veterinariaId: 'vetA',
    accountType: 'veterinaria',
    accountId: 'vetA',
    createdBy: 'vet-a',
  },
];

function snap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: data !== null,
    data: () => data ?? undefined,
  };
}

function build(overrides?: {
  list?: BrigadaDoc[];
  get?: BrigadaDoc;
  veterinarias?: Record<string, Record<string, unknown>>;
  miembros?: Record<string, unknown>[];
  pacientes?: Record<string, Record<string, unknown>>;
  consultas?: Record<string, Record<string, unknown>>;
  atenciones?: BrigadaAtencionDoc[];
}) {
  const repo = {
    listar: jest.fn().mockResolvedValue(overrides?.list ?? [brigadaVetA]),
    getById: jest.fn().mockResolvedValue(overrides?.get ?? brigadaVetA),
    crear: jest.fn().mockImplementation(async (data: Omit<BrigadaDoc, 'id'>) => ({
      id: 'b-new',
      ...data,
      creadoEn: '2026-06-15T00:00:00.000Z',
    })),
    mergeRaw: jest.fn().mockResolvedValue(undefined),
    listarAtenciones: jest.fn().mockResolvedValue(overrides?.atenciones ?? atenciones),
    crearAtencion: jest.fn().mockImplementation(async (data: Omit<BrigadaAtencionDoc, 'id'>) => ({
      id: 'att-new',
      ...data,
      creadoEn: '2026-06-15T00:00:00.000Z',
    })),
  } as unknown as jest.Mocked<BrigadasRepository>;

  const veterinarias = overrides?.veterinarias ?? {
    vetA: {
      accountId: 'vetA',
      entidadId: 'entA',
      orgId: 'orgA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    },
    vetB: {
      accountId: 'vetB',
      entidadId: 'entB',
      orgId: 'orgB',
      planOwnerType: 'entidad',
      planOwnerId: 'entB',
    },
  };
  const miembros = overrides?.miembros ?? [
    {
      uid: 'vet-a',
      rol: 'vet',
      role: 'veterinario',
      accountId: 'vetA',
      veterinariaId: 'vetA',
      entidadId: 'entA',
      orgId: 'orgA',
      estado: 'activo',
    },
    {
      uid: 'vet-b',
      rol: 'vet',
      role: 'veterinario',
      accountId: 'vetB',
      veterinariaId: 'vetB',
      entidadId: 'entB',
      orgId: 'orgB',
      estado: 'activo',
    },
  ];
  const pacientes = overrides?.pacientes ?? {
    p1: { entidadId: 'entA', veterinariaId: 'vetA', accountId: 'vetA', orgId: 'orgA' },
    pOther: { entidadId: 'entB', veterinariaId: 'vetB', accountId: 'vetB', orgId: 'orgB' },
  };
  const consultas = overrides?.consultas ?? {
    c1: { entidadId: 'entA', veterinariaId: 'vetA', accountId: 'vetA', orgId: 'orgA', pacienteId: 'p1' },
    cOther: { entidadId: 'entB', veterinariaId: 'vetB', accountId: 'vetB', orgId: 'orgB', pacienteId: 'pOther' },
  };

  const firebase = {
    firestore: {
      collection: jest.fn((name: string) => ({
        get: jest.fn().mockResolvedValue({
          docs: name === COLLECTIONS.miembros ? miembros.map((m, index) => snap(`m${index}`, m)) : [],
        }),
        doc: jest.fn((id: string) => ({
          get: jest.fn().mockResolvedValue(
            name === COLLECTIONS.veterinarias
              ? snap(id, veterinarias[id] ?? null)
              : name === COLLECTIONS.pacientes
                ? snap(id, pacientes[id] ?? null)
                : name === COLLECTIONS.consultas
                  ? snap(id, consultas[id] ?? null)
                  : snap(id, null),
          ),
        })),
      })),
    },
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'audit' }) };
  const svc = new BrigadasService(repo, firebase as never, auditoria as never);
  return { svc, repo, firebase, auditoria };
}

function buildRepositoryHarness() {
  let savedPayload: Record<string, unknown> = {};
  const set = jest.fn(async (payload: Record<string, unknown>) => {
    savedPayload = payload;
  });
  const get = jest.fn(async () => snap('generated', savedPayload));
  const doc = jest.fn(() => ({ set, get }));
  const collection = jest.fn(() => ({ doc }));
  const repo = new BrigadasRepository({ firestore: { collection } } as never);
  return {
    repo,
    set,
    get savedPayload() {
      return savedPayload;
    },
  };
}

describe('BrigadasRepository serialization', () => {
  it('crea brigada sin descripcion sin enviar undefined a Firestore', async () => {
    const harness = buildRepositoryHarness();

    await harness.repo.crear({
      nombre: 'Sin descripcion',
      descripcion: undefined,
      fecha: '2026-08-01',
      ubicacion: { direccion: '', ciudad: 'Cali', lat: undefined, lng: undefined },
      veterinarioIds: ['vet-a'],
      orgId: undefined,
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: undefined,
      planOwnerType: undefined,
      planOwnerId: undefined,
      membershipId: undefined,
      legacyOrgId: undefined,
      estado: 'planificada',
      totalConsultas: undefined,
    });

    expect(harness.set).toHaveBeenCalledTimes(1);
    expect(harness.savedPayload).not.toHaveProperty('descripcion');
    expect(harness.savedPayload).not.toHaveProperty('orgId');
    expect(harness.savedPayload).not.toHaveProperty('veterinariaId');
    expect(harness.savedPayload).toEqual(
      expect.objectContaining({
        nombre: 'Sin descripcion',
        fecha: '2026-08-01',
        ubicacion: { direccion: '', ciudad: 'Cali' },
        veterinarioIds: ['vet-a'],
        accountType: 'veterinaria',
        accountId: 'vetA',
        entidadId: 'entA',
        estado: 'planificada',
      }),
    );
    expect(harness.savedPayload.ubicacion).not.toHaveProperty('lat');
    expect(harness.savedPayload.ubicacion).not.toHaveProperty('lng');
    expect(harness.savedPayload).toHaveProperty('creadoEn');
    expect(harness.savedPayload).toHaveProperty('actualizadoEn');
  });

  it('registra atencion sin opcionales sin enviar undefined a Firestore', async () => {
    const harness = buildRepositoryHarness();

    await harness.repo.crearAtencion({
      brigadaId: 'b-vet-a',
      pacienteId: undefined,
      consultaId: undefined,
      veterinarioId: 'vet-a',
      motivo: 'Control',
      notas: undefined,
      especie: undefined,
      fechaHora: '2026-08-01T10:00:00.000Z',
      orgId: undefined,
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: undefined,
      planOwnerType: undefined,
      planOwnerId: undefined,
      membershipId: undefined,
      legacyOrgId: undefined,
      createdBy: 'vet-a',
    });

    expect(harness.set).toHaveBeenCalledTimes(1);
    expect(harness.savedPayload).not.toHaveProperty('pacienteId');
    expect(harness.savedPayload).not.toHaveProperty('consultaId');
    expect(harness.savedPayload).not.toHaveProperty('notas');
    expect(harness.savedPayload).not.toHaveProperty('especie');
    expect(harness.savedPayload).not.toHaveProperty('orgId');
    expect(harness.savedPayload).toEqual(
      expect.objectContaining({
        brigadaId: 'b-vet-a',
        veterinarioId: 'vet-a',
        motivo: 'Control',
        fechaHora: '2026-08-01T10:00:00.000Z',
        accountType: 'veterinaria',
        accountId: 'vetA',
        entidadId: 'entA',
        createdBy: 'vet-a',
      }),
    );
    expect(harness.savedPayload).toHaveProperty('creadoEn');
    expect(harness.savedPayload).toHaveProperty('actualizadoEn');
  });
});

describe('BrigadasService P1.4', () => {
  it('admin entidad crea brigada propia', async () => {
    const { svc, repo } = build();
    await svc.crear(
      {
        nombre: 'Nueva',
        descripcion: 'Jornada barrial',
        fecha: '2026-07-01',
        ubicacion: { direccion: '', ciudad: 'Medellin' },
        veterinarioIds: ['vet-a'],
      },
      adminEntidad,
    );
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        entidadId: 'entA',
        accountType: 'entidad',
        accountId: 'entA',
        descripcion: 'Jornada barrial',
        veterinarioIds: ['vet-a'],
      }),
    );
  });

  it('admin entidad crea brigada con sede propia', async () => {
    const { svc, repo } = build();
    await svc.crear(
      {
        nombre: 'Sede',
        fecha: '2026-07-01',
        ubicacion: { direccion: '', ciudad: 'Medellin' },
        veterinariaId: 'vetA',
        veterinarioIds: ['vet-a'],
      },
      adminEntidad,
    );
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'veterinaria',
        accountId: 'vetA',
        entidadId: 'entA',
        veterinariaId: 'vetA',
      }),
    );
  });

  it('admin entidad no crea brigada con sede ajena ni participante fuera de scope', async () => {
    const { svc } = build();
    await expect(
      svc.crear(
        {
          nombre: 'Ajena',
          fecha: '2026-07-01',
          ubicacion: { direccion: '', ciudad: 'Medellin' },
          veterinariaId: 'vetB',
          veterinarioIds: [],
        },
        adminEntidad,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      svc.crear(
        {
          nombre: 'Participante ajeno',
          fecha: '2026-07-01',
          ubicacion: { direccion: '', ciudad: 'Medellin' },
          veterinarioIds: ['vet-b'],
        },
        adminEntidad,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin veterinaria solo opera su veterinaria', async () => {
    const { svc, repo } = build();
    await svc.crear(
      {
        nombre: 'Clinica',
        fecha: '2026-07-01',
        ubicacion: { direccion: '', ciudad: 'Medellin' },
        veterinarioIds: ['vet-a'],
      },
      adminVeterinaria,
    );
    expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ veterinariaId: 'vetA' }));

    await expect(
      svc.crear(
        {
          nombre: 'Otra',
          fecha: '2026-07-01',
          ubicacion: { direccion: '', ciudad: 'Medellin' },
          veterinariaId: 'vetB',
          veterinarioIds: [],
        },
        adminVeterinaria,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('veterinario solo ve brigadas donde participa', async () => {
    const { svc } = build({ list: [brigadaVetA, brigadaSinVet] });
    const res = await svc.listar(veterinarioV2);
    expect(res.map((b) => b.id)).toEqual(['b-vet-a']);
  });

  it.each([
    ['superadmin', superadmin],
    ['asistente', asistente],
  ])('%s queda bloqueado en endpoints operativos', async (_label, actor) => {
    const { svc } = build();
    await expect(svc.listar(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.crear(
        {
          nombre: 'Bloqueada',
          fecha: '2026-07-01',
          ubicacion: { direccion: '', ciudad: 'Medellin' },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('veterinario registra atencion solo como si mismo y si participa', async () => {
    const { svc, repo } = build();
    await svc.registrarAtencion(
      'b-vet-a',
      { motivo: 'Vacunacion', pacienteId: 'p1', consultaId: 'c1', veterinarioId: 'vet-a' },
      veterinarioV2,
    );
    expect(repo.crearAtencion).toHaveBeenCalledWith(
      expect.objectContaining({
        brigadaId: 'b-vet-a',
        veterinarioId: 'vet-a',
        motivo: 'Vacunacion',
        pacienteId: 'p1',
        consultaId: 'c1',
      }),
    );

    await expect(
      svc.registrarAtencion('b-vet-a', { motivo: 'Otro', veterinarioId: 'vet-b' }, veterinarioV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('veterinario no registra atencion si no participa', async () => {
    const { svc } = build({ get: brigadaSinVet });
    await expect(
      svc.registrarAtencion('b-vet-a-sin-participante', { motivo: 'Control' }, veterinarioV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza paciente o consulta linked fuera de scope', async () => {
    const { svc } = build();
    await expect(
      svc.registrarAtencion('b-vet-a', { motivo: 'Control', pacienteId: 'pOther' }, veterinarioV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.registrarAtencion('b-vet-a', { motivo: 'Control', consultaId: 'cOther' }, veterinarioV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('consolidado cuenta atenciones, pacientes unicos y veterinarios sin doble conteo', async () => {
    const { svc } = build();
    const res = await svc.consolidado('b-vet-a', adminVeterinaria);
    expect(res).toEqual(
      expect.objectContaining({
        brigadaId: 'b-vet-a',
        totalAtenciones: 2,
        pacientesUnicos: 1,
        veterinariosParticipantes: 1,
        veterinariosConAtencion: 1,
      }),
    );
  });

  it('valida transiciones basicas y no reabre finalizadas', async () => {
    const { svc, repo } = build();
    await svc.actualizar('b-vet-a', { estado: 'en_curso' }, adminVeterinaria);
    expect(repo.mergeRaw).toHaveBeenCalledWith('b-vet-a', expect.objectContaining({ estado: 'en_curso' }));

    await expect(svc.actualizar('b-vet-a', { estado: 'finalizada' }, adminVeterinaria)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    (repo.getById as jest.Mock).mockResolvedValue({ ...brigadaVetA, estado: 'finalizada' });
    await expect(svc.actualizar('b-vet-a', { estado: 'en_curso' }, adminVeterinaria)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('obtener inexistente lanza 404', async () => {
    const { svc, repo } = build();
    (repo.getById as jest.Mock).mockRejectedValue(new NotFoundException());
    await expect(svc.obtener('x', legacyVet)).rejects.toBeInstanceOf(NotFoundException);
  });
});
