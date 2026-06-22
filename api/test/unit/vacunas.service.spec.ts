import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VacunasService } from '../../src/modules/vacunas/vacunas.service';
import { VacunasRepository } from '../../src/modules/vacunas/vacunas.repository';
import { calcularEstadoVacuna, VacunaDoc } from '../../src/modules/vacunas/vacuna.types';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { PacientesService } from '../../src/modules/pacientes/pacientes.service';
import { ActualizarVacunaDto } from '../../src/modules/vacunas/dto/vacuna.dto';

const HOY = new Date('2026-06-14T12:00:00Z');

describe('calcularEstadoVacuna (fronteras)', () => {
  it('sin proxima dosis -> al_dia', () => {
    expect(calcularEstadoVacuna(undefined, HOY)).toBe('al_dia');
  });
  it('proxima en el pasado -> vencida', () => {
    expect(calcularEstadoVacuna('2026-06-13T12:00:00Z', HOY)).toBe('vencida');
  });
  it('proxima hoy -> proxima_a_vencer (frontera 0 dias)', () => {
    expect(calcularEstadoVacuna('2026-06-14T12:00:00Z', HOY)).toBe('proxima_a_vencer');
  });
  it('proxima en +7 dias -> proxima_a_vencer', () => {
    expect(calcularEstadoVacuna('2026-06-21T12:00:00Z', HOY)).toBe('proxima_a_vencer');
  });
  it('proxima en el limite de la ventana (+30) -> proxima_a_vencer', () => {
    expect(calcularEstadoVacuna('2026-07-14T12:00:00Z', HOY)).toBe('proxima_a_vencer');
  });
  it('proxima mas alla de la ventana (+31) -> al_dia', () => {
    expect(calcularEstadoVacuna('2026-07-15T13:00:00Z', HOY)).toBe('al_dia');
  });
});

class FakeRepo {
  store = new Map<string, VacunaDoc>();
  private seq = 0;
  async crear(data: Omit<VacunaDoc, 'id' | 'estado'>): Promise<VacunaDoc> {
    const id = `v${++this.seq}`;
    const doc = { ...data, id } as VacunaDoc;
    this.store.set(id, doc);
    return doc;
  }
  async getById(id: string): Promise<VacunaDoc> {
    const doc = this.store.get(id);
    if (!doc) throw new NotFoundException(`Vacuna ${id} no existe.`);
    return { ...doc };
  }
  async actualizar(id: string, data: Partial<VacunaDoc>): Promise<void> {
    const prev = this.store.get(id);
    if (prev) {
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) throw new Error(`Firestore rechaza undefined en ${k}`);
      }
      if (Object.getPrototypeOf(data) !== Object.prototype) {
        throw new Error('Firestore rechaza instancia de clase');
      }
      this.store.set(id, { ...prev, ...data });
    }
  }
  async softDelete(id: string): Promise<void> {
    const prev = this.store.get(id);
    if (prev) this.store.set(id, { ...prev, eliminadaEn: '2026-06-14' });
  }
  async listarPorPaciente(pacienteId: string): Promise<VacunaDoc[]> {
    return [...this.store.values()].filter((v) => v.pacienteId === pacienteId && !v.eliminadaEn);
  }
  async listarPorTenant(): Promise<VacunaDoc[]> {
    return [...this.store.values()].filter((v) => !v.eliminadaEn);
  }
}

class FakePacientes {
  accesibles = new Set<string>(['p1']);
  async obtener(id: string, user: AuthUser) {
    if (!this.accesibles.has(id)) {
      throw new ForbiddenException('No tienes acceso a este recurso (otro tenant/dueño).');
    }
    return { id, orgId: user.orgId, veterinarioId: user.uid, nombre: 'Paciente' };
  }
}

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };

function build() {
  const repo = new FakeRepo();
  const pacientes = new FakePacientes();
  const notificaciones = { crear: jest.fn(async () => ({ id: 'n1' })) };
  const svc = new VacunasService(
    repo as unknown as VacunasRepository,
    pacientes as unknown as PacientesService,
    notificaciones as never,
  );
  return { svc, repo, pacientes, notificaciones };
}

describe('VacunasService', () => {
  it('crear devuelve la vacuna con estado calculado', async () => {
    const { svc } = build();
    const v = await svc.crear(
      { pacienteId: 'p1', nombre: 'Rabia', proximaDosis: '2026-06-13T12:00:00Z' },
      user,
    );
    expect(v.estado).toBe('vencida');
    expect(v.orgId).toBe('orgA');
  });

  it('calcula proxima dosis al registrar aplicada desde catalogo base', async () => {
    const { svc } = build();
    const v = await svc.crear(
      {
        pacienteId: 'p1',
        nombre: 'Rabia',
        catalogoCodigo: 'perro-rabia',
        aplicada: '2026-06-14',
      },
      user,
    );
    expect(v.fuente).toBe('catalogo_base');
    expect(v.intervaloDias).toBe(365);
    expect(v.proximaDosis).toBe('2027-06-14');
    expect(v.aplicaciones).toEqual(['2026-06-14']);
    expect(v.estado).toBe('al_dia');
  });

  it('crear rechaza paciente de otro tenant', async () => {
    const { svc, pacientes } = build();
    pacientes.accesibles.clear();
    await expect(
      svc.crear({ pacienteId: 'p2', nombre: 'Rabia' }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listarPorPaciente filtra vacunas de otro tenant', async () => {
    const { svc, repo } = build();
    await repo.crear({
      pacienteId: 'p1',
      nombre: 'A',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    await repo.crear({
      pacienteId: 'p1',
      nombre: 'B',
      orgId: 'orgB',
      veterinarioId: 'u2',
    });
    const list = await svc.listarPorPaciente('p1', user);
    expect(list).toHaveLength(1);
    expect(list[0].nombre).toBe('A');
  });

  it('actualizarPorPaciente valida pacienteId en la URL', async () => {
    const { svc, repo } = build();
    const v = await repo.crear({
      pacienteId: 'p1',
      nombre: 'Rabia',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    await expect(
      svc.actualizarPorPaciente('pOtro', v.id, { nombre: 'X' }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('actualizarPorPaciente rechaza vacuna de otro paciente', async () => {
    const { svc, repo, pacientes } = build();
    pacientes.accesibles.add('p2');
    const v = await repo.crear({
      pacienteId: 'p2',
      nombre: 'Parvo',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    await expect(
      svc.actualizarPorPaciente('p1', v.id, { nombre: 'X' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eliminarPorPaciente hace soft-delete y la oculta de listados', async () => {
    const { svc, repo } = build();
    const v = await repo.crear({
      pacienteId: 'p1',
      nombre: 'Rabia',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    await svc.eliminarPorPaciente('p1', v.id, user);
    expect(repo.store.get(v.id)?.eliminadaEn).toBeDefined();
    await expect(svc.listarPorPaciente('p1', user)).resolves.toEqual([]);
  });

  it('contarProximas cuenta solo las proximas a vencer', async () => {
    const { svc } = build();
    await svc.crear({ pacienteId: 'p1', nombre: 'A', proximaDosis: '2026-06-20T12:00:00Z' }, user);
    await svc.crear({ pacienteId: 'p1', nombre: 'B', proximaDosis: '2026-12-20T12:00:00Z' }, user);
    await svc.crear({ pacienteId: 'p1', nombre: 'C', proximaDosis: '2026-01-01T12:00:00Z' }, user);
    const n = await svc.contarProximas(user, HOY);
    expect(n).toBe(1);
  });

  it('filtra por estado especie paciente y tipo', async () => {
    const { svc } = build();
    await svc.crear({
      pacienteId: 'p1',
      nombre: 'Rabia',
      especie: 'perro',
      catalogoCodigo: 'perro-rabia',
      proximaDosis: '2026-06-20',
    }, user);
    await svc.crear({
      pacienteId: 'p1',
      nombre: 'Triple felina',
      especie: 'gato',
      catalogoCodigo: 'gato-triple-felina',
      proximaDosis: '2026-01-01',
    }, user);

    await expect(svc.listar({ pacienteId: 'p1', estado: 'proxima_a_vencer' }, user, HOY))
      .resolves.toHaveLength(1);
    await expect(svc.listar({ especie: 'gato', vencidas: 'true' }, user, HOY))
      .resolves.toMatchObject([{ nombre: 'Triple felina' }]);
    await expect(svc.listar({ tipo: 'perro-rabia' }, user, HOY))
      .resolves.toMatchObject([{ nombre: 'Rabia' }]);
  });

  it('marcar vencida como aplicada genera nueva proxima dosis e historial', async () => {
    const { svc, repo } = build();
    const v = await repo.crear({
      pacienteId: 'p1',
      nombre: 'Rabia',
      orgId: 'orgA',
      veterinarioId: 'u1',
      catalogoCodigo: 'perro-rabia',
      intervaloDias: 365,
      aplicada: '2025-06-14',
      aplicaciones: ['2025-06-14'],
      proximaDosis: '2026-06-01',
    });

    const aplicada = await svc.marcarAplicadaPorPaciente(
      'p1',
      v.id,
      { aplicada: '2026-06-14' },
      user,
      HOY,
    );

    expect(aplicada.aplicada).toBe('2026-06-14');
    expect(aplicada.aplicaciones).toEqual(['2025-06-14', '2026-06-14']);
    expect(aplicada.proximaDosis).toBe('2027-06-14');
    expect(aplicada.estado).toBe('al_dia');
  });

  it('crea recordatorio interno al registrar vacuna proxima o vencida', async () => {
    const { svc, notificaciones } = build();
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + 5);
    const proximaStr = proxima.toISOString().slice(0, 10);
    await svc.crear(
      { pacienteId: 'p1', nombre: 'Rabia', proximaDosis: proximaStr },
      user,
    );
    expect(notificaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'vacunas_pendientes',
        destinatarioUid: 'u1',
        dedupeKey: expect.stringContaining('proxima_a_vencer'),
      }),
    );
  });

  it('actualizarPorPaciente serializa ActualizarVacunaDto instanciado (PATCH prod)', async () => {
    const { svc, repo } = build();
    const v = await repo.crear({
      pacienteId: 'p1',
      nombre: 'Rabia',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    const dto = new ActualizarVacunaDto();
    dto.nombre = 'Rabia reforzada';
    const upd = await svc.actualizarPorPaciente('p1', v.id, dto, user);
    expect(upd.nombre).toBe('Rabia reforzada');
  });
});
