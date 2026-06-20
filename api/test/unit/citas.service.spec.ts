import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CitasService } from '../../src/modules/citas/citas.service';
import { CitasRepository } from '../../src/modules/citas/citas.repository';
import {
  puedeTransicionar,
  transicionesValidas,
  CitaDoc,
} from '../../src/modules/citas/cita.types';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { FirebaseService } from '../../src/common/firebase/firebase.service';

describe('cita state machine', () => {
  it('programada puede ir a en_atencion/realizada/cancelada/no_asistio', () => {
    expect(puedeTransicionar('programada', 'en_atencion')).toBe(true);
    expect(puedeTransicionar('programada', 'realizada')).toBe(true);
    expect(puedeTransicionar('programada', 'cancelada')).toBe(true);
    expect(puedeTransicionar('programada', 'no_asistio')).toBe(true);
  });
  it('en_atencion puede cerrarse', () => {
    expect(puedeTransicionar('en_atencion', 'realizada')).toBe(true);
    expect(puedeTransicionar('en_atencion', 'cancelada')).toBe(true);
  });
  it('los estados finales no transicionan', () => {
    expect(puedeTransicionar('cancelada', 'realizada')).toBe(false);
    expect(puedeTransicionar('realizada', 'programada')).toBe(false);
    expect(transicionesValidas('cancelada')).toEqual([]);
  });
});

class FakeRepo {
  store = new Map<string, CitaDoc>();
  private seq = 0;
  async crear(data: Omit<CitaDoc, 'id'>): Promise<CitaDoc> {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) throw new Error(`Firestore rechaza undefined en ${k}`);
    }
    const id = `cita${++this.seq}`;
    const doc = { ...data, id } as CitaDoc;
    this.store.set(id, doc);
    return doc;
  }
  async getById(id: string): Promise<CitaDoc> {
    const d = this.store.get(id);
    if (!d) throw new Error('not found');
    return { ...d };
  }
  async actualizar(id: string, data: Partial<CitaDoc>): Promise<void> {
    this.store.set(id, { ...(this.store.get(id) as CitaDoc), ...data });
  }
  async listar(): Promise<CitaDoc[]> {
    return [...this.store.values()];
  }
}

function pacienteOrgA(extra: Record<string, unknown> = {}) {
  return {
  exists: true,
  id: 'p1',
  data: () => ({
    nombre: 'Firulais',
    orgId: 'orgA',
    propietario: { nombre: 'Juan', telefono: '3001234567' },
    ...extra,
  }),
  };
}

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };
const otro: AuthUser = { uid: 'u2', orgId: 'orgB', rol: 'vet' };
const asistente: AuthUser = { uid: 'assist', orgId: 'orgA', rol: 'asistente' };
const superadmin: AuthUser = { uid: 'root', rol: 'superadmin' };
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

function build(pacienteData: Record<string, unknown> = {}): {
  svc: CitasService;
  repo: FakeRepo;
  firebase: { firestore: { collection: jest.Mock } };
} {
  const repo = new FakeRepo();
  const collection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(async () => pacienteOrgA(pacienteData)),
    })),
  }));
  const firebase = {
    firestore: { collection },
  } as unknown as FirebaseService;
  const svc = new CitasService(repo as unknown as CitasRepository, firebase);
  return { svc, repo, firebase: { firestore: { collection } } };
}

describe('CitasService', () => {
  it('crea cita en estado programada con paciente vinculado', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    expect(c.estado).toBe('programada');
    expect(c.orgId).toBe('orgA');
    expect(c.pacienteId).toBe('p1');
    expect(c.pacienteNombre).toBe('Firulais');
    expect(c.motivo).toBe('Control');
  });

  it('crea cita sin notas cuando el campo viene undefined (POST prod)', async () => {
    const { svc, repo } = build();
    const c = await svc.crear(
      { motivo: 'Vacuna', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1', notas: undefined },
      user,
    );
    expect(c.id).toBeTruthy();
    expect('notas' in (repo.store.get(c.id) ?? {})).toBe(false);
  });

  it('admin veterinaria crea cita dentro de su veterinaria', async () => {
    const { svc } = build({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    const c = await svc.crear(
      { motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      adminVeterinariaV2,
    );
    expect(c).toMatchObject({
      accountType: 'veterinaria',
      accountId: 'vetA',
      veterinariaId: 'vetA',
      membershipId: 'm-vet-a',
    });
  });

  it('admin veterinaria no crea cita en veterinaria hermana', async () => {
    const { svc } = build({
      accountType: 'veterinaria',
      accountId: 'vetB',
      entidadId: 'entA',
      veterinariaId: 'vetB',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(
      svc.crear({ motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' }, adminVeterinariaV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no crea citas por endpoint clinico', async (_label, actor) => {
    const { svc } = build({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
    });
    await expect(
      svc.crear({ motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('vincula consulta y pasa a en_atencion', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    await svc.vincularConsulta(c.id, 'cons1', 'p1', user);
    const upd = await svc.obtener(c.id, user);
    expect(upd.consultaId).toBe('cons1');
    expect(upd.estado).toBe('en_atencion');
  });

  it('lista citas programadas de las proximas 2 horas ordenadas', async () => {
    const { svc, repo } = build();
    repo.store.set('c1', {
      id: 'c1',
      orgId: 'orgA',
      veterinarioId: 'u1',
      pacienteId: 'p1',
      titulo: 'Dentro',
      fecha: '2026-06-18T13:00:00Z',
      estado: 'programada',
    });
    repo.store.set('c2', {
      id: 'c2',
      orgId: 'orgA',
      veterinarioId: 'u1',
      pacienteId: 'p1',
      titulo: 'Despues',
      fecha: '2026-06-18T16:30:00Z',
      estado: 'programada',
    });
    repo.store.set('c3', {
      id: 'c3',
      orgId: 'orgA',
      veterinarioId: 'u1',
      pacienteId: 'p1',
      titulo: 'Cancelada',
      fecha: '2026-06-18T13:30:00Z',
      estado: 'cancelada',
    });

    const res = await svc.proximasHoras(user, 2, new Date('2026-06-18T12:00:00Z'));
    expect(res.map((c) => c.id)).toEqual(['c1']);
  });

  it('permite transicion valida en_atencion -> realizada con consulta', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'X', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    await svc.vincularConsulta(c.id, 'cons1', 'p1', user);
    const upd = await svc.cambiarEstado(c.id, 'realizada', user);
    expect(upd.estado).toBe('realizada');
  });

  it('rechaza realizada sin consulta vinculada', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'X', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    await expect(svc.cambiarEstado(c.id, 'realizada', user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza transicion invalida (cancelada -> realizada) con 400', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'X', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    await svc.cambiarEstado(c.id, 'cancelada', user);
    await expect(svc.cambiarEstado(c.id, 'realizada', user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('vincula paciente a cita legacy sin pacienteId', async () => {
    const { svc, repo } = build();
    repo.store.set('legacy1', {
      id: 'legacy1',
      orgId: 'orgA',
      veterinarioId: 'u1',
      titulo: 'firulais',
      fecha: '2026-07-01T10:00:00Z',
      estado: 'programada',
    });
    const v = await svc.vincularPaciente('legacy1', 'p1', user);
    expect(v.pacienteId).toBe('p1');
    expect(v.pacienteNombre).toBe('Firulais');
  });

  it('no permite cambiar estado de cita de otro tenant', async () => {
    const { svc } = build();
    const c = await svc.crear(
      { motivo: 'X', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' },
      user,
    );
    await svc.vincularConsulta(c.id, 'cons1', 'p1', user);
    await expect(svc.cambiarEstado(c.id, 'realizada', otro)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no actualiza citas por endpoint clinico', async (_label, actor) => {
    const { svc, repo } = build();
    repo.store.set('cita-guard', {
      id: 'cita-guard',
      orgId: 'orgA',
      veterinarioId: 'u1',
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
      pacienteId: 'p1',
      pacienteNombre: 'Firulais',
      titulo: 'Control',
      motivo: 'Control',
      fecha: '2026-07-01T10:00:00Z',
      estado: 'programada',
    });
    await expect(svc.actualizar('cita-guard', { motivo: 'Nope' }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.cambiarEstado('cita-guard', 'cancelada', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
