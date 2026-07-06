import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PacientesService } from '../../src/modules/pacientes/pacientes.service';
import { PacientesRepository } from '../../src/modules/pacientes/pacientes.repository';
import { PacienteDoc } from '../../src/modules/pacientes/paciente.types';
import { ActualizarPacienteDto } from '../../src/modules/pacientes/dto/paciente.dto';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { formatoPacId } from '../../src/common/firebase/collections';

// Repo en memoria: simula Firestore para probar la logica del service sin emulador.
class FakeRepo {
  store = new Map<string, PacienteDoc>();
  contador = new Map<string, number>();
  private seq = 0;

  async crear(data: Omit<PacienteDoc, 'id' | 'codigo'>, tenant: string): Promise<PacienteDoc> {
    const n = (this.contador.get(tenant) ?? 0) + 1;
    this.contador.set(tenant, n);
    const id = `p${++this.seq}`;
    const doc: PacienteDoc = { ...(data as PacienteDoc), id, codigo: formatoPacId(n), deletedAt: null };
    this.store.set(id, doc);
    return doc;
  }
  async getById(id: string): Promise<PacienteDoc> {
    const d = this.store.get(id);
    if (!d) throw new NotFoundException();
    return { ...d };
  }
  async actualizar(id: string, data: Partial<PacienteDoc>): Promise<void> {
    this.store.set(id, { ...(this.store.get(id) as PacienteDoc), ...data });
  }
  async softDelete(id: string): Promise<void> {
    this.store.set(id, { ...(this.store.get(id) as PacienteDoc), deletedAt: '2026-01-01' });
  }
  async listar(tenant: { orgId?: string; uid?: string; accountId?: string; entidadId?: string; veterinariaId?: string }): Promise<PacienteDoc[]> {
    return [...this.store.values()]
      .filter((p) => {
        if (tenant.entidadId && p.entidadId === tenant.entidadId) return true;
        if (tenant.veterinariaId && p.veterinariaId === tenant.veterinariaId) return true;
        if (tenant.accountId && p.accountId === tenant.accountId) return true;
        return tenant.orgId ? p.orgId === tenant.orgId : p.veterinarioId === tenant.uid;
      })
      .filter((p) => p.deletedAt == null);
  }
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
const vetIndependienteV2: AuthUserV2 = {
  uid: 'vet-ind',
  rol: 'vet',
  v: 2,
  role: 'veterinario',
  accountType: 'vet_individual',
  accountId: 'vet_vet-ind',
  membershipId: 'm-vet-ind',
  planOwnerType: 'vet',
  planOwnerId: 'vet_vet-ind',
};

function svcWith(): { svc: PacientesService; repo: FakeRepo } {
  const repo = new FakeRepo();
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) };
  const svc = new PacientesService(
    repo as unknown as PacientesRepository,
    auditoria as never,
    {} as never,
  );
  return { svc, repo };
}

describe('PacientesService', () => {
  it('crea paciente con id legible PAC-XXXXXX por tenant', async () => {
    const { svc } = svcWith();
    const p1 = await svc.crear({ nombre: 'Firulais' }, user);
    const p2 = await svc.crear({ nombre: 'Michi' }, user);
    expect(p1.codigo).toBe('PAC-000001');
    expect(p2.codigo).toBe('PAC-000002');
    expect(p1.orgId).toBe('orgA');
    expect(p1.veterinarioId).toBe('u1');
  });

  it('crea paciente V2 con scope canonico server-side', async () => {
    const { svc, repo } = svcWith();
    const p = await svc.crear({ nombre: 'Solo' }, vetIndependienteV2);
    expect(p).toMatchObject({
      accountType: 'vet_individual',
      accountId: 'vet_vet-ind',
      planOwnerType: 'vet',
      planOwnerId: 'vet_vet-ind',
      membershipId: 'm-vet-ind',
      veterinarioId: 'vet-ind',
    });
    expect(repo.contador.get('vet_vet-ind')).toBe(1);
  });

  it('admin veterinaria crea paciente V2 dentro de su veterinaria', async () => {
    const { svc } = svcWith();
    const p = await svc.crear({ nombre: 'Clinica' }, adminVeterinariaV2);
    expect(p).toMatchObject({
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      membershipId: 'm-vet-a',
    });
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no crea pacientes por endpoint clinico', async (_label, actor) => {
    const { svc } = svcWith();
    await expect(svc.crear({ nombre: 'Bloqueado' }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('contador de codigo es independiente por tenant', async () => {
    const { svc } = svcWith();
    const a = await svc.crear({ nombre: 'A' }, user);
    const b = await svc.crear({ nombre: 'B' }, otro);
    expect(a.codigo).toBe('PAC-000001');
    expect(b.codigo).toBe('PAC-000001');
  });

  it('soft delete: no aparece en listado ni es accesible, pero persiste en BD', async () => {
    const { svc, repo } = svcWith();
    const p = await svc.crear({ nombre: 'Rex' }, user);
    await svc.eliminar(p.id, user);

    const listado = await svc.listar(user);
    expect(listado.find((x) => x.id === p.id)).toBeUndefined();
    await expect(svc.obtener(p.id, user)).rejects.toBeInstanceOf(NotFoundException);
    // sigue existiendo fisicamente
    const enBd = await repo.getById(p.id);
    expect(enBd).toBeDefined();
    expect(enBd.deletedAt).not.toBeNull();
  });

  it('no permite acceder a paciente de otro tenant', async () => {
    const { svc } = svcWith();
    const p = await svc.crear({ nombre: 'Rex' }, user);
    await expect(svc.obtener(p.id, otro)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('superadmin V2 no crea pacientes por endpoint tenant normal', async () => {
    const { svc } = svcWith();
    const superadminV2: AuthUserV2 = { uid: 'root', rol: 'superadmin', v: 2, role: 'superadmin' };
    await expect(svc.crear({ nombre: 'Global' }, superadminV2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('actualizar respeta acceso y persiste cambios', async () => {
    const { svc } = svcWith();
    const p = await svc.crear({ nombre: 'Rex' }, user);
    const upd = await svc.actualizar(p.id, { nombre: 'Rex II', ultimoPeso: 12 }, user);
    expect(upd.nombre).toBe('Rex II');
    expect(upd.ultimoPeso).toBe(12);
  });

  it('admin veterinaria no actualiza paciente de otra veterinaria', async () => {
    const { svc, repo } = svcWith();
    repo.store.set('p-sibling', {
      id: 'p-sibling',
      codigo: 'PAC-000001',
      nombre: 'Sibling',
      orgId: 'orgA',
      veterinarioId: 'vet-b',
      accountType: 'veterinaria',
      accountId: 'vetB',
      entidadId: 'entA',
      veterinariaId: 'vetB',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
      deletedAt: null,
    });
    await expect(
      svc.actualizar('p-sibling', { nombre: 'Nope' }, adminVeterinariaV2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['asistente legacy', asistente],
    ['superadmin legacy', superadmin],
    ['admin entidad V2', adminEntidadV2],
  ])('%s no actualiza pacientes por endpoint clinico', async (_label, actor) => {
    const { svc } = svcWith();
    const p = await svc.crear({ nombre: 'Rex' }, user);
    await expect(svc.actualizar(p.id, { nombre: 'Bloqueado' }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('actualizar persiste foto (URL Storage)', async () => {
    const { svc } = svcWith();
    const p = await svc.crear({ nombre: 'Michi' }, user);
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/foto.png?alt=media&token=abc';
    const upd = await svc.actualizar(p.id, { foto: url }, user);
    expect(upd.foto).toBe(url);
    expect((await svc.obtener(p.id, user)).foto).toBe(url);
  });

  it('actualizar convierte instancia DTO a POJO antes de Firestore', async () => {
    const repo = new FakeRepo();
    const actualizarSpy = jest.spyOn(repo, 'actualizar');
    const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) };
    const svc = new PacientesService(
      repo as unknown as PacientesRepository,
      auditoria as never,
      {} as never,
    );
    const p = await svc.crear({ nombre: 'Luna' }, user);
    const dto = Object.assign(new ActualizarPacienteDto(), {
      foto: 'https://firebasestorage.googleapis.com/v0/b/x/o/foto.png?alt=media&token=abc',
    });
    await svc.actualizar(p.id, dto, user);
    const payload = actualizarSpy.mock.calls[0]?.[1];
    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype);
    expect(payload?.foto).toContain('firebasestorage.googleapis.com');
  });

  it('listar excluye eliminados y filtra por tenant', async () => {
    const { svc } = svcWith();
    await svc.crear({ nombre: 'A' }, user);
    const b = await svc.crear({ nombre: 'B' }, user);
    await svc.crear({ nombre: 'C' }, otro);
    await svc.eliminar(b.id, user);
    const listado = await svc.listar(user);
    expect(listado.map((p) => p.nombre).sort()).toEqual(['A']);
  });
});
