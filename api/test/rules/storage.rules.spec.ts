import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const PROJECT_ID = 'vetia-storage-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../../storage.rules');
const hayEmulador = !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const describeIf = hayEmulador ? describe : describe.skip;

describeIf('storage.rules - aislamiento por tenant', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: { rules: fs.readFileSync(RULES_PATH, 'utf8') },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage();
      await uploadBytes(
        ref(storage, 'historiales/orgA/consulta-1.pdf'),
        new Uint8Array([37, 80, 68, 70]),
        { contentType: 'application/pdf' },
      );
      await uploadBytes(
        ref(storage, 'fotos-pacientes/orgA/pac1/foto-seed.png'),
        png,
        { contentType: 'image/png' },
      );
    });
  });

  function ctxOrg(uid: string, orgId: string, rol: string) {
    return testEnv.authenticatedContext(uid, { orgId, rol });
  }

  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const pdf = new Uint8Array([37, 80, 68, 70]);

  it('historiales: miembro de la org puede leer su PDF', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'historiales/orgA/consulta-1.pdf');
    await assertSucceeds(getBytes(objectRef));
  });

  it('historiales: otro tenant no puede leer PDF ajeno', async () => {
    const storage = ctxOrg('vetB', 'orgB', 'admin').storage();
    const objectRef = ref(storage, 'historiales/orgA/consulta-1.pdf');
    await assertFails(getBytes(objectRef));
  });

  it('historiales: cliente no puede escribir ni en su propia org', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'historiales/orgA/consulta-2.pdf');
    await assertFails(uploadBytes(objectRef, pdf, { contentType: 'application/pdf' }));
  });

  it('historiales legacy plano: lectura denegada aunque este autenticado', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'historiales/consulta-legacy.pdf');
    await assertFails(getBytes(objectRef));
  });

  it('org-scoped: miembro de la org puede subir y leer', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'fotos-pacientes/orgA/pac1/foto-upload.png');
    await assertSucceeds(
      uploadBytes(objectRef, png, { contentType: 'image/png' }),
    );
    await assertSucceeds(getBytes(objectRef));
  });

  it('org-scoped: otro tenant no puede leer foto ajena', async () => {
    const storage = ctxOrg('vetB', 'orgB', 'admin').storage();
    const objectRef = ref(storage, 'fotos-pacientes/orgA/pac1/foto-seed.png');
    await assertFails(getBytes(objectRef));
  });

  it('org-scoped: otro tenant no puede subir', async () => {
    const storage = ctxOrg('vetB', 'orgB', 'admin').storage();
    const objectRef = ref(storage, 'fotos-pacientes/orgA/pac1/foto.png');
    await assertFails(
      uploadBytes(objectRef, png, { contentType: 'image/png' }),
    );
  });

  it('legacy uid: dueño puede subir en ruta de dos segmentos', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'fotos-pacientes/vetA/pac1');
    await assertSucceeds(
      uploadBytes(objectRef, png, { contentType: 'image/png' }),
    );
  });

  it('ruta no permitida: denegada', async () => {
    const storage = ctxOrg('vetA', 'orgA', 'vet').storage();
    const objectRef = ref(storage, 'otros/vetA/secret.png');
    await assertFails(
      uploadBytes(objectRef, png, { contentType: 'image/png' }),
    );
  });
});
