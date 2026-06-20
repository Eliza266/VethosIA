import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { COLLECTIONS, contadorHcDocId } from '../../src/common/firebase/collections';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { HcService } from '../../src/modules/consultas/hc.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

// Integracion REAL contra el emulador de Firestore. Valida lo importante del fix de
// escalabilidad: numeracion por tenant unica y sin huecos, incluso con llamadas concurrentes.
//
// REQUISITO: emulador de Firestore. En CI lo levanta el step de emuladores.
// Local: firebase emulators:start --only firestore ; luego npm run test:integration.
// Sin emulador, se salta solo.

const hayEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;
const describeIf = hayEmulador ? describe : describe.skip;

describeIf('HcService (integracion con emulador)', () => {
  let firebase: FirebaseService;
  let svc: HcService;
  const user: AuthUser = { uid: 'vetX', orgId: 'orgIntegracion', rol: 'vet' };
  // El unit test de concurrencia cubre 50 requests. Aqui mantenemos concurrencia real
  // contra emulador sin empujarlo a lock timeouts falsos cuando corre junto al stack local.
  const totalConsultas = 8;
  const ids = Array.from({ length: totalConsultas }, (_, i) => `int-c-${i}`);

  beforeAll(() => {
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'vethosia-production';
    firebase = new FirebaseService();
    firebase.init();
    const repo = new ConsultasRepository(firebase);
    svc = new HcService(firebase, repo);
  });

  beforeEach(async () => {
    const db = firebase.firestore;
    const batch = db.batch();
    for (const id of ids) {
      batch.delete(db.collection(COLLECTIONS.consultas).doc(id));
    }
    batch.delete(db.collection(COLLECTIONS.configuracion).doc(contadorHcDocId(user.orgId!)));
    await batch.commit();
  });

  it('genera numeros unicos y contiguos para varias consultas de la misma org', async () => {
    const db = firebase.firestore;
    for (const id of ids) {
      const ref = db.collection(COLLECTIONS.consultas).doc(id);
      await ref.set({ orgId: user.orgId, veterinarioId: user.uid, estado: 'borrador' });
    }

    // disparamos todas a la vez: la transaccion debe serializar sin duplicar ni saltarse.
    const resultados = await Promise.all(ids.map((id) => svc.generarParaConsulta(id, user)));
    const numeros = resultados.map((r) => parseInt(r.numeroHC.replace('HC', ''), 10)).sort((a, b) => a - b);

    const unicos = new Set(numeros);
    expect(unicos.size).toBe(totalConsultas); // todos distintos
    expect(Math.min(...numeros)).toBe(1);
    expect(Math.max(...numeros)).toBe(totalConsultas); // contiguos 1..N
  }, 30000);
});
