import { describe, expect, it } from 'vitest';
import {
  canAccessBrigadas,
  canAccessClinicalRoutes,
  canAccessModule,
  canAccessPath,
  getDashboardModulesForProfile,
  getDeniedRedirectPath,
  getModuleStatusLabel,
  getNavbarItemsForProfile,
  getRoleHomePath,
} from './roleNavigation';

describe('roleNavigation', () => {
  it('renders veterinario clinical navigation without admin or superadmin paths', () => {
    const profile = { rol: 'vet' as const, orgId: 'org_legacy' };
    const ids = getNavbarItemsForProfile(profile).map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(['dashboard', 'pacientes', 'agenda', 'vacunas', 'brigadas']),
    );
    expect(ids).not.toContain('entidad');
    expect(ids).not.toContain('veterinarias');
    expect(ids).not.toContain('soporte');
    expect(canAccessClinicalRoutes(profile)).toBe(true);
    expect(canAccessPath(profile, '/pacientes/p1/consultas/c1')).toBe(true);
    expect(canAccessPath(profile, '/entidad')).toBe(false);
    expect(canAccessPath(profile, '/admin')).toBe(false);
  });

  it('gives linked veterinario read-only subscription access and independent veterinario full access', () => {
    const linked = { rol: 'vet' as const, orgId: 'org_legacy' };
    const independent = {
      rol: 'veterinario' as const,
      accountType: 'vet_individual' as const,
      planOwnerType: 'vet' as const,
      planOwnerId: 'vet1',
    };

    expect(getNavbarItemsForProfile(linked).map((item) => item.id)).toContain('suscripcion');
    expect(getDashboardModulesForProfile(linked).map((item) => item.id)).toContain('suscripcion');
    expect(canAccessPath(linked, '/suscripcion')).toBe(true);
    expect(getNavbarItemsForProfile(independent).map((item) => item.id)).toContain(
      'suscripcion',
    );
    expect(canAccessPath(independent, '/suscripcion')).toBe(true);
  });

  it('routes admin_veterinaria to sede capabilities and blocks entidad/superadmin', () => {
    const profile = {
      role: 'admin_veterinaria' as const,
      rol: 'admin' as const,
      veterinariaId: 'vetA',
      entidadId: 'entA',
    };
    
    // Test admin mode (default)
    const adminIds = getNavbarItemsForProfile(profile).map((item) => item.id);
    expect(adminIds).toEqual(
      expect.arrayContaining(['dashboard', 'nueva-consulta', 'veterinarias']),
    );
    expect(adminIds).not.toContain('metricas');
    expect(adminIds).not.toContain('pacientes');

    // Test veterinario mode
    const vetIds = getNavbarItemsForProfile(profile, 'veterinario').map((item) => item.id);
    expect(vetIds).toEqual(
      expect.arrayContaining(['dashboard', 'pacientes', 'agenda', 'vacunas', 'brigadas']),
    );
    expect(vetIds).not.toContain('veterinarias');

    expect(canAccessModule(profile, 'veterinarias')).toBe(true);
    expect(canAccessClinicalRoutes(profile)).toBe(true);
    expect(canAccessPath(profile, '/veterinaria')).toBe(true);
    expect(canAccessPath(profile, '/entidad')).toBe(false);
    expect(canAccessPath(profile, '/admin')).toBe(false);
  });

  it('routes admin_entidad to multi-sede capabilities and blocks clinical tenant flows', () => {
    const profile = { role: 'admin_entidad' as const, rol: 'admin' as const, entidadId: 'entA' };

    expect(getRoleHomePath(profile)).toBe('/entidad');
    expect(canAccessModule(profile, 'entidad')).toBe(true);
    expect(canAccessBrigadas(profile)).toBe(true);
    expect(canAccessClinicalRoutes(profile)).toBe(false);
    expect(canAccessPath(profile, '/entidad')).toBe(true);
    expect(canAccessPath(profile, '/brigadas')).toBe(true);
    expect(canAccessPath(profile, '/pacientes')).toBe(false);
    expect(getDeniedRedirectPath(profile)).toBe('/entidad');
  });

  it('routes superadmin to platform capabilities and blocks tenant clinical routes', () => {
    const profile = { role: 'superadmin' as const, rol: 'superadmin' as const };

    expect(getRoleHomePath(profile)).toBe('/admin');
    expect(canAccessModule(profile, 'soporte')).toBe(true);
    expect(canAccessPath(profile, '/admin')).toBe(true);
    expect(canAccessPath(profile, '/planes')).toBe(true);
    expect(canAccessPath(profile, '/pacientes')).toBe(false);
    expect(canAccessBrigadas(profile)).toBe(false);
    expect(getDeniedRedirectPath(profile)).toBe('/admin');
  });

  it('exposes professional labels for pending and configurable modules', () => {
    const adminEntidadModules = getDashboardModulesForProfile({ rol: 'admin_entidad' });
    const cobertura = adminEntidadModules.find((module) => module.id === 'cobertura-territorial');
    expect(cobertura).toBeTruthy();
    expect(cobertura ? getModuleStatusLabel(cobertura) : '').toBe('Configuración pendiente');

    const superModules = getDashboardModulesForProfile({ rol: 'superadmin' });
    const planes = superModules.find((module) => module.id === 'planes-globales');
    expect(planes ? getModuleStatusLabel(planes) : '').toBe('Gestión centralizada');
  });
});
