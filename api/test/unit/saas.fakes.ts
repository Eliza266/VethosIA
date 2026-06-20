// Fake Firestore reutilizable para los tests de saas (consumo, wompi, suscripciones).
import { FirebaseService } from '../../src/common/firebase/firebase.service';

interface Ref {
  path: string;
  get: () => Promise<{ id: string; exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
  delete?: () => Promise<void>;
  id: string;
}

export class FakeFirestore {
  store = new Map<string, Record<string, unknown>>();

  private seq = 0;

  collection(name: string) {
    const q = this.query(name);
    return {
      doc: (id?: string): Ref => {
        const realId = id ?? `auto_${++this.seq}`;
        return this.makeRef(`${name}/${realId}`, realId);
      },
      where: q.where,
      limit: q.limit,
      get: q.get,
    };
  }

  private query(name: string) {
    const prefix = `${name}/`;
    const filtros: Array<[string, unknown]> = [];
    const q = {
      where: (campo: string, _op: string, val: unknown) => {
        filtros.push([campo, val]);
        return q;
      },
      limit: () => q,
      get: async () => {
        const docs = [...this.store.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([k, v]) => ({ id: k.slice(prefix.length), data: () => v, ...v }))
          .filter((d) => filtros.every(([c, val]) => (d as Record<string, unknown>)[c] === val));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
    return q;
  }

  makeRef(path: string, id: string): Ref {
    return {
      path,
      id,
      get: async () => ({ id, exists: this.store.has(path), data: () => this.store.get(path) }),
      set: async (data, opts) => {
        const prev = opts?.merge ? (this.store.get(path) ?? {}) : {};
        this.store.set(path, { ...prev, ...data });
      },
      delete: async () => {
        this.store.delete(path);
      },
    };
  }

  async runTransaction<T>(fn: (tx: TxLike) => Promise<T>): Promise<T> {
    const tx: TxLike = {
      get: (ref: Ref) =>
        Promise.resolve({ id: ref.id, exists: this.store.has(ref.path), data: () => this.store.get(ref.path) }),
      set: (ref: Ref, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const prev = opts?.merge ? (this.store.get(ref.path) ?? {}) : {};
        this.store.set(ref.path, { ...prev, ...data });
      },
    };
    return fn(tx);
  }

  /** Igual que runTransaction pero serializa llamadas concurrentes (tests de contencion). */
  async runTransactionSerial<T>(fn: (tx: TxLike) => Promise<T>): Promise<T> {
    const run = () => this.runTransaction(fn);
    const result = this.colaSerial.then(run, run);
    this.colaSerial = result.catch(() => undefined);
    return result;
  }

  private colaSerial: Promise<unknown> = Promise.resolve();
}

interface TxLike {
  get: (ref: Ref) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (ref: Ref, data: Record<string, unknown>, opts?: { merge?: boolean }) => void;
}

export function fakeFirebase(): { fb: FirebaseService; fs: FakeFirestore } {
  const fs = new FakeFirestore();
  return { fb: { firestore: fs } as unknown as FirebaseService, fs };
}
