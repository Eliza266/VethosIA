import { ConsumoService } from '../../src/modules/saas/consumo.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { fakeFirebase } from './saas.fakes';

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };
const indep: AuthUser = { uid: 'u9', rol: 'vet' };
const MARZO = new Date('2026-03-10T12:00:00Z');
const ABRIL = new Date('2026-04-01T00:00:00Z');

describe('ConsumoService', () => {
  it('scope: entidad usa orgId; independiente usa vet_<uid>', () => {
    const { fb } = fakeFirebase();
    const svc = new ConsumoService(fb);
    expect(svc.scopeId(user)).toBe('orgA');
    expect(svc.scopeId(indep)).toBe('vet_u9');
  });

  it('registrarUso incrementa el contador del periodo', async () => {
    const { fb } = fakeFirebase();
    const svc = new ConsumoService(fb);
    const e1 = await svc.registrarUso(user, 10, MARZO);
    expect(e1.usados).toBe(1);
    const e2 = await svc.registrarUso(user, 10, MARZO);
    expect(e2.usados).toBe(2);
  });

  it('marca alcanzo80 y bloqueado en las fronteras', async () => {
    const { fb } = fakeFirebase();
    const svc = new ConsumoService(fb);
    let estado;
    for (let i = 0; i < 4; i++) estado = await svc.registrarUso(user, 5, MARZO);
    // 4/5 = 80% -> alcanzo80, aun no bloqueado
    expect(estado!.alcanzo80).toBe(true);
    expect(estado!.bloqueado).toBe(false);
    estado = await svc.registrarUso(user, 5, MARZO); // 5/5
    expect(estado!.bloqueado).toBe(true);
  });

  it('puedeGenerar es false cuando se alcanzo el limite', async () => {
    const { fb } = fakeFirebase();
    const svc = new ConsumoService(fb);
    await svc.registrarUso(user, 1, MARZO);
    expect(await svc.puedeGenerar(user, 1, MARZO)).toBe(false);
    expect(await svc.puedeGenerar(user, 2, MARZO)).toBe(true);
  });

  it('reinicio mensual: otro mes arranca en 0', async () => {
    const { fb } = fakeFirebase();
    const svc = new ConsumoService(fb);
    await svc.registrarUso(user, 10, MARZO);
    await svc.registrarUso(user, 10, MARZO);
    const marzo = await svc.estado(user, 10, MARZO);
    expect(marzo.usados).toBe(2);
    const abril = await svc.estado(user, 10, ABRIL);
    expect(abril.usados).toBe(0);
  });
});
