import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InvitacionesService } from '../../src/modules/tenant/invitaciones.service';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { NotificacionesService } from '../../src/modules/plataforma/notificaciones.service';
import { AuditoriaService } from '../../src/modules/plataforma/auditoria.service';
import { SolicitudesTecnicasService } from '../../src/modules/tenant/solicitudes-tecnicas.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { DEV_INVITE_SECRET } from '../../src/common/config/env.schema';
import { fakeFirebase } from './saas.fakes';

const admin: AuthUser = { uid: 'admin1', orgId: 'orgA', rol: 'admin', email: 'admin@x.com' };
const adminEntidadV2: AuthUser = {
  uid: 'adminEnt',
  email: 'admin.entidad@x.com',
  orgId: 'orgA',
  rol: 'admin',
  v: 2,
  role: 'admin_entidad',
  accountType: 'entidad',
  accountId: 'ent_1',
  entidadId: 'ent_1',
  membershipId: 'm_adminEnt',
  planOwnerType: 'entidad',
  planOwnerId: 'ent_1',
};
const STRONG_INVITE_SECRET = 'invite-secret-produccion-valido-test-only-48-chars';

function build(libres = 3) {
  const { fb, fs } = fakeFirebase();
  const tenant = {
    asignarMiembro: jest.fn(async () => ({ orgId: 'orgA', rol: 'vet' as const })),
    asignarMiembroV2: jest.fn(async (input: Record<string, unknown>) => ({
      orgId: input.orgId ?? 'orgA',
      rol: input.rol ?? 'vet',
      role: input.role,
      accountType: input.accountType,
      accountId: input.accountId,
      entidadId: input.entidadId,
      veterinariaId: input.veterinariaId,
      membershipId: input.membershipId ?? `m_${input.uid}`,
      planOwnerType: input.planOwnerType,
      planOwnerId: input.planOwnerId,
      vinculoTipo: input.vinculoTipo,
    })),
    obtenerMiembro: jest.fn(async () => null),
    obtenerMembershipV2: jest.fn(async () => null),
    obtenerVeterinaria: jest.fn(async (id: string) =>
      id === 'vetclin_1'
        ? {
            id: 'vetclin_1',
            nombre: 'Clinica Norte',
            orgId: 'orgA',
            legacyOrgId: 'orgA',
            entidadId: 'ent_1',
            planOwnerType: 'entidad',
            planOwnerId: 'ent_1',
            accountType: 'veterinaria',
            accountId: 'vetclin_1',
            estado: 'activa',
          }
        : id === 'vetclin_2'
          ? {
              id: 'vetclin_2',
              nombre: 'Clinica Sur',
              orgId: 'orgA',
              legacyOrgId: 'orgA',
              entidadId: 'ent_2',
              planOwnerType: 'entidad',
              planOwnerId: 'ent_2',
              accountType: 'veterinaria',
              accountId: 'vetclin_2',
              estado: 'activa',
            }
          : null,
    ),
  } as unknown as TenantService;
  const subs = {
    asientosDisponibles: jest.fn(async () => ({ usados: 1, max: 1 + libres, libres })),
    obtenerDeUsuario: jest.fn(async () => null),
  } as unknown as SuscripcionesService;
  const solicitudes = {
    crearVinculacion: jest.fn(async (input: Record<string, unknown>) => ({
      id: 'solicitud_1',
      estado: 'pendiente',
      ...input,
    })),
  } as unknown as SolicitudesTecnicasService;
  const notis = { notificarAdminsEntidad: jest.fn(async () => undefined) } as unknown as NotificacionesService;
  const auditoria = { registrar: jest.fn(async () => ({ id: 'log' })) } as unknown as AuditoriaService;
  const svc = new InvitacionesService(fb, tenant, subs, solicitudes, notis, auditoria);
  return { svc, tenant, subs, solicitudes, notis, auditoria, fs };
}

async function crearInvitacionConScopeV2() {
  const ctx = build();
  const { token, invitacionId } = await ctx.svc.crear('orgA', 'vet@x.com', 'vet', admin);
  const path = `invitaciones/${invitacionId}`;
  const actual = ctx.fs.store.get(path) ?? {};
  ctx.fs.store.set(path, {
    ...actual,
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: 'account-server',
    entidadId: 'entidad-server',
    veterinariaId: 'veterinaria-server',
    planOwnerType: 'entidad',
    planOwnerId: 'plan-owner-server',
    vinculoTipo: 'staff',
  });
  return { ...ctx, token };
}

describe('InvitacionesService', () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD, INVITE_SECRET: 's3cr3t', INVITE_TTL_HORAS: '48' };
  });
  afterEach(() => {
    process.env = OLD;
  });

  it('crea un token persistido con expiracion ~48h cuando hay asientos', async () => {
    const { svc, fs } = build(2);
    const { token, expiraEn, invitacionId } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    expect(token).toContain('.');
    expect(new Date(expiraEn).getTime()).toBeGreaterThan(Date.now());
    expect(fs.store.get(`invitaciones/${invitacionId}`)).toMatchObject({
      orgId: 'orgA',
      email: 'vet@x.com',
      rol: 'vet',
    });
  });

  it('rechaza si no hay asientos disponibles', async () => {
    const { svc } = build(0);
    await expect(svc.crear('orgA', 'vet@x.com', 'vet', admin)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('R123: rechaza crear invitacion legacy con rol asistente', async () => {
    const { svc } = build(3);
    await expect(svc.crear('orgA', 'asistente@x.com', 'asistente' as never, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza invitar a otra organizacion', async () => {
    const { svc } = build(3);
    await expect(svc.crear('orgB', 'vet@x.com', 'vet', admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('verificar acepta un token valido y rechaza firma manipulada', async () => {
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    expect(svc.verificar(token).orgId).toBe('orgA');
    const [b64] = token.split('.');
    expect(() => svc.verificar(`${b64}.firmamala`)).toThrow(ForbiddenException);
  });

  it('en produccion no firma ni persiste invitacion sin INVITE_SECRET fuerte', async () => {
    process.env = { ...OLD, NODE_ENV: 'production', INVITE_SECRET: '', INVITE_TTL_HORAS: '48' };
    const { svc, fs } = build();

    await expect(svc.crear('orgA', 'vet@x.com', 'vet', admin)).rejects.toThrow(/INVITE_SECRET/);
    expect([...fs.store.keys()].filter((key) => key.startsWith('invitaciones/'))).toHaveLength(0);
  });

  it('en produccion rechaza el default dev de INVITE_SECRET', async () => {
    process.env = {
      ...OLD,
      NODE_ENV: 'production',
      INVITE_SECRET: DEV_INVITE_SECRET,
      INVITE_TTL_HORAS: '48',
    };
    const { svc } = build();

    await expect(svc.crear('orgA', 'vet@x.com', 'vet', admin)).rejects.toThrow(/INVITE_SECRET/);
  });

  it('en produccion firma y verifica tokens con INVITE_SECRET fuerte', async () => {
    process.env = {
      ...OLD,
      NODE_ENV: 'production',
      INVITE_SECRET: STRONG_INVITE_SECRET,
      INVITE_TTL_HORAS: '48',
    };
    const { svc } = build();

    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);

    expect(svc.verificar(token)).toMatchObject({ orgId: 'orgA', email: 'vet@x.com', rol: 'vet' });
  });

  it('rechaza token expirado (TTL negativo)', async () => {
    process.env.INVITE_TTL_HORAS = '-1';
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    expect(() => svc.verificar(token)).toThrow(/expir/i);
  });

  it('aceptar crea el miembro cuando el email coincide', async () => {
    const { svc, tenant, solicitudes, notis } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' });
    expect(res.orgId).toBe('orgA');
    expect(tenant.asignarMiembro).toHaveBeenCalledWith('orgA', 'nuevoVet', 'vet');
    expect(solicitudes.crearVinculacion).not.toHaveBeenCalled();
    expect(notis.notificarAdminsEntidad).toHaveBeenCalled();
  });

  it('usuario existente sin organizacion ni plan se vincula normalmente', async () => {
    const { svc, tenant, subs, solicitudes } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' });

    expect(tenant.obtenerMiembro).toHaveBeenCalledWith('nuevoVet');
    expect(subs.obtenerDeUsuario).toHaveBeenCalled();
    expect(tenant.asignarMiembro).toHaveBeenCalled();
    expect(solicitudes.crearVinculacion).not.toHaveBeenCalled();
  });

  it('usuario existente con organizacion crea solicitud tecnica y no aplica claims', async () => {
    const { svc, tenant, solicitudes, fs } = build();
    (tenant.obtenerMiembro as jest.Mock).mockResolvedValueOnce({ orgId: 'orgB', rol: 'vet' });
    const { token, invitacionId } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);

    const res = await svc.aceptar(token, { uid: 'vetExistente', email: 'vet@x.com' });

    expect('estado' in res ? res.estado : null).toBe('pendiente_revision_tecnica');
    expect(solicitudes.crearVinculacion).toHaveBeenCalledWith(
      expect.objectContaining({
        uidExistente: 'vetExistente',
        orgSolicitante: 'orgA',
        orgActual: 'orgB',
        conflicto: expect.stringMatching(/organizacion/i),
      }),
    );
    expect(tenant.asignarMiembro).not.toHaveBeenCalled();
    expect(fs.store.get(`invitaciones/${invitacionId}`)).toMatchObject({
      estado: 'revision_tecnica',
      solicitudTecnicaId: 'solicitud_1',
    });
  });

  it('usuario existente con plan activo crea solicitud tecnica', async () => {
    const { svc, tenant, subs, solicitudes } = build();
    (subs.obtenerDeUsuario as jest.Mock).mockResolvedValueOnce({
      id: 'sub1',
      planId: 'pro',
      estado: 'activa',
      veterinarioId: 'vetExistente',
    });
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);

    const res = await svc.aceptar(token, { uid: 'vetExistente', email: 'vet@x.com' });

    expect('estado' in res ? res.estado : null).toBe('pendiente_revision_tecnica');
    expect(solicitudes.crearVinculacion).toHaveBeenCalledWith(
      expect.objectContaining({
        uidExistente: 'vetExistente',
        planActual: expect.objectContaining({ id: 'sub1', estado: 'activa' }),
        conflicto: expect.stringMatching(/plan activo/i),
      }),
    );
    expect(tenant.asignarMiembro).not.toHaveBeenCalled();
  });

  it('aceptar ignora role=superadmin enviado por cliente y conserva el rol de la invitacion', async () => {
    const { svc, tenant, token } = await crearInvitacionConScopeV2();
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }, { role: 'superadmin' });

    expect(res.rol).toBe('vet');
    expect(res.role).toBe('veterinario');
    expect(tenant.asignarMiembroV2).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'nuevoVet',
        rol: 'vet',
        role: 'veterinario',
        accountId: 'account-server',
      }),
    );
  });

  it('R123: rechaza invitacion persistida con role=asistente', async () => {
    const { svc, fs, token } = await crearInvitacionConScopeV2();
    const [payloadB64] = token.split('.');
    const { id } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { id: string };
    fs.store.set(`invitaciones/${id}`, {
      ...(fs.store.get(`invitaciones/${id}`) ?? {}),
      role: 'asistente',
    });

    await expect(svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('R122: rechaza invitacion persistida con role=sistema', async () => {
    const { svc, fs, token } = await crearInvitacionConScopeV2();
    const [payloadB64] = token.split('.');
    const { id } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { id: string };
    fs.store.set(`invitaciones/${id}`, {
      ...(fs.store.get(`invitaciones/${id}`) ?? {}),
      role: 'sistema',
    });

    await expect(svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aceptar ignora accountId enviado por cliente y conserva el de la invitacion', async () => {
    const { svc, token } = await crearInvitacionConScopeV2();
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }, { accountId: 'account-evil' });

    if (!('accountId' in res)) throw new Error('se esperaba InvitacionAceptada');
    expect(res.accountId).toBe('account-server');
  });

  it('aceptar ignora entidadId enviado por cliente y conserva el de la invitacion', async () => {
    const { svc, token } = await crearInvitacionConScopeV2();
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }, { entidadId: 'entidad-evil' });

    if (!('entidadId' in res)) throw new Error('se esperaba InvitacionAceptada');
    expect(res.entidadId).toBe('entidad-server');
  });

  it('aceptar ignora veterinariaId enviado por cliente y conserva el de la invitacion', async () => {
    const { svc, token } = await crearInvitacionConScopeV2();
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }, { veterinariaId: 'veterinaria-evil' });

    if (!('veterinariaId' in res)) throw new Error('se esperaba InvitacionAceptada');
    expect(res.veterinariaId).toBe('veterinaria-server');
  });

  it('aceptar ignora planOwnerId enviado por cliente y conserva el de la invitacion', async () => {
    const { svc, token } = await crearInvitacionConScopeV2();
    const res = await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }, { planOwnerId: 'plan-owner-evil' });

    if (!('planOwnerId' in res)) throw new Error('se esperaba InvitacionAceptada');
    expect(res.planOwnerId).toBe('plan-owner-server');
  });

  it('rechaza aceptar con email distinto al de la invitacion', async () => {
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    await expect(
      svc.aceptar(token, { uid: 'otro', email: 'otro@x.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza reutilizar un token ya aceptado', async () => {
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    await svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' });
    await expect(
      svc.aceptar(token, { uid: 'otroVet', email: 'vet@x.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza aceptar una invitacion expirada', async () => {
    process.env.INVITE_TTL_HORAS = '-1';
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    await expect(
      svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }),
    ).rejects.toThrow(/expiro/i);
  });

  it('revocar impide aceptar despues', async () => {
    const { svc } = build();
    const { token } = await svc.crear('orgA', 'vet@x.com', 'vet', admin);
    await svc.revocar(token, admin);
    await expect(
      svc.aceptar(token, { uid: 'nuevoVet', email: 'vet@x.com' }),
    ).rejects.toThrow(/revocad/i);
  });

  it('admin_veterinaria puede invitar veterinario solo a su veterinaria', async () => {
    const { svc, fs } = build(2);
    const adminVet: AuthUser = {
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
      membershipId: 'm_adminVet',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    };

    const { invitacionId } = await svc.crearV2(
      {
        email: 'vet.nuevo@x.com',
        role: 'veterinario',
        veterinariaId: 'vetclin_evil',
        accountId: 'vetclin_evil',
      },
      adminVet,
    );

    expect(fs.store.get(`invitaciones/${invitacionId}`)).toMatchObject({
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    });
  });

  it('admin_veterinaria no puede invitar admin_veterinaria ni usuarios de otra sede', async () => {
    const { svc } = build(2);
    const adminVet: AuthUser = {
      uid: 'adminVet',
      orgId: 'orgA',
      rol: 'admin',
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    };

    await expect(
      svc.crearV2({ email: 'otra@x.com', role: 'admin_veterinaria' }, adminVet),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin_entidad puede invitar veterinario a una sede propia con scope normalizado', async () => {
    const { svc, fs, subs } = build(2);

    const { invitacionId } = await svc.crearV2(
      {
        email: 'nuevo.sede@x.com',
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        vinculoTipo: 'staff',
      },
      adminEntidadV2,
    );

    expect(fs.store.get(`invitaciones/${invitacionId}`)).toMatchObject({
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'staff',
    });
    expect(subs.asientosDisponibles).toHaveBeenCalledWith(
      expect.objectContaining({
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        veterinariaId: 'vetclin_1',
      }),
    );
  });

  it('admin_entidad no puede invitar a una sede ajena aunque comparta orgId', async () => {
    const { svc } = build(2);

    await expect(
      svc.crearV2(
        {
          email: 'nuevo.sede@x.com',
          role: 'veterinario',
          accountType: 'veterinaria',
          accountId: 'vetclin_2',
          veterinariaId: 'vetclin_2',
          entidadId: 'ent_1',
          planOwnerType: 'entidad',
          planOwnerId: 'ent_1',
        },
        adminEntidadV2,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin_entidad puede invitar freelance directo solo al plan owner de su entidad', async () => {
    const { svc, fs } = build(2);

    const { invitacionId } = await svc.crearV2(
      {
        email: 'freelance@x.com',
        role: 'veterinario',
        accountType: 'entidad',
        accountId: 'ent_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        vinculoTipo: 'freelance',
      },
      adminEntidadV2,
    );

    expect(fs.store.get(`invitaciones/${invitacionId}`)).toMatchObject({
      orgId: 'orgA',
      rol: 'vet',
      role: 'veterinario',
      accountType: 'entidad',
      accountId: 'ent_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'freelance',
    });
  });

  it('admin_entidad no puede invitar freelance directo a otra entidad', async () => {
    const { svc } = build(2);

    await expect(
      svc.crearV2(
        {
          email: 'freelance@x.com',
          role: 'veterinario',
          accountType: 'entidad',
          accountId: 'ent_2',
          entidadId: 'ent_2',
          planOwnerType: 'entidad',
          planOwnerId: 'ent_2',
          vinculoTipo: 'freelance',
        },
        adminEntidadV2,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
