import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { AppModule } from '../../src/app.module';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { COLLECTIONS } from '../../src/common/firebase/collections';

const hayEmulador =
  !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const describeIf = hayEmulador ? describe : describe.skip;

const ORG_ID = 'org-brigadas-int';
const UID = 'vet-brigadas-int';

async function idTokenFor(uid: string, claims: { orgId: string; rol: string }): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const customToken = await admin.auth().createCustomToken(uid, claims);
  const res = await axios.post(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { token: customToken, returnSecureToken: true },
  );
  return res.data.idToken as string;
}

describeIf('Brigadas (integracion con emulador)', () => {
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
      nombre: 'Org Brigadas Int',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.firestore.collection(COLLECTIONS.miembros).doc(UID).set({
      orgId: ORG_ID,
      rol: 'vet',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /v1/brigadas crea con orgId server-side', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .post('/v1/brigadas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({
        nombre: 'Brigada Int',
        fecha: '2026-08-01',
        ubicacion: { direccion: 'Parque', ciudad: 'Cali' },
        veterinarioIds: [],
      })
      .expect(201);

    expect(res.body.orgId).toBe(ORG_ID);
    expect(res.body.veterinarioIds).toContain(UID);
    expect(res.body.estado).toBe('planificada');
  });

  it('GET /v1/brigadas lista del tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const res = await request(app.getHttpServer())
      .get('/v1/brigadas')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((b: { nombre: string }) => b.nombre === 'Brigada Int')).toBe(true);
  });

  it('PATCH /v1/brigadas/:id actualiza propia', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/brigadas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({
        nombre: 'Patch Me',
        fecha: '2026-09-01',
        ubicacion: { direccion: '', ciudad: 'Bogotá' },
      })
      .expect(201);
    const id = created.body.id as string;

    const patched = await request(app.getHttpServer())
      .patch(`/v1/brigadas/${id}`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ estado: 'en_curso' })
      .expect(200);

    expect(patched.body.estado).toBe('en_curso');
  });

  it('GET /v1/brigadas/:id rechaza cross-tenant', async () => {
    const idToken = await idTokenFor(UID, { orgId: ORG_ID, rol: 'vet' });
    const created = await request(app.getHttpServer())
      .post('/v1/brigadas')
      .set('Authorization', `Bearer ${idToken}`)
      .send({
        nombre: 'Privada',
        fecha: '2026-10-01',
        ubicacion: { direccion: '', ciudad: 'Bogotá' },
      })
      .expect(201);
    const id = created.body.id as string;

    const otherToken = await idTokenFor('vet-other-brig', { orgId: 'org-other', rol: 'vet' });
    await request(app.getHttpServer())
      .get(`/v1/brigadas/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });
});
