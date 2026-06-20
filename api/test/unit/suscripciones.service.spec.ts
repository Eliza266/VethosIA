import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { fakeFirebase } from './saas.fakes';
import { clasificarCartera } from '../../src/modules/saas/cobros.service';

const admin: AuthUser = { uid: 'a1', orgId: 'orgA', rol: 'admin' };

function build() {
  const { fb, fs } = fakeFirebase();
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) } as never;
  return { svc: new SuscripcionesService(fb, auditoria), fs };
}

describe('SuscripcionesService', () => {
  it('limiteHistoriasMes cae al default de trial sin suscripcion', async () => {
    const { svc } = build();
    expect(await svc.limiteHistoriasMes(admin)).toBeGreaterThan(0);
  });

  it('extenderTrial mueve trialHasta al futuro y deja estado trial_activa', async () => {
    const { svc, fs } = build();
    fs.store.set('suscripciones/sub1', { orgId: 'orgA', estado: 'bloqueado_fin_trial' });
    const res = await svc.extenderTrial('sub1', 10, admin);
    expect(res.estado).toBe('trial_activa');
    expect(new Date(res.trialHasta as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('cambiarEstado rechaza transicion invalida', async () => {
    const { svc, fs } = build();
    fs.store.set('suscripciones/sub2', { orgId: 'orgA', estado: 'cancelada' });
    await expect(svc.cambiarEstado('sub2', 'activa', admin)).rejects.toBeTruthy();
  });

  it('asientosDisponibles cuenta miembros de la entidad', async () => {
    const { svc, fs } = build();
    fs.store.set('suscripciones/sub3', { orgId: 'orgA', asientosMax: 3 });
    fs.store.set('miembros/u1', { orgId: 'orgA', rol: 'vet' });
    fs.store.set('miembros/u2', { orgId: 'orgA', rol: 'admin' });
    const a = await svc.asientosDisponibles(admin);
    expect(a.max).toBe(3);
    expect(a.usados).toBe(2);
    expect(a.libres).toBe(1);
  });

  it('admin_veterinaria gestiona suscripcion solo si planOwner es su veterinaria', async () => {
    const { svc, fs } = build();
    const adminVet: AuthUser = {
      uid: 'adminVet',
      rol: 'admin',
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      membershipId: 'm_adminVet',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    };
    fs.store.set('suscripciones/sub-vetclin', {
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      estado: 'trial_activa',
    });

    const res = await svc.cambiarEstado('sub-vetclin', 'activa', adminVet);

    expect(res.estado).toBe('activa');
  });

  it('admin_veterinaria con plan heredado solo lectura: no cambia suscripcion de entidad', async () => {
    const { svc, fs } = build();
    const adminVet: AuthUser = {
      uid: 'adminVet',
      orgId: 'orgA',
      rol: 'admin',
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      membershipId: 'm_adminVet',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    };
    fs.store.set('suscripciones/sub-ent', {
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      entidadId: 'ent_1',
      estado: 'trial_activa',
    });

    await expect(svc.cambiarEstado('sub-ent', 'activa', adminVet)).rejects.toThrow(
      /plan owner/i,
    );
  });
});

describe('clasificarCartera', () => {
  const hoy = new Date('2026-06-17T12:00:00Z');

  it('clasifica cuenta activa como al_dia', () => {
    expect(clasificarCartera({ estado: 'activa', vigenteHasta: '2026-07-01T00:00:00Z' }, hoy)).toMatchObject({
      estado: 'al_dia',
      requierePago: false,
    });
  });

  it('clasifica pendiente cuando esta por vencer', () => {
    expect(clasificarCartera({ estado: 'por_vencer', vigenteHasta: '2026-06-20T00:00:00Z' }, hoy)).toMatchObject({
      estado: 'pendiente',
      requierePago: true,
    });
  });

  it('clasifica vencimientos por antiguedad', () => {
    expect(clasificarCartera({ estado: 'vencida', vigenteHasta: '2026-06-10T00:00:00Z' }, hoy).estado).toBe('vencido_1_30');
    expect(clasificarCartera({ estado: 'vencida', vigenteHasta: '2026-05-01T00:00:00Z' }, hoy).estado).toBe('vencido_31_60');
    expect(clasificarCartera({ estado: 'vencida', vigenteHasta: '2026-03-01T00:00:00Z' }, hoy).estado).toBe('vencido_60_mas');
  });

  it('clasifica bloqueos por mora o fin de trial como bloqueado', () => {
    expect(clasificarCartera({ estado: 'bloqueada_mora', vigenteHasta: '2026-06-01T00:00:00Z' }, hoy).estado).toBe('bloqueado');
    expect(clasificarCartera({ estado: 'bloqueado_fin_trial', vigenteHasta: '2026-06-01T00:00:00Z' }, hoy).estado).toBe('bloqueado');
  });
});
