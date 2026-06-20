import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { COLLECTIONS } from '../../src/common/firebase/collections';
import { AuditoriaService } from '../../src/modules/plataforma/auditoria.service';
import { NotificacionesService } from '../../src/modules/plataforma/notificaciones.service';
import { BackofficeService } from '../../src/modules/tenant/backoffice.service';
import {
  ActualizarEntidadBackofficeDto,
  ActualizarVeterinariaBackofficeDto,
  CrearEntidadBackofficeDto,
  CrearVeterinariaBackofficeDto,
} from '../../src/modules/tenant/dto/backoffice.dto';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { fakeFirebase } from './saas.fakes';

const adminEntidad: AuthUser = {
  uid: 'adminEnt',
  email: 'admin.entidad@x.com',
  orgId: 'orgA',
  rol: 'admin',
  role: 'admin_entidad',
  accountType: 'entidad',
  accountId: 'ent_1',
  entidadId: 'ent_1',
  planOwnerType: 'entidad',
  planOwnerId: 'ent_1',
};

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

const superadmin: AuthUser = {
  uid: 'root',
  email: 'root@vetia.test',
  rol: 'superadmin',
  role: 'superadmin',
};

const veterinario: AuthUser = {
  uid: 'vet1',
  email: 'vet1@x.com',
  orgId: 'orgA',
  rol: 'vet',
  role: 'veterinario',
  accountType: 'veterinaria',
  accountId: 'vetclin_1',
  entidadId: 'ent_1',
  veterinariaId: 'vetclin_1',
  planOwnerType: 'entidad',
  planOwnerId: 'ent_1',
};

function build() {
  const { fb, fs } = fakeFirebase();
  const auth = {
    getUser: jest.fn(async () => ({ customClaims: {} })),
    setCustomUserClaims: jest.fn(async () => undefined),
    updateUser: jest.fn(async () => undefined),
  };
  (fb as unknown as { auth: typeof auth }).auth = auth;

  fs.store.set(`${COLLECTIONS.entidades}/ent_1`, {
    nombre: 'Entidad Norte',
    tipo: 'cadena',
    direccion: 'Avenida 1 #10-20',
    ciudad: 'Bogota',
    pais: 'Colombia',
    telefono: '+57 300 100 2000',
    emailContacto: 'contacto@entidadnorte.com',
    logoUrl: 'https://cdn.test/entidad-norte.png',
    estado: 'activa',
    planOwnerId: 'ent_1',
  });
  fs.store.set(`${COLLECTIONS.entidades}/ent_2`, {
    nombre: 'Entidad Sur',
    estado: 'activa',
    planOwnerId: 'ent_2',
  });
  fs.store.set(`${COLLECTIONS.veterinarias}/vetclin_1`, {
    nombre: 'Clinica Norte',
    direccion: 'Calle 1 #2-3',
    ciudad: 'Bogota',
    pais: 'Colombia',
    telefono: '+57 300 111 2233',
    emailContacto: 'contacto@clinicanorte.com',
    logoUrl: 'https://cdn.test/clinica-norte.png',
    orgId: 'orgA',
    legacyOrgId: 'orgA',
    entidadId: 'ent_1',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_1',
    accountId: 'vetclin_1',
    estado: 'activa',
  });
  fs.store.set(`${COLLECTIONS.veterinarias}/vetclin_2`, {
    nombre: 'Clinica Sur',
    orgId: 'orgB',
    legacyOrgId: 'orgB',
    entidadId: 'ent_2',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_2',
    accountId: 'vetclin_2',
    estado: 'activa',
  });
  fs.store.set(`${COLLECTIONS.miembros}/m_admin_ent`, {
    uid: 'adminEnt',
    email: 'admin.entidad@x.com',
    orgId: 'orgA',
    rol: 'admin',
    role: 'admin_entidad',
    accountType: 'entidad',
    accountId: 'ent_1',
    entidadId: 'ent_1',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_1',
    estado: 'activo',
  });
  fs.store.set(`${COLLECTIONS.miembros}/m_admin_vet`, {
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
    estado: 'activo',
  });
  fs.store.set(`${COLLECTIONS.miembros}/m_vet1`, {
    uid: 'vet1',
    email: 'vet1@x.com',
    orgId: 'orgA',
    rol: 'vet',
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: 'vetclin_1',
    entidadId: 'ent_1',
    veterinariaId: 'vetclin_1',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_1',
    estado: 'activo',
  });
  fs.store.set(`${COLLECTIONS.miembros}/m_vet2`, {
    uid: 'vet2',
    email: 'vet2@x.com',
    orgId: 'orgB',
    rol: 'vet',
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: 'vetclin_2',
    entidadId: 'ent_2',
    veterinariaId: 'vetclin_2',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_2',
    estado: 'activo',
  });
  fs.store.set(`${COLLECTIONS.miembros}/m_root`, {
    uid: 'root',
    email: 'root@vetia.test',
    rol: 'superadmin',
    role: 'superadmin',
    estado: 'activo',
  });
  fs.store.set(`${COLLECTIONS.consumos}/vet1_2026-06`, {
    scopeId: 'vet1',
    orgId: 'orgA',
    entidadId: 'ent_1',
    veterinariaId: 'vetclin_1',
    veterinarioId: 'vet1',
    periodo: '2026-06',
    usados: 8,
    limite: 10,
  });
  fs.store.set(`${COLLECTIONS.consumos}/vet2_2026-06`, {
    scopeId: 'vet2',
    orgId: 'orgB',
    entidadId: 'ent_2',
    veterinariaId: 'vetclin_2',
    veterinarioId: 'vet2',
    periodo: '2026-06',
    usados: 3,
    limite: 10,
  });
  fs.store.set(`${COLLECTIONS.suscripciones}/sub_ent_1`, {
    entidadId: 'ent_1',
    orgId: 'orgA',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_1',
    planId: 'plan_pro',
    estado: 'activa',
  });
  fs.store.set(`${COLLECTIONS.suscripciones}/sub_ent_2`, {
    entidadId: 'ent_2',
    orgId: 'orgB',
    planOwnerType: 'entidad',
    planOwnerId: 'ent_2',
    planId: 'plan_enterprise',
    estado: 'activa',
  });
  fs.store.set(`${COLLECTIONS.auditoria}/logA`, {
    accion: 'miembro.desactivar',
    actorUid: 'adminVet',
    orgId: 'orgA',
  });
  fs.store.set(`${COLLECTIONS.auditoria}/logB`, {
    accion: 'veterinaria.editar',
    actorUid: 'adminB',
    orgId: 'orgB',
  });

  const notificaciones = new NotificacionesService(fb);
  const auditoria = new AuditoriaService(fb);
  const tenant = new TenantService(fb, notificaciones);
  const svc = new BackofficeService(fb, tenant, auditoria, notificaciones);
  return { svc, fs, auth };
}

describe('BackofficeService', () => {
  it('admin veterinaria ve solo su clinica y su equipo', async () => {
    const { svc } = build();

    await expect(svc.listarVeterinarias(adminVeterinaria)).resolves.toEqual([
      expect.objectContaining({ id: 'vetclin_1' }),
    ]);
    await expect(svc.listarMiembros(adminVeterinaria)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'm_admin_vet' }),
        expect.objectContaining({ id: 'm_vet1' }),
      ]),
    );
    const miembros = await svc.listarMiembros(adminVeterinaria);
    expect(miembros.map((m) => m.id)).not.toContain('m_vet2');
  });

  it('admin entidad ve solo su cadena', async () => {
    const { svc } = build();

    await expect(svc.listarVeterinarias(adminEntidad)).resolves.toEqual([
      expect.objectContaining({ id: 'vetclin_1' }),
    ]);
    const miembros = await svc.listarMiembros(adminEntidad);
    expect(miembros.map((m) => m.id).sort()).toEqual(['m_admin_ent', 'm_admin_vet', 'm_vet1']);
    expect(await svc.listarConsumos(adminEntidad)).toEqual([
      expect.objectContaining({ id: 'vet1_2026-06', porcentaje: 80 }),
    ]);
  });

  it('superadmin ve alcance global', async () => {
    const { svc } = build();

    expect(await svc.listarEntidades(superadmin)).toHaveLength(2);
    expect(await svc.listarVeterinarias(superadmin)).toHaveLength(2);
    expect(await svc.listarVeterinarios(superadmin)).toHaveLength(2);
    expect(await svc.listarMiembros(superadmin)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'm_admin_ent' }),
        expect.objectContaining({ id: 'm_admin_vet' }),
        expect.objectContaining({ id: 'm_vet1' }),
        expect.objectContaining({ id: 'm_vet2' }),
        expect.objectContaining({ id: 'm_root' }),
      ]),
    );
    expect(await svc.listarConsumos(superadmin)).toHaveLength(2);
    expect(await svc.listarSuscripciones(superadmin)).toHaveLength(2);
    expect(await svc.listarAuditoria(superadmin)).toHaveLength(2);
    await expect(svc.listarAuditoria(adminEntidad)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('superadmin crea entidad global sin usuarios, claims ni suscripciones', async () => {
    const { svc, fs, auth } = build();

    const creada = await svc.crearEntidadGlobal(superadmin, {
      nombre: 'Entidad Centro',
      tipo: 'ong',
      direccion: 'Calle 50 #10-20',
      ciudad: 'Cali',
      pais: 'Colombia',
      telefono: '+57 300 555 6677',
      emailContacto: 'centro@entidad.test',
      logoUrl: 'https://cdn.test/centro.png',
      estado: 'activa',
    });

    expect(creada).toMatchObject({
      nombre: 'Entidad Centro',
      tipo: 'ong',
      direccion: 'Calle 50 #10-20',
      ciudad: 'Cali',
      pais: 'Colombia',
      telefono: '+57 300 555 6677',
      emailContacto: 'centro@entidad.test',
      logoUrl: 'https://cdn.test/centro.png',
      estado: 'activa',
      planOwnerType: 'entidad',
      planOwnerId: creada.id,
    });
    expect(fs.store.get(`${COLLECTIONS.entidades}/${creada.id}`)).toMatchObject({
      nombre: 'Entidad Centro',
      planOwnerId: creada.id,
    });
    expect([...fs.store.values()].some((v) => v.accion === 'entidad.crear' && v.recurso === creada.id)).toBe(true);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect([...fs.store.keys()].filter((k) => k.startsWith(`${COLLECTIONS.suscripciones}/`))).toHaveLength(2);
  });

  it('superadmin edita entidad global existente', async () => {
    const { svc, fs } = build();

    await expect(
      svc.actualizarEntidadGlobal(superadmin, 'ent_1', {
        nombre: 'Entidad Norte Global',
        tipo: 'gobierno',
        ciudad: 'Medellin',
        estado: 'inactiva',
      }),
    ).resolves.toMatchObject({
      id: 'ent_1',
      nombre: 'Entidad Norte Global',
      tipo: 'gobierno',
      ciudad: 'Medellin',
      estado: 'inactiva',
    });
    expect(fs.store.get(`${COLLECTIONS.entidades}/ent_1`)).toMatchObject({
      nombre: 'Entidad Norte Global',
      tipo: 'gobierno',
      ciudad: 'Medellin',
      estado: 'inactiva',
    });
    expect([...fs.store.values()].some((v) => v.accion === 'entidad.editar' && v.recurso === 'ent_1')).toBe(true);
  });

  it('roles tenant no crean ni editan entidades globales', async () => {
    const { svc } = build();

    await expect(svc.crearEntidadGlobal(adminEntidad, { nombre: 'Entidad Bloqueada' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.crearEntidadGlobal(adminVeterinaria, { nombre: 'Entidad Bloqueada' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.crearEntidadGlobal(veterinario, { nombre: 'Entidad Bloqueada' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.actualizarEntidadGlobal(adminEntidad, 'ent_1', { nombre: 'No' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.actualizarEntidadGlobal(adminVeterinaria, 'ent_1', { nombre: 'No' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.actualizarEntidadGlobal(veterinario, 'ent_1', { nombre: 'No' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('superadmin edita sedes globales existentes sin scope tenant', async () => {
    const { svc, fs } = build();

    await expect(
      svc.actualizarVeterinaria(superadmin, 'vetclin_2', {
        nombre: 'Clinica Sur Operaciones',
        ciudad: 'Cali',
        estado: 'inactiva',
      }),
    ).resolves.toMatchObject({
      id: 'vetclin_2',
      nombre: 'Clinica Sur Operaciones',
      ciudad: 'Cali',
      estado: 'inactiva',
    });

    expect(fs.store.get(`${COLLECTIONS.veterinarias}/vetclin_2`)).toMatchObject({
      nombre: 'Clinica Sur Operaciones',
      ciudad: 'Cali',
      estado: 'inactiva',
    });
  });

  it('superadmin bloquea usuarios globales pero no puede desactivarse a si mismo', async () => {
    const { svc, fs, auth } = build();

    await expect(svc.setBloqueoMiembro(superadmin, 'm_vet2', true)).resolves.toMatchObject({
      uid: 'vet2',
      bloqueado: true,
    });
    expect(auth.updateUser).toHaveBeenCalledWith('vet2', { disabled: true });
    expect(fs.store.get(`${COLLECTIONS.miembros}/m_vet2`)).toMatchObject({
      estado: 'bloqueado',
      bloqueado: true,
    });

    await expect(svc.setBloqueoMiembro(superadmin, 'm_root', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('superadmin crea sede solo con entidadId objetivo valido', async () => {
    const { svc, fs } = build();

    await expect(
      svc.crearVeterinaria(superadmin, {
        veterinariaId: 'vetclin_global_ent_1',
        entidadId: 'ent_1',
        nombre: 'Sede Global Norte',
        ciudad: 'Pereira',
        planOwnerType: 'entidad',
      }),
    ).resolves.toMatchObject({
      id: 'vetclin_global_ent_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      nombre: 'Sede Global Norte',
      ciudad: 'Pereira',
    });

    expect(fs.store.get(`${COLLECTIONS.veterinarias}/vetclin_global_ent_1`)).toMatchObject({
      entidadId: 'ent_1',
      planOwnerId: 'ent_1',
      nombre: 'Sede Global Norte',
    });
  });

  it('superadmin no crea sede sin entidadId ni con entidad inexistente', async () => {
    const { svc } = build();

    await expect(
      svc.crearVeterinaria(superadmin, {
        veterinariaId: 'vetclin_global_sin_entidad',
        nombre: 'Sede sin entidad',
        planOwnerType: 'entidad',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      svc.crearVeterinaria(superadmin, {
        veterinariaId: 'vetclin_global_ent_x',
        entidadId: 'ent_no_existe',
        nombre: 'Sede entidad inexistente',
        planOwnerType: 'entidad',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('roles tenant no crean sedes globales para otra entidad', async () => {
    const { svc } = build();

    await expect(
      svc.crearVeterinaria(adminEntidad, {
        veterinariaId: 'vetclin_cross_global',
        entidadId: 'ent_2',
        nombre: 'Sede ajena',
        planOwnerType: 'entidad',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.crearVeterinaria(adminVeterinaria, {
        veterinariaId: 'vetclin_admin_vet_global',
        entidadId: 'ent_1',
        nombre: 'Sede global vet',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.crearVeterinaria(veterinario, {
        veterinariaId: 'vetclin_vet_global',
        entidadId: 'ent_1',
        nombre: 'Sede global veterinario',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('veterinario no accede a backoffice admin', async () => {
    const { svc } = build();

    await expect(svc.listarMiembros(veterinario)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.listarConsumos(veterinario)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bloquea cross-tenant y audita cambios de miembros permitidos', async () => {
    const { svc, fs, auth } = build();

    await expect(svc.setBloqueoMiembro(adminVeterinaria, 'm_vet2', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await expect(svc.setBloqueoMiembro(adminVeterinaria, 'm_vet1', true)).resolves.toMatchObject({
      uid: 'vet1',
      bloqueado: true,
    });
    expect(auth.updateUser).toHaveBeenCalledWith('vet1', { disabled: true });
    expect(fs.store.get(`${COLLECTIONS.miembros}/m_vet1`)).toMatchObject({
      estado: 'bloqueado',
      bloqueado: true,
    });
    expect([...fs.store.values()].some((v) => v.accion === 'miembro.desactivar')).toBe(true);
    expect([...fs.store.values()].some((v) => v.tipo === 'miembro_desactivado' && v.destinatarioUid === 'vet1')).toBe(
      true,
    );
  });

  it('impide que un admin se desactive a si mismo', async () => {
    const { svc } = build();

    await expect(svc.setBloqueoMiembro(adminVeterinaria, 'm_admin_vet', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('admin entidad edita perfil completo y deja auditoria', async () => {
    const { svc, fs } = build();

    await expect(
      svc.actualizarEntidadActual(adminEntidad, {
        nombre: 'Entidad Norte Editada',
        tipo: 'gobierno',
        direccion: 'Carrera 7 #30-10',
        ciudad: 'Medellin',
        pais: 'Colombia',
        telefono: '+57 301 333 4455',
        emailContacto: 'operaciones@entidadnorte.com',
        logoUrl: null,
      }),
    ).resolves.toMatchObject({
      id: 'ent_1',
      nombre: 'Entidad Norte Editada',
      tipo: 'gobierno',
      direccion: 'Carrera 7 #30-10',
      ciudad: 'Medellin',
      pais: 'Colombia',
      telefono: '+57 301 333 4455',
      emailContacto: 'operaciones@entidadnorte.com',
      logoUrl: null,
    });

    expect(fs.store.get(`${COLLECTIONS.entidades}/ent_1`)).toMatchObject({
      nombre: 'Entidad Norte Editada',
      tipo: 'gobierno',
      direccion: 'Carrera 7 #30-10',
      ciudad: 'Medellin',
      pais: 'Colombia',
      telefono: '+57 301 333 4455',
      emailContacto: 'operaciones@entidadnorte.com',
      logoUrl: null,
    });
    expect([...fs.store.values()].some((v) => v.accion === 'organizacion.editar')).toBe(true);
  });

  it('valida tipo y email de contacto en DTO de entidad', async () => {
    const invalid = Object.assign(new ActualizarEntidadBackofficeDto(), {
      nombre: 'Entidad Norte',
      tipo: 'clinica',
      emailContacto: 'correo-invalido',
    });
    await expect(validate(invalid)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'tipo' }),
        expect.objectContaining({ property: 'emailContacto' }),
      ]),
    );

    const valid = Object.assign(new ActualizarEntidadBackofficeDto(), {
      tipo: 'ong',
      emailContacto: null,
      logoUrl: null,
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
  });

  it('valida DTO de creacion global de entidad', async () => {
    const invalid = Object.assign(new CrearEntidadBackofficeDto(), {
      nombre: '',
      tipo: 'clinica',
      emailContacto: 'correo-invalido',
    });
    await expect(validate(invalid)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'nombre' }),
        expect.objectContaining({ property: 'tipo' }),
        expect.objectContaining({ property: 'emailContacto' }),
      ]),
    );

    const valid = Object.assign(new CrearEntidadBackofficeDto(), {
      nombre: 'Entidad Centro',
      tipo: 'entidad',
      emailContacto: 'contacto@entidad.test',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
  });

  it('admin entidad crea y edita sedes propias con campos seguros', async () => {
    const { svc, fs } = build();
    const nueva = await svc.crearVeterinaria(adminEntidad, {
      veterinariaId: 'vetclin_3',
      nombre: 'Clinica Centro',
      ciudad: 'Cali',
      pais: 'Colombia',
      telefono: '+57 302 444 5566',
      emailContacto: 'centro@entidadnorte.com',
      planOwnerType: 'entidad',
    });

    expect(nueva).toMatchObject({
      id: 'vetclin_3',
      nombre: 'Clinica Centro',
      ciudad: 'Cali',
      pais: 'Colombia',
      telefono: '+57 302 444 5566',
      emailContacto: 'centro@entidadnorte.com',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    await expect(
      svc.actualizarVeterinaria(adminEntidad, 'vetclin_3', {
        nombre: 'Clinica Centro 24h',
        ciudad: 'Barranquilla',
        estado: 'inactiva',
      }),
    ).resolves.toMatchObject({
      id: 'vetclin_3',
      nombre: 'Clinica Centro 24h',
      ciudad: 'Barranquilla',
      estado: 'inactiva',
    });
    expect(fs.store.get(`${COLLECTIONS.veterinarias}/vetclin_3`)).toMatchObject({
      nombre: 'Clinica Centro 24h',
      ciudad: 'Barranquilla',
      estado: 'inactiva',
    });
  });

  it('valida email de contacto en DTO de creacion de sede', async () => {
    const invalid = Object.assign(new CrearVeterinariaBackofficeDto(), {
      nombre: 'Clinica Centro',
      emailContacto: 'correo-invalido',
    });
    await expect(validate(invalid)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'emailContacto' })]),
    );
  });

  it('admin entidad no mezcla sedes, miembros ni consumo de otra entidad con el mismo orgId', async () => {
    const { svc, fs } = build();
    fs.store.set(`${COLLECTIONS.veterinarias}/vetclin_3`, {
      nombre: 'Clinica Otra Entidad',
      orgId: 'orgA',
      legacyOrgId: 'orgA',
      entidadId: 'ent_2',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_2',
      accountId: 'vetclin_3',
      estado: 'activa',
    });
    fs.store.set(`${COLLECTIONS.miembros}/m_vet3`, {
      uid: 'vet3',
      email: 'vet3@x.com',
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_3',
      entidadId: 'ent_2',
      veterinariaId: 'vetclin_3',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_2',
      estado: 'activo',
    });
    fs.store.set(`${COLLECTIONS.consumos}/vet3_2026-06`, {
      scopeId: 'vet3',
      orgId: 'orgA',
      entidadId: 'ent_2',
      veterinariaId: 'vetclin_3',
      veterinarioId: 'vet3',
      periodo: '2026-06',
      usados: 9,
      limite: 10,
    });

    const sedes = await svc.listarVeterinarias(adminEntidad);
    const miembros = await svc.listarMiembros(adminEntidad);
    const consumos = await svc.listarConsumos(adminEntidad);

    expect(sedes.map((s) => s.id)).toEqual(['vetclin_1']);
    expect(miembros.map((m) => m.id).sort()).toEqual(['m_admin_ent', 'm_admin_vet', 'm_vet1']);
    expect(consumos.map((c) => c.id)).toEqual(['vet1_2026-06']);
  });

  it('admin entidad ve consumo de freelancers directos propios sin sumar otra entidad', async () => {
    const { svc, fs } = build();
    fs.store.set(`${COLLECTIONS.miembros}/m_vet_free`, {
      uid: 'vetFree',
      email: 'free@entidadnorte.com',
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'entidad',
      accountId: 'ent_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'freelance',
      estado: 'activo',
    });
    fs.store.set(`${COLLECTIONS.miembros}/m_vet_free_otra`, {
      uid: 'vetFree2',
      email: 'free@otra.com',
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'entidad',
      accountId: 'ent_2',
      entidadId: 'ent_2',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_2',
      vinculoTipo: 'freelance',
      estado: 'activo',
    });
    fs.store.set(`${COLLECTIONS.consumos}/vetFree_2026-06`, {
      scopeId: 'vetFree',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinarioId: 'vetFree',
      periodo: '2026-06',
      usados: 4,
      limite: 10,
    });
    fs.store.set(`${COLLECTIONS.consumos}/vetFree2_2026-06`, {
      scopeId: 'vetFree2',
      orgId: 'orgA',
      entidadId: 'ent_2',
      veterinarioId: 'vetFree2',
      periodo: '2026-06',
      usados: 7,
      limite: 10,
    });

    const miembros = await svc.listarVeterinarios(adminEntidad);
    const consumos = await svc.listarConsumos(adminEntidad);

    expect(miembros.map((m) => m.id)).toContain('m_vet_free');
    expect(miembros.map((m) => m.id)).not.toContain('m_vet_free_otra');
    expect(consumos.map((c) => c.id).sort()).toEqual(['vet1_2026-06', 'vetFree_2026-06']);
  });

  it('admin veterinaria edita perfil completo solo dentro de su veterinaria', async () => {
    const { svc, fs } = build();

    await expect(
      svc.actualizarVeterinaria(adminVeterinaria, 'vetclin_1', {
        nombre: 'Clinica Norte 24h',
        direccion: 'Carrera 10 #20-30',
        ciudad: 'Bogota',
        pais: 'Colombia',
        telefono: '+57 301 222 3344',
        emailContacto: 'operaciones@clinicanorte.com',
        logoUrl: null,
      }),
    ).resolves.toMatchObject({
      id: 'vetclin_1',
      nombre: 'Clinica Norte 24h',
      direccion: 'Carrera 10 #20-30',
      ciudad: 'Bogota',
      pais: 'Colombia',
      telefono: '+57 301 222 3344',
      emailContacto: 'operaciones@clinicanorte.com',
      logoUrl: null,
    });

    expect(fs.store.get(`${COLLECTIONS.veterinarias}/vetclin_1`)).toMatchObject({
      nombre: 'Clinica Norte 24h',
      direccion: 'Carrera 10 #20-30',
      ciudad: 'Bogota',
      pais: 'Colombia',
      telefono: '+57 301 222 3344',
      emailContacto: 'operaciones@clinicanorte.com',
      logoUrl: null,
    });
    expect([...fs.store.values()].some((v) => v.accion === 'veterinaria.editar')).toBe(true);

    await expect(
      svc.actualizarVeterinaria(adminVeterinaria, 'vetclin_2', { nombre: 'Clinica Ajena' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida email de contacto en DTO de veterinaria', async () => {
    const invalid = Object.assign(new ActualizarVeterinariaBackofficeDto(), {
      nombre: 'Clinica Norte',
      emailContacto: 'correo-invalido',
    });
    await expect(validate(invalid)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'emailContacto' })]),
    );

    const valid = Object.assign(new ActualizarVeterinariaBackofficeDto(), {
      direccion: 'Calle 1',
      emailContacto: null,
      logoUrl: null,
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
  });

  it('admin veterinaria no ve consumo de veterinaria hermana aunque comparta orgId', async () => {
    const { svc, fs } = build();
    fs.store.set(`${COLLECTIONS.miembros}/m_vet3`, {
      uid: 'vet3',
      email: 'vet3@x.com',
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_2',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      estado: 'activo',
    });
    fs.store.set(`${COLLECTIONS.consumos}/vet3_2026-06`, {
      scopeId: 'vet3',
      orgId: 'orgA',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      veterinarioId: 'vet3',
      periodo: '2026-06',
      usados: 6,
      limite: 10,
    });

    const consumos = await svc.listarConsumos(adminVeterinaria);

    expect(consumos).toEqual([expect.objectContaining({ id: 'vet1_2026-06', porcentaje: 80 })]);
    expect(consumos.map((c) => c.id)).not.toContain('vet3_2026-06');
  });
});
