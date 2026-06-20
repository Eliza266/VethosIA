import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { AppModule } from '../../src/app.module';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { ConsultasService } from '../../src/modules/consultas/consultas.service';
import { ConsumoService } from '../../src/modules/saas/consumo.service';
import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { COLLECTIONS } from '../../src/common/firebase/collections';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

// Integracion REAL contra emuladores Firestore + Auth.
// Valida crear/listar consultas con orgId y POST /v1/consultas con claims.
//
// REQUISITO: emuladores firestore + auth. Local:
//   firebase emulators:start --only firestore,auth
//   npm run test:integration

const hayEmulador =
  !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const describeIf = hayEmulador ? describe : describe.skip;

const ORG_ID = 'org-consultas-int';
const UID = 'vet-consultas-int';
const EMAIL = 'consultas-int@vetia.local';
const PASSWORD = 'Consultas-Int-2026!';

async function idTokenFor(uid: string, claims: { orgId: string; rol: string }): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const customToken = await admin.auth().createCustomToken(uid, claims);
  const res = await axios.post(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { token: customToken, returnSecureToken: true },
  );
  return res.data.idToken as string;
}

describeIf('Consultas (integracion con emulador)', () => {
  let firebase: FirebaseService;
  let repo: ConsultasRepository;
  let svc: ConsultasService;
  let app: INestApplication;
  let pacienteId: string;
  const user: AuthUser = { uid: UID, orgId: ORG_ID, rol: 'vet', email: EMAIL };

  beforeAll(async () => {
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'vethosia-production';
    process.env.IA_MOCK = 'true';
    process.env.NODE_ENV = 'test';

    firebase = new FirebaseService();
    firebase.init();
    repo = new ConsultasRepository(firebase);
    const consumo = {
      registrarUso: jest.fn(),
      puedeGenerar: jest.fn(async () => true),
    } as unknown as ConsumoService;
    const subs = { limiteHistoriasMes: jest.fn(async () => 10) } as unknown as SuscripcionesService;
    const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'log' }) };
    const notificaciones = {
      crear: jest.fn(),
      notificarAdminsEntidad: jest.fn(),
    };
    const citas = {
      cerrarDesdeConsulta: jest.fn(),
      vincularConsulta: jest.fn(),
    };
    svc = new ConsultasService(
      firebase,
      repo,
      consumo,
      subs,
      auditoria as never,
      notificaciones as never,
      citas as never,
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    const auth = admin.auth();
    const db = firebase.firestore;

    try {
      await auth.getUser(UID);
    } catch {
      await auth.createUser({ uid: UID, email: EMAIL, password: PASSWORD, emailVerified: true });
    }
    await auth.setCustomUserClaims(UID, { orgId: ORG_ID, rol: 'vet' });

    await db.collection(COLLECTIONS.organizaciones).doc(ORG_ID).set({ nombre: 'Org integracion' });
    await db.collection(COLLECTIONS.miembros).doc(UID).set({ orgId: ORG_ID, rol: 'vet', email: EMAIL });

    const pacRef = db.collection(COLLECTIONS.pacientes).doc();
    pacienteId = pacRef.id;
    await pacRef.set({
      orgId: ORG_ID,
      veterinarioId: UID,
      nombre: 'Paciente integracion',
      especie: 'perro',
    });

    const consultas = await db.collection(COLLECTIONS.consultas).where('orgId', '==', ORG_ID).get();
    const batch = db.batch();
    consultas.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

  it('ConsultasService.crear persiste orgId, veterinarioId y estado borrador', async () => {
    const creada = await svc.crear({ pacienteId }, user);
    expect(creada.id).toBeTruthy();
    expect(creada.orgId).toBe(ORG_ID);
    expect(creada.veterinarioId).toBe(UID);
    expect(creada.estado).toBe('borrador');
    expect(creada.pacienteId).toBe(pacienteId);
  });

  it('ConsultasService.listar filtra por orgId y pacienteId opcional', async () => {
    await svc.crear({ pacienteId }, user);
    const todas = await svc.listar(user);
    expect(todas.length).toBeGreaterThanOrEqual(1);
    expect(todas.every((c) => c.orgId === ORG_ID)).toBe(true);

    const filtradas = await svc.listar(user, pacienteId);
    expect(filtradas.every((c) => c.pacienteId === pacienteId)).toBe(true);
  });

  it('POST /v1/consultas crea consulta con claims de tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.orgId).toBe(ORG_ID);
    expect(res.body.veterinarioId).toBe(UID);
    expect(res.body.estado).toBe('borrador');
    expect(res.body.pacienteId).toBe(pacienteId);
  });

  it('PATCH /v1/consultas/:id actualiza campos y actualizadoEn', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    const patched = await request(app.getHttpServer())
      .patch(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ motivo: 'vomito', transcripcion: 'texto e2e' })
      .expect(200);

    expect(patched.body.motivo).toBe('vomito');
    expect(patched.body.transcripcion).toBe('texto e2e');

    const snap = await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).get();
    expect(snap.data()?.actualizadoEn).toBeTruthy();
  });

  it('PATCH /v1/consultas/:id rechaza estado aprobada', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    const res = await request(app.getHttpServer())
      .patch(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ estado: 'aprobada' })
      .expect(400);

    expect(res.body.message).toContain('Use POST /v1/consultas/:id/aprobar');
  });

  it('PATCH /v1/consultas/:id rechaza cross-tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    const otherToken = await idTokenFor('vet-other-org', { orgId: 'org-other', rol: 'vet' });
    await request(app.getHttpServer())
      .patch(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ motivo: 'hack' })
      .expect(403);
  });

  it('POST /v1/consultas/:id/aprobar aprueba borrador del tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).update({
      estado: 'borrador',
      signosVitales: { peso: 11, talla: 28 },
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/consultas/${consultaId}/aprobar`)
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);

    expect(res.body.estado).toBe('aprobada');

    const snap = await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).get();
    expect(snap.data()?.estado).toBe('aprobada');
  });

  it('POST /v1/consultas/:id/aprobar rechaza cross-tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;
    await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).update({ estado: 'borrador' });

    const otherToken = await idTokenFor('vet-other-aprobar', { orgId: 'org-other', rol: 'vet' });
    await request(app.getHttpServer())
      .post(`/v1/consultas/${consultaId}/aprobar`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  async function crearConsultaBorradorParaAprobar(): Promise<string> {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;
    await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).update({
      estado: 'borrador',
      signosVitales: { peso: 11, talla: 28 },
    });
    return consultaId;
  }

  it('POST /v1/consultas/:id/aprobar rechaza admin legacy sin scope clinico V2', async () => {
    const consultaId = await crearConsultaBorradorParaAprobar();
    const adminToken = await idTokenFor('admin-consultas-int', { orgId: ORG_ID, rol: 'admin' });
    await request(app.getHttpServer())
      .post(`/v1/consultas/${consultaId}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('POST /v1/consultas/:id/aprobar rechaza asistente → 403', async () => {
    const consultaId = await crearConsultaBorradorParaAprobar();
    const asistenteToken = await idTokenFor('asistente-consultas-int', { orgId: ORG_ID, rol: 'asistente' });
    await request(app.getHttpServer())
      .post(`/v1/consultas/${consultaId}/aprobar`)
      .set('Authorization', `Bearer ${asistenteToken}`)
      .expect(403);
  });

  it('POST /v1/consultas/:id/aprobar sin auth → 401', async () => {
    const consultaId = await crearConsultaBorradorParaAprobar();
    await request(app.getHttpServer()).post(`/v1/consultas/${consultaId}/aprobar`).expect(401);
  });

  it('DELETE /v1/consultas/:id elimina borrador del tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    await request(app.getHttpServer())
      .delete(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200)
      .expect({ eliminado: true });

    const snap = await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).get();
    expect(snap.exists).toBe(false);
  });

  it('DELETE /v1/consultas/:id rechaza cross-tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;

    const otherToken = await idTokenFor('vet-other-delete', { orgId: 'org-other', rol: 'vet' });
    await request(app.getHttpServer())
      .delete(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('DELETE /v1/consultas/:id rechaza consulta inexistente', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    await request(app.getHttpServer())
      .delete('/v1/consultas/consulta-inexistente-xyz')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(404);
  });

  it('DELETE /v1/consultas/:id rechaza consulta aprobada', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/consultas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ pacienteId })
      .expect(201);
    const consultaId = created.body.id as string;
    await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).update({ estado: 'aprobada' });

    const res = await request(app.getHttpServer())
      .delete(`/v1/consultas/${consultaId}`)
      .set('Authorization', `Bearer ${idToken}`)
      .expect(400);

    expect(res.body.message).toContain('aprobadas no se pueden eliminar');
    const snap = await firebase.firestore.collection(COLLECTIONS.consultas).doc(consultaId).get();
    expect(snap.exists).toBe(true);
  });
});
