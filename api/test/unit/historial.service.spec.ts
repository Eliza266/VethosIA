import { HistorialService } from '../../src/modules/pacientes/historial.service';
import { PacientesService } from '../../src/modules/pacientes/pacientes.service';
import { PacienteDoc } from '../../src/modules/pacientes/paciente.types';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { fakeFirebase } from './saas.fakes';

const legacyVet: AuthUser = { uid: 'vet1', orgId: 'orgA', rol: 'vet' };
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

function build(paciente: PacienteDoc) {
  const { fb, fs } = fakeFirebase();
  const pacientes = {
    obtener: jest.fn(async () => paciente),
  } as unknown as PacientesService;
  return { svc: new HistorialService(fb, pacientes), fs, pacientes };
}

describe('HistorialService', () => {
  it('filtra consultas vacunas y citas por scope V2 del paciente, no solo por pacienteId', async () => {
    const { svc, fs } = build({
      id: 'p1',
      nombre: 'Rex',
      orgId: 'orgA',
      veterinarioId: 'vet1',
      accountType: 'veterinaria',
      accountId: 'vetA',
      entidadId: 'entA',
      veterinariaId: 'vetA',
      planOwnerType: 'entidad',
      planOwnerId: 'entA',
      deletedAt: null,
    });
    fs.store.set('consultas/c-own', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetA', entidadId: 'entA', veterinariaId: 'vetA', estado: 'aprobada' });
    fs.store.set('consultas/c-other-entity', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetB', entidadId: 'entB', veterinariaId: 'vetB', estado: 'aprobada' });
    fs.store.set('consultas/c-other-vet', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetB', entidadId: 'entA', veterinariaId: 'vetB', estado: 'aprobada' });
    fs.store.set('consultas/c-legacy-org-only', { pacienteId: 'p1', orgId: 'orgA', estado: 'aprobada' });
    fs.store.set('vacunas/v-own', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetA', entidadId: 'entA', veterinariaId: 'vetA', nombre: 'Rabia' });
    fs.store.set('vacunas/v-other-vet', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetB', entidadId: 'entA', veterinariaId: 'vetB', nombre: 'Moquillo' });
    fs.store.set('citas/a-own', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetA', entidadId: 'entA', veterinariaId: 'vetA', estado: 'realizada' });
    fs.store.set('citas/a-other-entity', { pacienteId: 'p1', accountType: 'veterinaria', accountId: 'vetB', entidadId: 'entB', veterinariaId: 'vetB', estado: 'realizada' });

    const res = await svc.consolidar('p1', adminVeterinariaV2);

    expect(res.consultas.map((c) => c.id)).toEqual(['c-own']);
    expect(res.vacunas.map((v) => v.id)).toEqual(['v-own']);
    expect(res.citas.map((c) => c.id)).toEqual(['a-own']);
  });

  it('usa orgId como fallback legacy solo cuando el paciente no tiene scope V2', async () => {
    const { svc, fs } = build({
      id: 'p1',
      nombre: 'Rex',
      orgId: 'orgA',
      veterinarioId: 'vet1',
      deletedAt: null,
    });
    fs.store.set('consultas/c-org-a', { pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'vet1', estado: 'aprobada' });
    fs.store.set('consultas/c-org-b', { pacienteId: 'p1', orgId: 'orgB', veterinarioId: 'vet2', estado: 'aprobada' });
    fs.store.set('vacunas/v-org-a', { pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'vet1', nombre: 'Rabia' });
    fs.store.set('vacunas/v-org-b', { pacienteId: 'p1', orgId: 'orgB', veterinarioId: 'vet2', nombre: 'Rabia' });
    fs.store.set('citas/a-org-a', { pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'vet1', estado: 'realizada' });
    fs.store.set('citas/a-org-b', { pacienteId: 'p1', orgId: 'orgB', veterinarioId: 'vet2', estado: 'realizada' });

    const res = await svc.consolidar('p1', legacyVet);

    expect(res.consultas.map((c) => c.id)).toEqual(['c-org-a']);
    expect(res.vacunas.map((v) => v.id)).toEqual(['v-org-a']);
    expect(res.citas.map((c) => c.id)).toEqual(['a-org-a']);
  });
});
