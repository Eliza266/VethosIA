import { describe, it, expect } from 'vitest';
import {
  MENSAJE_SIN_PERMISO_APROBAR,
  MENSAJE_SIN_PERMISO_ELIMINAR,
  ROLES_CANONICOS,
  esVeterinarioIndependiente,
  esVeterinarioVinculado,
  modulosInicioPorRol,
  modulosInicioPorProfile,
  navItemsForProfile,
  navItemsForRole,
  nivelAcceso,
  normalizarRol,
  puedeAprobar,
  puedeEliminar,
  puedeGestionarSuscripcion,
  puedeVerSuscripcion,
  puedeVerModulo,
  rolLabel,
} from './rbac';

describe('rbac (matriz de modulos por rol)', () => {
  it('R121: roles canonicos humanos coinciden con el PDF', () => {
    expect(ROLES_CANONICOS).toEqual([
      'superadmin',
      'admin_entidad',
      'admin_veterinaria',
      'veterinario',
    ]);
    expect(ROLES_CANONICOS).not.toContain('asistente');
    expect(ROLES_CANONICOS).not.toContain('sistema');
    expect(normalizarRol('sistema' as never)).toBeNull();
  });

  it('vet NO ve entidades/veterinarios/planes/configuracion (restringido)', () => {
    expect(puedeVerModulo('entidades', 'vet')).toBe(false);
    expect(puedeVerModulo('veterinarios', 'vet')).toBe(false);
    expect(puedeVerModulo('planes', 'vet')).toBe(false);
    expect(puedeVerModulo('configuracion', 'vet')).toBe(false);
  });

  it('vet SI ve pacientes/consultaIA/pdf/agenda/brigadas/vacunas/metricas/notificaciones', () => {
    for (const m of ['pacientes', 'consultaIA', 'pdf', 'agenda', 'brigadas', 'vacunas', 'metricas', 'notificaciones'] as const) {
      expect(puedeVerModulo(m, 'vet')).toBe(true);
    }
  });

  it('admin legacy ve veterinarios y planes y entidades', () => {
    expect(puedeVerModulo('veterinarios', 'admin')).toBe(true);
    expect(puedeVerModulo('planes', 'admin')).toBe(true);
    expect(puedeVerModulo('entidades', 'admin')).toBe(true);
  });

  it('superadmin ve soporte, auditoria y configuracion', () => {
    expect(puedeVerModulo('soporte', 'superadmin')).toBe(true);
    expect(puedeVerModulo('auditoria', 'superadmin')).toBe(true);
    expect(puedeVerModulo('configuracion', 'superadmin')).toBe(true);
  });

  it('sin rol no ve nada', () => {
    expect(puedeVerModulo('pacientes', null)).toBe(false);
  });

  it('niveles correctos para auditoria', () => {
    expect(nivelAcceso('auditoria', 'superadmin')).toBe('total');
    expect(nivelAcceso('auditoria', 'admin')).toBe('parcial');
    expect(nivelAcceso('auditoria', 'vet')).toBe('limitado');
  });

  it('rolLabel legible y compatible con legacy', () => {
    expect(rolLabel('superadmin')).toBe('Super Admin');
    expect(rolLabel('admin')).toBe('Admin Entidad');
    expect(rolLabel('admin_entidad')).toBe('Admin Entidad');
    expect(rolLabel('admin_veterinaria')).toBe('Admin Veterinaria');
    expect(rolLabel('vet')).toBe('Veterinario');
    expect(rolLabel('veterinario')).toBe('Veterinario');
    expect(rolLabel('asistente')).toBe('Rol legacy');
    expect(rolLabel(null)).toBe('Invitado');
  });

  it('normaliza roles legacy hacia roles V2 visibles', () => {
    expect(normalizarRol('admin')).toBe('admin_entidad');
    expect(normalizarRol('vet')).toBe('veterinario');
    expect(normalizarRol('admin_veterinaria')).toBe('admin_veterinaria');
    expect(normalizarRol('asistente')).toBeNull();
  });

  it('admin_entidad y admin_veterinaria tienen modulos separados', () => {
    expect(puedeVerModulo('entidades', 'admin_entidad')).toBe(true);
    expect(puedeVerModulo('entidades', 'admin_veterinaria')).toBe(false);
    expect(puedeVerModulo('veterinarias', 'admin_entidad')).toBe(true);
    expect(puedeVerModulo('veterinarias', 'admin_veterinaria')).toBe(true);
  });

  it('R123: asistente legacy no ve modulos V2', () => {
    expect(puedeVerModulo('entidades', 'asistente')).toBe(false);
    expect(puedeVerModulo('pacientes', 'asistente')).toBe(false);
    expect(navItemsForRole('asistente')).toEqual([]);
  });

  it('puedeEliminar: solo roles clinicos operativos si; admin entidad/superadmin/asistente no', () => {
    expect(puedeEliminar('admin')).toBe(false);
    expect(puedeEliminar('admin_entidad')).toBe(false);
    expect(puedeEliminar('admin_veterinaria')).toBe(true);
    expect(puedeEliminar('vet')).toBe(true);
    expect(puedeEliminar('veterinario')).toBe(true);
    expect(puedeEliminar('superadmin')).toBe(false);
    expect(puedeEliminar('asistente')).toBe(false);
    expect(puedeEliminar(null)).toBe(false);
    expect(
      puedeEliminar({
        role: 'admin_veterinaria',
        rol: 'admin',
        veterinariaId: 'vetclin_1',
      }),
    ).toBe(true);
    expect(puedeEliminar({ role: 'admin_veterinaria', rol: 'admin' })).toBe(false);
    expect(MENSAJE_SIN_PERMISO_ELIMINAR).toBe('Tu rol no permite eliminar registros.');
  });

  it('puedeAprobar: solo veterinario/admin veterinaria si; admin entidad/superadmin/asistente no', () => {
    expect(puedeAprobar('admin')).toBe(false);
    expect(puedeAprobar('vet')).toBe(true);
    expect(puedeAprobar('veterinario')).toBe(true);
    expect(puedeAprobar('admin_veterinaria')).toBe(true);
    expect(puedeAprobar('superadmin')).toBe(false);
    expect(puedeAprobar('admin_entidad')).toBe(false);
    expect(puedeAprobar('asistente')).toBe(false);
    expect(puedeAprobar(null)).toBe(false);
    expect(
      puedeAprobar({
        role: 'admin_veterinaria',
        rol: 'admin',
        veterinariaId: 'vetclin_1',
      }),
    ).toBe(true);
    expect(puedeAprobar({ role: 'admin_veterinaria', rol: 'admin' })).toBe(false);
    expect(MENSAJE_SIN_PERMISO_APROBAR).toContain('aprobar historias');
  });

  it('navItemsForRole muestra soporte solo para superadmin', () => {
    const superadminItems = navItemsForRole('superadmin').map((i) => i.id);
    expect(superadminItems).toContain('soporte');
    expect(superadminItems).not.toContain('entidad');
    expect(navItemsForRole('admin_entidad').map((i) => i.id)).not.toContain('soporte');
  });

  it('distingue veterinario vinculado de veterinario independiente para suscripcion', () => {
    const vetVinculado = { rol: 'vet' as const, orgId: 'iVQURlMlESO5af6hbQ8I' };
    const vetFreelanceEntidad = { rol: 'veterinario' as const, entidadId: 'ent_1', planOwnerType: 'entidad' };
    const vetIndependienteLegacy = { rol: 'vet' as const, orgId: null };
    const vetIndependienteV2 = {
      rol: 'veterinario' as const,
      accountType: 'vet_individual' as const,
      planOwnerType: 'vet' as const,
      planOwnerId: 'vet_u1',
    };

    expect(esVeterinarioVinculado(vetVinculado)).toBe(true);
    expect(esVeterinarioVinculado(vetFreelanceEntidad)).toBe(true);
    expect(esVeterinarioIndependiente(vetIndependienteLegacy)).toBe(true);
    expect(esVeterinarioIndependiente(vetIndependienteV2)).toBe(true);
    expect(puedeGestionarSuscripcion(vetVinculado)).toBe(false);
    expect(puedeGestionarSuscripcion(vetFreelanceEntidad)).toBe(false);
    expect(puedeGestionarSuscripcion(vetIndependienteLegacy)).toBe(true);
    expect(puedeGestionarSuscripcion(vetIndependienteV2)).toBe(true);
    expect(puedeGestionarSuscripcion({ rol: 'admin_entidad' })).toBe(true);
    expect(
      puedeGestionarSuscripcion({
        rol: 'admin_veterinaria',
        veterinariaId: 'vetclin_1',
        planOwnerType: 'veterinaria',
        planOwnerId: 'vetclin_1',
      }),
    ).toBe(true);
    expect(
      puedeGestionarSuscripcion({
        role: 'admin_veterinaria',
        rol: 'admin',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      }),
    ).toBe(false);
    expect(
      puedeVerSuscripcion({
        role: 'admin_veterinaria',
        rol: 'admin',
        veterinariaId: 'vetclin_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      }),
    ).toBe(true);
    expect(puedeGestionarSuscripcion({ rol: 'superadmin' })).toBe(false);
    expect(puedeGestionarSuscripcion({ rol: 'asistente' })).toBe(false);
  });

  it('nav y modulos respetan scope V2 y no degradan admin_veterinaria a entidad', () => {
    const vetVinculado = { rol: 'vet' as const, orgId: 'org_legacy' };
    const vetIndependiente = { rol: 'vet' as const, orgId: null };
    const adminVetHeredado = {
      role: 'admin_veterinaria' as const,
      rol: 'admin' as const,
      orgId: 'org_legacy',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad' as const,
      planOwnerId: 'ent_1',
    };

    // Un veterinario vinculado ve la suscripcion en modo solo lectura (plan de su equipo).
    expect(navItemsForProfile(vetVinculado).map((i) => i.id)).toContain('suscripcion');
    expect(modulosInicioPorProfile(vetVinculado).map((i) => i.id)).toContain('suscripcion');
    expect(navItemsForProfile(vetIndependiente).map((i) => i.id)).toContain('suscripcion');
    expect(modulosInicioPorProfile(vetIndependiente).map((i) => i.id)).toContain('suscripcion');
    expect(navItemsForProfile(adminVetHeredado).map((i) => i.id)).toEqual(
      expect.arrayContaining(['dashboard', 'veterinarias', 'pacientes', 'agenda', 'suscripcion']),
    );
    expect(navItemsForProfile(adminVetHeredado).map((i) => i.id)).not.toContain('entidad');
    expect(modulosInicioPorProfile(adminVetHeredado).map((i) => i.id)).not.toContain('entidad');
  });

  it('admin_entidad ve brigadas operativas sin abrir rutas clinicas completas', () => {
    const ids = navItemsForRole('admin_entidad').map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['dashboard', 'entidad', 'sedes-entidad', 'brigadas', 'suscripcion']));
    expect(ids).not.toContain('veterinarias');
    expect(ids).not.toContain('agenda');
    expect(ids).not.toContain('vacunas');
    expect(ids).not.toContain('pacientes');
  });

  it('modulosInicioPorRol separa dashboards por rol', () => {
    expect(modulosInicioPorRol('admin_entidad').map((i) => i.id)).toEqual(
      expect.arrayContaining(['entidad', 'sedes-entidad', 'brigadas', 'suscripcion']),
    );
    expect(modulosInicioPorRol('admin_entidad').map((i) => i.id)).not.toContain('veterinarias');
    expect(modulosInicioPorRol('admin_entidad').map((i) => i.id)).not.toContain('agenda');
    expect(modulosInicioPorRol('admin_entidad').map((i) => i.id)).not.toContain('vacunas');
    expect(modulosInicioPorRol('admin_veterinaria').map((i) => i.id)).toEqual(
      expect.arrayContaining(['veterinarias', 'pacientes', 'nueva-consulta', 'suscripcion']),
    );
    expect(modulosInicioPorRol('asistente')).toEqual([]);
  });

  it('nueva-consulta lleva directo a grabar consulta', () => {
    const modulo = modulosInicioPorRol('admin_veterinaria').find((m) => m.id === 'nueva-consulta');
    expect(modulo?.label).toBe('Nueva consulta');
    expect(modulo?.path).toBe('/consultas/nueva-rapida');
  });
});
