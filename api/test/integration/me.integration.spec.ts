import { Test } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { COLLECTIONS } from '../../src/common/firebase/collections';

const hayEmulador =
  !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const describeIf = hayEmulador ? describe : describe.skip;

const ORG_ID = 'org-me-int';
const UID = 'vet-me-int';
const EMAIL = 'me-int@vetia.local';

async function idTokenFor(uid: string, claims: { orgId: string; rol: string }): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const customToken = await admin.auth().createCustomToken(uid, claims);
  const res = await axios.post(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { token: customToken, returnSecureToken: true },
  );
  return res.data.idToken as string;
}

describeIf('Me (integracion con emulador)', () => {
  let app: INestApplication;
  let firebase: FirebaseService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    firebase = moduleRef.get(FirebaseService);

    await firebase.firestore.collection(COLLECTIONS.organizaciones).doc(ORG_ID).set({
      nombre: 'Org Me Int',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.firestore.collection(COLLECTIONS.miembros).doc(UID).set({
      orgId: ORG_ID,
      rol: 'vet',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.firestore.collection(COLLECTIONS.veterinarios).doc(UID).set({
      uid: UID,
      nombre: 'Vet Me Int',
      email: EMAIL,
      telefono: '+57 111',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').set({
      emailsPermitidos: [],
    });
    try {
      await admin.auth().getUser(UID);
      await admin.auth().updateUser(UID, { email: EMAIL, emailVerified: true });
    } catch {
      await admin.auth().createUser({ uid: UID, email: EMAIL, emailVerified: true });
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/me devuelve identidad, claims y perfil veterinario', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      uid: UID,
      orgId: ORG_ID,
      rol: 'vet',
      nombre: 'Vet Me Int',
      telefono: '+57 111',
      organizacionNombre: 'Org Me Int',
    });
  });

  it('PATCH /v1/me actualiza campos de perfil propio', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ telefono: '+57 222', veterinaria: 'Clínica Patch' })
      .expect(200);

    expect(res.body.telefono).toBe('+57 222');
    expect(res.body.veterinaria).toBe('Clínica Patch');
    expect(res.body.orgId).toBe(ORG_ID);
    expect(res.body.rol).toBe('vet');
  });

  it('PATCH /v1/me rechaza campos no permitidos (orgId/rol)', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ orgId: 'org-hack', rol: 'admin', uid: 'otro', email: 'hack@x.com' })
      .expect(400);
  });

  it('GET /v1/me permite whitelist vacia', async () => {
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').set({
      emailsPermitidos: [],
    });
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);
  });

  it('GET /v1/me permite email en whitelist', async () => {
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').set({
      emailsPermitidos: [EMAIL],
    });
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);
  });

  it('GET /v1/me rechaza email fuera de whitelist', async () => {
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').set({
      emailsPermitidos: ['otro@vetia.local'],
    });
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(403);

    expect(res.body.message).toMatch(/no tiene acceso/i);
  });

  it('GET /v1/me permite si doc acceso no existe', async () => {
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').delete();
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);
    await firebase.firestore.collection(COLLECTIONS.configuracion).doc('acceso').set({
      emailsPermitidos: [],
    });
  });
});
