import { BadRequestException, ConflictException } from '@nestjs/common';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { FirebaseService } from '../../src/common/firebase/firebase.service';

// Fake firebase para tenant: miembros doc + auth claims.
function build(miembroExistente: Record<string, unknown> | null) {
  const claims: Record<string, unknown> = {};
  const store = new Map<string, Record<string, unknown>>();
  if (miembroExistente) store.set('miembros/u1', miembroExistente);

  const docApi = (col: string, id: string) => ({
    get: async () => ({ exists: store.has(`${col}/${id}`), data: () => store.get(`${col}/${id}`) }),
    set: async (data: Record<string, unknown>) => {
      store.set(`${col}/${id}`, { ...(store.get(`${col}/${id}`) ?? {}), ...data });
    },
    id,
  });

  const firestore = {
    collection: (col: string) => ({
      doc: (id?: string) => docApi(col, id ?? 'org_generada'),
    }),
  };
  const auth = {
    getUser: jest.fn(async () => ({ customClaims: claims })),
    setCustomUserClaims: jest.fn(async (_uid: string, c: Record<string, unknown>) => {
      Object.assign(claims, c);
    }),
  };
  const fb = { firestore, auth } as unknown as FirebaseService;
  const notificaciones = { crear: jest.fn().mockResolvedValue({ id: 'n' }) } as never;
  return { svc: new TenantService(fb, notificaciones), auth, claims, store };
}

describe('TenantService.crearOrganizacion (anti-pisado de claims)', () => {
  it('crea org cuando el usuario NO pertenece a ninguna', async () => {
    const { svc, auth } = build(null);
    const res = await svc.crearOrganizacion({ nombre: 'Clinica X' }, 'u1');
    expect(res.orgId).toBeTruthy();
    expect(auth.setCustomUserClaims).toHaveBeenCalled();
  });

  it('rechaza si el usuario YA pertenece a una org (no pisa sus claims)', async () => {
    const { svc, auth } = build({ orgId: 'orgPrevia', rol: 'vet' });
    await expect(svc.crearOrganizacion({ nombre: 'Otra' }, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('R123: no permite crear nuevos miembros con rol legacy asistente', async () => {
    const { svc, auth } = build(null);
    await expect(svc.asignarMiembro('orgA', 'u2', 'asistente')).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('crea veterinaria V2 con plan propio o heredado sin tocar produccion', async () => {
    const { svc, store } = build(null);
    const vet = await svc.upsertVeterinaria({
      veterinariaId: 'vetclin_1',
      nombre: 'Sede Norte',
      legacyOrgId: 'org_legacy',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    expect(vet).toMatchObject({
      id: 'vetclin_1',
      nombre: 'Sede Norte',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });
    expect(store.get('veterinarias/vetclin_1')).toMatchObject({
      legacyOrgId: 'org_legacy',
      entidadId: 'ent_1',
    });
  });

  it('asignarMiembroV2 persiste admin_veterinaria sin degradarlo a admin_entidad', async () => {
    const { svc, auth, claims, store } = build(null);
    const res = await svc.asignarMiembroV2({
      uid: 'adminVet',
      email: 'admin.veterinaria@x.com',
      orgId: 'org_legacy',
      rol: 'admin',
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      membershipId: 'm_adminVet',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
      vinculoTipo: 'owner',
    });

    expect(res).toMatchObject({
      rol: 'admin',
      role: 'admin_veterinaria',
      veterinariaId: 'vetclin_1',
      membershipId: 'm_adminVet',
    });
    expect(store.get('miembros/m_adminVet')).toMatchObject({
      role: 'admin_veterinaria',
      rol: 'admin',
      accountId: 'vetclin_1',
    });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      'adminVet',
      expect.objectContaining({
        rol: 'admin',
        role: 'admin_veterinaria',
        veterinariaId: 'vetclin_1',
        planOwnerType: 'veterinaria',
        planOwnerId: 'vetclin_1',
      }),
    );
    expect(claims).toMatchObject({ role: 'admin_veterinaria', rol: 'admin' });
  });
});
