import {
  puedeAccederDoc,
  puedeAccederBrigada,
  assertAccesoBrigada,
  particionTenant,
  assertAcceso,
  esSuperadmin,
  filtroTenantRuntime,
  scopeClinicoParaCrearV2,
} from '../../src/common/auth/access';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';
import { ForbiddenException } from '@nestjs/common';

// La misma logica de aislamiento que aplican las reglas, pero del lado de la API.
describe('access (aislamiento tenant)', () => {
  const conOrg: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };
  const legacy: AuthUser = { uid: 'u1' };
  const superadmin: AuthUser = { uid: 'root', rol: 'superadmin' };

  it('mismo tenant: permite', () => {
    expect(puedeAccederDoc(conOrg, { orgId: 'orgA' })).toBe(true);
  });

  it('otro tenant: niega', () => {
    expect(puedeAccederDoc(conOrg, { orgId: 'orgB' })).toBe(false);
  });

  it('usuario legacy (sin org) cae a veterinarioId == uid', () => {
    expect(puedeAccederDoc(legacy, { veterinarioId: 'u1' })).toBe(true);
    expect(puedeAccederDoc(legacy, { veterinarioId: 'otro' })).toBe(false);
  });

  it('legacy sin veterinarioId en el doc: niega', () => {
    expect(puedeAccederDoc(legacy, {})).toBe(false);
  });

  it('usuario con org pero doc sin orgId cae al fallback legacy', () => {
    expect(puedeAccederDoc(conOrg, { veterinarioId: 'u1' })).toBe(true);
    expect(puedeAccederDoc(conOrg, { veterinarioId: 'otro' })).toBe(false);
  });

  it('superadmin accede a cualquier tenant', () => {
    expect(esSuperadmin(superadmin)).toBe(true);
    expect(puedeAccederDoc(superadmin, { orgId: 'orgZ' })).toBe(true);
    expect(puedeAccederDoc(superadmin, {})).toBe(true);
  });

  it('esSuperadmin es false para otros roles', () => {
    expect(esSuperadmin(conOrg)).toBe(false);
    expect(esSuperadmin(legacy)).toBe(false);
  });

  it('assertAcceso lanza 403 cuando no hay acceso, no lanza cuando si', () => {
    expect(() => assertAcceso(conOrg, { orgId: 'orgB' })).toThrow(ForbiddenException);
    expect(() => assertAcceso(conOrg, { orgId: 'orgA' })).not.toThrow();
  });

  it('particionTenant prefiere orgId; si no, usa vet_<uid>', () => {
    expect(particionTenant(conOrg, { orgId: 'orgA' })).toBe('orgA');
    expect(particionTenant(legacy, { veterinarioId: 'u9' })).toBe('vet_u9');
    expect(particionTenant(legacy)).toBe('vet_u1');
  });

  it('particionTenant usa orgId del doc si el user no tiene', () => {
    expect(particionTenant(legacy, { orgId: 'orgX' })).toBe('orgX');
  });

  it('brigadas: mismo orgId permite; otro tenant niega', () => {
    expect(puedeAccederBrigada(conOrg, { orgId: 'orgA', veterinarioIds: ['u2'] })).toBe(true);
    expect(puedeAccederBrigada(conOrg, { orgId: 'orgB', veterinarioIds: ['u1'] })).toBe(false);
  });

  it('brigadas legacy: veterinarioIds incluye uid', () => {
    expect(puedeAccederBrigada(legacy, { veterinarioIds: ['u1', 'u2'] })).toBe(true);
    expect(() => assertAccesoBrigada(legacy, { veterinarioIds: ['u9'] })).toThrow(ForbiddenException);
  });

  describe('runtime V2 compatible', () => {
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

    const vetIndependiente: AuthUserV2 = {
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

    it('resuelve filtro V2 y conserva fallback orgId legacy', () => {
      expect(filtroTenantRuntime(adminEntidad)).toEqual({ entidadId: 'entA', orgId: 'orgA' });
      expect(filtroTenantRuntime(adminVeterinaria)).toEqual({
        veterinariaId: 'vetA',
        accountId: 'vetA',
        orgId: 'orgA',
      });
      expect(filtroTenantRuntime(conOrg)).toEqual({ orgId: 'orgA' });
    });

    it('admin_entidad V2 no cruza entidad aunque orgId legacy coincida', () => {
      expect(
        puedeAccederDoc(adminEntidad, {
          orgId: 'orgA',
          accountType: 'veterinaria',
          accountId: 'vetB',
          entidadId: 'entB',
          veterinariaId: 'vetB',
        }),
      ).toBe(false);
    });

    it('admin_veterinaria V2 no cruza sede hermana', () => {
      expect(
        puedeAccederDoc(adminVeterinaria, {
          orgId: 'orgA',
          accountType: 'veterinaria',
          accountId: 'vetB',
          entidadId: 'entA',
          veterinariaId: 'vetB',
        }),
      ).toBe(false);
    });

    it('vet independiente V2 usa accountId vet_uid para particion y escritura', () => {
      expect(particionTenant(vetIndependiente)).toBe('vet_vet-ind');
      expect(scopeClinicoParaCrearV2(vetIndependiente)).toMatchObject({
        accountType: 'vet_individual',
        accountId: 'vet_vet-ind',
        planOwnerType: 'vet',
        planOwnerId: 'vet_vet-ind',
        membershipId: 'm-vet-ind',
      });
    });

    it('superadmin V2 no pasa por rutas tenant normales sin intencion explicita', () => {
      const superadminV2: AuthUserV2 = { uid: 'root', rol: 'superadmin', v: 2, role: 'superadmin' };
      expect(
        puedeAccederDoc(superadminV2, {
          orgId: 'orgA',
          accountType: 'veterinaria',
          accountId: 'vetA',
          entidadId: 'entA',
          veterinariaId: 'vetA',
        }),
      ).toBe(false);
      expect(() => filtroTenantRuntime(superadminV2)).toThrow(ForbiddenException);
    });
  });
});
