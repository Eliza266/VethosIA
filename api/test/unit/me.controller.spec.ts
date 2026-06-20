import { MeController } from '../../src/modules/tenant/me.controller';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { AccesoService } from '../../src/modules/plataforma/acceso.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

const perfilBase = {
  uid: 'u1',
  nombre: 'Dr Vet',
  email: 'a@b.com',
  foto: null,
  telefono: '+57 300',
  whatsapp: null,
  ciudad: 'Bogotá',
  sede: 'Norte',
  veterinaria: 'Clínica Amigos',
  matriculaProfesional: '12345',
};

describe('MeController', () => {
  const tenantWith = (opts: {
    miembro?: { orgId: string; rol: 'admin' | 'vet' } | null;
    perfil?: typeof perfilBase | null;
    orgNombre?: string | null;
  }) => {
    const perfil = opts.perfil ?? perfilBase;
    return {
      obtenerMiembro: jest.fn().mockResolvedValue(opts.miembro ?? null),
      obtenerMembershipV2: jest.fn().mockResolvedValue(null),
      asegurarPerfilVeterinario: jest.fn().mockResolvedValue(perfil),
      obtenerPerfilVeterinario: jest.fn().mockResolvedValue(perfil),
      actualizarPerfilVeterinario: jest.fn().mockResolvedValue({ ...perfil, telefono: '999' }),
      obtenerNombreOrganizacion: jest.fn().mockResolvedValue(opts.orgNombre ?? 'Clínica Test'),
      obtenerNombreVeterinaria: jest.fn().mockResolvedValue('Sede Norte'),
    } as unknown as TenantService;
  };

  const accesoOk = () =>
    ({ validarEmailPermitido: jest.fn().mockResolvedValue(undefined) }) as unknown as AccesoService;

  it('usa los claims del token cuando estan presentes (sin lookup miembro)', async () => {
    const tenant = tenantWith({ miembro: null });
    const acceso = accesoOk();
    const ctrl = new MeController(tenant, acceso);
    const user: AuthUser = { uid: 'u1', email: 'a@b.com', orgId: 'orgA', rol: 'admin' };
    const res = await ctrl.me(user);
    expect(res).toMatchObject({
      uid: 'u1',
      email: 'a@b.com',
      orgId: 'orgA',
      rol: 'admin',
      nombre: 'Dr Vet',
      telefono: '+57 300',
      organizacionNombre: 'Clínica Test',
    });
    expect(tenant.obtenerMiembro).not.toHaveBeenCalled();
    expect(tenant.asegurarPerfilVeterinario).toHaveBeenCalledWith('u1', { email: 'a@b.com' });
    expect(acceso.validarEmailPermitido).toHaveBeenCalledWith('a@b.com');
  });

  it('cae al doc de miembro si faltan claims', async () => {
    const tenant = tenantWith({ miembro: { orgId: 'orgB', rol: 'vet' }, perfil: { ...perfilBase, uid: 'u2', email: '' } });
    const ctrl = new MeController(tenant, accesoOk());
    const res = await ctrl.me({ uid: 'u2' });
    expect(res).toMatchObject({ uid: 'u2', orgId: 'orgB', rol: 'vet' });
    expect(tenant.obtenerMiembro).toHaveBeenCalledWith('u2');
  });

  it('devuelve role V2 admin_veterinaria con prioridad sobre rol legacy admin', async () => {
    const tenant = tenantWith({ miembro: null });
    const ctrl = new MeController(tenant, accesoOk());
    const user: AuthUser = {
      uid: 'adminVet',
      email: 'admin.veterinaria@x.com',
      orgId: 'orgA',
      rol: 'admin',
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      membershipId: 'm_admin_vet',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    };

    const res = await ctrl.me(user);

    expect(res).toMatchObject({
      uid: 'adminVet',
      rol: 'admin',
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      membershipId: 'm_admin_vet',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      organizacionNombre: 'Clínica Test',
      veterinariaNombre: 'Sede Norte',
    });
    expect(tenant.obtenerMiembro).not.toHaveBeenCalled();
  });

  it('PATCH actualiza solo campos permitidos del perfil propio', async () => {
    const perfilActualizado = { ...perfilBase, telefono: '999', veterinaria: 'Nueva' };
    const tenant = {
      obtenerMiembro: jest.fn().mockResolvedValue(null),
      obtenerMembershipV2: jest.fn().mockResolvedValue(null),
      asegurarPerfilVeterinario: jest.fn().mockResolvedValue(perfilBase),
      obtenerPerfilVeterinario: jest.fn().mockResolvedValue(perfilActualizado),
      actualizarPerfilVeterinario: jest.fn().mockResolvedValue(perfilActualizado),
      obtenerNombreOrganizacion: jest.fn().mockResolvedValue(null),
      obtenerNombreVeterinaria: jest.fn().mockResolvedValue(null),
    } as unknown as TenantService;
    const acceso = accesoOk();
    const ctrl = new MeController(tenant, acceso);
    const user: AuthUser = { uid: 'u1', email: 'a@b.com', orgId: 'orgA', rol: 'vet' };
    const res = await ctrl.actualizarPerfil(user, { telefono: '999', veterinaria: 'Nueva' });
    expect(tenant.actualizarPerfilVeterinario).toHaveBeenCalledWith('u1', {
      telefono: '999',
      veterinaria: 'Nueva',
    });
    expect(res.telefono).toBe('999');
    expect(res.veterinaria).toBe('Nueva');
  });
});
