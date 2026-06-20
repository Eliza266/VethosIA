import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { COLLECTIONS } from '../../src/common/firebase/collections';
import { AuditoriaService } from '../../src/modules/plataforma/auditoria.service';
import { NotificacionesService } from '../../src/modules/plataforma/notificaciones.service';
import { SolicitudesTecnicasService } from '../../src/modules/tenant/solicitudes-tecnicas.service';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { fakeFirebase } from './saas.fakes';

const adminOrgA: AuthUser = { uid: 'adminA', email: 'admin@orga.test', orgId: 'orgA', rol: 'admin' };
const adminOrgB: AuthUser = { uid: 'adminB', email: 'admin@orgb.test', orgId: 'orgB', rol: 'admin' };
const superadmin: AuthUser = { uid: 'super1', email: 'soporte@vetia.test', rol: 'superadmin' };

function build() {
  const { fb, fs } = fakeFirebase();
  const claims: Record<string, Record<string, unknown>> = {};
  (fb as unknown as { auth: unknown }).auth = {
    getUser: jest.fn(async (uid: string) => ({ customClaims: claims[uid] ?? {} })),
    setCustomUserClaims: jest.fn(async (uid: string, next: Record<string, unknown>) => {
      claims[uid] = next;
    }),
    updateUser: jest.fn(async () => undefined),
  };

  const notificaciones = new NotificacionesService(fb);
  const auditoria = new AuditoriaService(fb);
  const tenant = new TenantService(fb, notificaciones);
  const svc = new SolicitudesTecnicasService(fb, tenant, auditoria, notificaciones);
  fs.store.set(`${COLLECTIONS.miembros}/super1`, { uid: 'super1', rol: 'superadmin' });
  return { svc, fs, claims };
}

async function crearSolicitud(svc: SolicitudesTecnicasService) {
  return svc.crearVinculacion({
    tipo: 'vinculacion_veterinario',
    emailInvitado: 'vet@x.com',
    uidExistente: 'vet1',
    orgSolicitante: 'orgA',
    orgActual: 'orgB',
    rolSolicitado: 'vet',
    motivo: 'usuario_con_organizacion',
    conflicto: 'El usuario ya pertenece a una organizacion.',
    creadoPor: 'adminA',
    invitacionId: 'inv1',
  });
}

describe('SolicitudesTecnicasService', () => {
  it('deduplica solicitudes pendientes por org y usuario existente', async () => {
    const { svc, fs } = build();
    const primera = await crearSolicitud(svc);
    const segunda = await crearSolicitud(svc);

    expect(segunda.id).toBe(primera.id);
    const solicitudes = [...fs.store.keys()].filter((k) => k.startsWith(`${COLLECTIONS.solicitudesTecnicas}/`));
    expect(solicitudes).toHaveLength(1);
  });

  it('admin solo ve solicitudes de su org y no puede resolver', async () => {
    const { svc } = build();
    const solicitud = await crearSolicitud(svc);

    await expect(svc.obtener(solicitud.id, adminOrgB)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.aprobar(solicitud.id, adminOrgA, 'ok')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.listar(adminOrgA)).resolves.toHaveLength(1);
    await expect(svc.listar(adminOrgB)).resolves.toHaveLength(0);
  });

  it('superadmin aprueba y aplica miembro, custom claims, notificacion y auditoria', async () => {
    const { svc, fs, claims } = build();
    const solicitud = await crearSolicitud(svc);

    const aprobada = await svc.aprobar(solicitud.id, superadmin, 'Aprobada por Area Tecnica.');

    expect(aprobada.estado).toBe('aprobada');
    expect(fs.store.get(`${COLLECTIONS.miembros}/vet1`)).toMatchObject({ orgId: 'orgA', rol: 'vet' });
    expect(claims.vet1).toMatchObject({ orgId: 'orgA', rol: 'vet' });
    const auditoria = [...fs.store.values()].filter((v) => v.accion === 'solicitud_tecnica.aprobar');
    expect(auditoria).toHaveLength(1);
    const notificaciones = [...fs.store.values()].filter((v) => v.tipo === 'veterinario_vinculado');
    expect(notificaciones).toHaveLength(1);
  });

  it('superadmin rechaza sin vincular al veterinario', async () => {
    const { svc, fs } = build();
    const solicitud = await crearSolicitud(svc);

    const rechazada = await svc.rechazar(solicitud.id, superadmin, 'Conflicto no autorizado.');

    expect(rechazada.estado).toBe('rechazada');
    expect(fs.store.get(`${COLLECTIONS.miembros}/vet1`)).toBeUndefined();
    const auditoria = [...fs.store.values()].filter((v) => v.accion === 'solicitud_tecnica.rechazar');
    expect(auditoria).toHaveLength(1);
  });
});
