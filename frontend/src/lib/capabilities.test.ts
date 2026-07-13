import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_CAPABILITY,
  MODULE_STATUS_LABEL,
  ROLE_CAPABILITY_MODULES,
  capabilitiesForRole,
  dashboardCapabilitiesForRole,
  findCapabilityModule,
  navbarCapabilitiesForRole,
} from './capabilities';

describe('capabilities central matrix', () => {
  it('defines the required metadata for every public module', () => {
    for (const module of ROLE_CAPABILITY_MODULES) {
      expect(module.id).toBeTruthy();
      expect(module.label).toBeTruthy();
      expect(module.description).toBeTruthy();
      expect(module.path).toMatch(/^\//);
      expect(module.roles.length).toBeGreaterThan(0);
      expect(MODULE_STATUS_LABEL[module.status]).toBeTruthy();
      expect(module.priority).toBeGreaterThanOrEqual(0);
      expect(typeof module.showInNavbar).toBe('boolean');
      expect(typeof module.showInDashboard).toBe('boolean');
      expect(typeof module.requiresTenant).toBe('boolean');
    }
  });

  it('veterinario receives clinical capabilities and no admin/global modules', () => {
    const ids = dashboardCapabilitiesForRole('veterinario').map((module) => module.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'pacientes',
        'agenda',
        'vacunas',
        'brigadas',
        'nueva-consulta',
        'consulta-soap',
        'pdf-clinico',
        'email-demo',
        'whatsapp-link',
      ]),
    );
    expect(ids).not.toContain('entidad');
    expect(ids).not.toContain('veterinarias-global');
    expect(ids).not.toContain('soporte');
  });

  it('admin_veterinaria receives sede operations without entidad or superadmin modules', () => {
    const ids = dashboardCapabilitiesForRole('admin_veterinaria').map((module) => module.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'veterinarias',
        'equipo-clinico',
        'pacientes',
        'agenda',
        'vacunas',
        'brigadas',
        'nueva-consulta',
        'suscripcion',
      ]),
    );
    expect(ids).not.toContain('entidad');
    expect(ids).not.toContain('soporte');
  });

  it('admin_entidad receives multi-sede capabilities and pending coverage without superadmin', () => {
    const modules = dashboardCapabilitiesForRole('admin_entidad');
    const ids = modules.map((module) => module.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'entidad',
        'sedes-entidad',
        'veterinarios-por-sede',
        'freelancers-entidad',
        'brigadas',
        'consumo-entidad',
        'cobertura-territorial',
      ]),
    );
    expect(findCapabilityModule('cobertura-territorial')?.status).toBe('pending');
    expect(ids).not.toContain('metricas-entidad');
    expect(ids).not.toContain('soporte');
    expect(ids).not.toContain('veterinarias');
  });

  it('superadmin receives platform/global capabilities and no tenant clinical flow', () => {
    const ids = dashboardCapabilitiesForRole('superadmin').map((module) => module.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'soporte',
        'entidades-global',
        'veterinarias-global',
        'usuarios-miembros',
        'planes-globales',
        'suscripciones-globales',
        'auditoria-global',
        'configuracion-global',
      ]),
    );
    expect(ids).not.toContain('pacientes');
    expect(ids).not.toContain('nueva-consulta');
    expect(ids).not.toContain('brigadas');
  });

  it('keeps sistema/jobs hidden from public navigation', () => {
    expect(findCapabilityModule('sistema-jobs')?.status).toBe('hidden');
    expect(navbarCapabilitiesForRole('superadmin').map((module) => module.id)).not.toContain(
      'sistema-jobs',
    );
    expect(capabilitiesForRole('superadmin').map((module) => module.id)).toContain(
      'sistema-jobs',
    );
  });

  it('uses the dashboard capability as the first navbar item', () => {
    expect(navbarCapabilitiesForRole('admin_entidad')[0]).toEqual(DASHBOARD_CAPABILITY);
  });
});
