import { HcService } from '../../src/modules/consultas/hc.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

// Modela la garantia de Firestore: las transacciones sobre el MISMO documento se
// serializan (no se pisan). Si la numeracion HC fuera no atomica, N requests
// concurrentes producirian numeros repetidos. Aqui validamos que NO pasa.

interface Ref {
  path: string;
}

class FakeFirestore {
  store = new Map<string, Record<string, unknown>>();
  private cola: Promise<unknown> = Promise.resolve();

  collection(name: string) {
    return {
      doc: (id: string): Ref => ({ path: `${name}/${id}` }),
    };
  }

  // Serializa las transacciones (mutex via cadena de promesas) para emular la
  // resolucion de contencion de Firestore sobre un unico doc.
  runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const tx: Tx = {
        get: async (ref: Ref) => {
          const data = this.store.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set: (ref: Ref, data: Record<string, unknown>) => {
          this.store.set(ref.path, { ...(this.store.get(ref.path) ?? {}), ...data });
        },
      };
      return fn(tx);
    };
    const result = this.cola.then(run, run);
    this.cola = result.catch(() => undefined);
    return result;
  }
}

interface Tx {
  get: (ref: Ref) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (ref: Ref, data: Record<string, unknown>) => void;
}

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };

describe('HcService concurrencia', () => {
  it('N requests paralelos producen numeros unicos y consecutivos (sin colision)', async () => {
    const fake = new FakeFirestore();
    const fb = { firestore: fake } as unknown as FirebaseService;
    // cada consulta tiene su propio id pero comparten contador del tenant orgA.
    const repo = {
      getById: async (id: string) => ({ id, orgId: 'orgA', veterinarioId: 'u1' }),
      ref: (id: string): Ref => ({ path: `consultas/${id}` }),
    } as unknown as ConsultasRepository;
    const svc = new HcService(fb, repo);

    const N = 50;
    const ids = Array.from({ length: N }, (_, i) => `c${i}`);
    const resultados = await Promise.all(ids.map((id) => svc.generarParaConsulta(id, user)));

    const numeros = resultados.map((r) => r.numeroHC);
    const unicos = new Set(numeros);
    expect(unicos.size).toBe(N); // sin duplicados
    // el contador final del tenant quedo en N
    expect(fake.store.get('configuracion/contadorHC_orgA')).toMatchObject({ ultimo: N });
    // todos siguen el formato y cubren 1..N
    const ordenados = numeros.map((n) => Number(n.replace('HC', ''))).sort((a, b) => a - b);
    expect(ordenados[0]).toBe(1);
    expect(ordenados[N - 1]).toBe(N);
  });
});
