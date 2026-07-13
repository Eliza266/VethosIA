import { MetricasService } from '../../src/modules/plataforma/metricas.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { COLLECTIONS } from '../../src/common/firebase/collections';
import { fakeFirebase } from './saas.fakes';

const adminVeterinaria: AuthUser = {
  uid: 'adminVet',
  email: 'admin.veterinaria@x.com',
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

function seedPaciente(
  fs: ReturnType<typeof fakeFirebase>['fs'],
  id: string,
  esPlaceholder?: boolean,
  extra?: Record<string, unknown>,
) {
  fs.store.set(`${COLLECTIONS.pacientes}/${id}`, {
    veterinariaId: 'vetclin_1',
    accountId: 'vetclin_1',
    orgId: 'orgA',
    especie: 'perro',
    ...(esPlaceholder !== undefined ? { esPlaceholder } : {}),
    ...extra,
  });
}

function seedBrigada(
  fs: ReturnType<typeof fakeFirebase>['fs'],
  id: string,
  estado: 'planificada' | 'en_curso' | 'finalizada',
  veterinarioIds: string[] = [],
) {
  fs.store.set(`${COLLECTIONS.brigadas}/${id}`, {
    veterinariaId: 'vetclin_1',
    accountId: 'vetclin_1',
    orgId: 'orgA',
    entidadId: 'ent_1',
    estado,
    veterinarioIds,
    fecha: '2026-07-01',
  });
}

// Simula un Timestamp de Firestore: no es un string ni un Date de JS, pero tiene .toDate().
// admin.firestore.FieldValue.serverTimestamp() vuelve exactamente asi al leerse.
function fakeTimestamp(iso: string) {
  return { toDate: () => new Date(iso) };
}

describe('MetricasService - conteo de pacientes', () => {
  it('no cuenta pacientes placeholder (consulta rapida sin confirmar) en el total', async () => {
    const { fb, fs } = fakeFirebase();
    seedPaciente(fs, 'p1');
    seedPaciente(fs, 'p2');
    seedPaciente(fs, 'p3', true); // placeholder: no debe contar

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria);

    expect(resumen.pacientes).toBe(2);
  });

  it('coincide con el listado real de Pacientes cuando no hay placeholders', async () => {
    const { fb, fs } = fakeFirebase();
    seedPaciente(fs, 'p1', false);
    seedPaciente(fs, 'p2', false);

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria);

    expect(resumen.pacientes).toBe(2);
  });
});

describe('MetricasService - evolucion mensual (pacientesPorMes / consultasPorMes)', () => {
  it('cuenta un paciente cuyo creadoEn es un Timestamp de Firestore (no string ni Date)', async () => {
    const { fb, fs } = fakeFirebase();
    const hoy = new Date('2026-07-10T00:00:00.000Z');
    seedPaciente(fs, 'p1', false, { creadoEn: fakeTimestamp('2026-07-05T10:00:00.000Z') });

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria, { hoy });

    const mesActual = resumen.pacientesPorMes?.find((p) => p.mes === '2026-07');
    expect(mesActual?.total).toBe(1);
  });

  it('sigue contando fechas en formato string ISO (no rompe el caso ya soportado)', async () => {
    const { fb, fs } = fakeFirebase();
    const hoy = new Date('2026-07-10T00:00:00.000Z');
    seedPaciente(fs, 'p1', false, { creadoEn: '2026-07-05T10:00:00.000Z' });

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria, { hoy });

    const mesActual = resumen.pacientesPorMes?.find((p) => p.mes === '2026-07');
    expect(mesActual?.total).toBe(1);
  });
});

describe('MetricasService - brigadas', () => {
  it('cuenta brigadas por estado y participantes unicos, dentro del scope del usuario', async () => {
    const { fb, fs } = fakeFirebase();
    seedBrigada(fs, 'b1', 'planificada', ['vet1']);
    seedBrigada(fs, 'b2', 'en_curso', ['vet1', 'vet2']);
    seedBrigada(fs, 'b3', 'finalizada', ['vet2']);

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria);

    expect(resumen.brigadas).toBe(3);
    expect(resumen.brigadasPlanificadas).toBe(1);
    expect(resumen.brigadasEnCurso).toBe(1);
    expect(resumen.brigadasFinalizadas).toBe(1);
    expect(resumen.brigadasParticipantes).toBe(2);
  });

  it('no cuenta brigadas fuera del scope de la veterinaria del usuario', async () => {
    const { fb, fs } = fakeFirebase();
    seedBrigada(fs, 'b1', 'planificada', ['vet1']);
    fs.store.set(`${COLLECTIONS.brigadas}/otra`, {
      veterinariaId: 'otra_clinica',
      accountId: 'otra_clinica',
      orgId: 'orgB',
      entidadId: 'ent_2',
      estado: 'en_curso',
      veterinarioIds: ['vetX'],
      fecha: '2026-07-01',
    });

    const svc = new MetricasService(fb);
    const resumen = await svc.resumen(adminVeterinaria);

    expect(resumen.brigadas).toBe(1);
    expect(resumen.brigadasEnCurso).toBe(0);
  });
});
