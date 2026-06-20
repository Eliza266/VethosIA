import { ForbiddenException } from '@nestjs/common';
import { HcService } from '../../src/modules/consultas/hc.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { ConsultaDoc } from '../../src/modules/consultas/consulta.types';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

// Tests de dominio puros del HcService: NO tocan Firestore real, mockeamos la transaccion.
// Lo que validamos: formato HC, idempotencia (no re-numera) y aislamiento por tenant.

interface FakeSnap {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

function fakeFirebase(ultimoActual: number): { fb: FirebaseService; sets: Record<string, unknown>[] } {
  const sets: Record<string, unknown>[] = [];
  const tx = {
    get: async (): Promise<FakeSnap> => ({
      exists: ultimoActual > 0,
      data: () => ({ ultimo: ultimoActual }),
    }),
    set: (_ref: unknown, data: Record<string, unknown>): void => {
      sets.push(data);
    },
  };
  const firestore = {
    collection: () => ({ doc: () => ({ id: 'contador' }) }),
    runTransaction: async (fn: (t: typeof tx) => Promise<number>): Promise<number> => fn(tx),
  };
  const fb = { firestore } as unknown as FirebaseService;
  return { fb, sets };
}

function fakeRepo(consulta: ConsultaDoc): ConsultasRepository {
  return {
    getById: async (): Promise<ConsultaDoc> => consulta,
    ref: () => ({ id: consulta.id }),
  } as unknown as ConsultasRepository;
}

const userConOrg: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };

describe('HcService', () => {
  it('formatea el numero como HC + 6 digitos', () => {
    const svc = new HcService(fakeFirebase(0).fb, fakeRepo({ id: 'c1', orgId: 'orgA' }));
    expect(svc.formato(1)).toBe('HC000001');
    expect(svc.formato(42)).toBe('HC000042');
    expect(svc.formato(123456)).toBe('HC123456');
  });

  it('incrementa el contador del tenant y devuelve el numero formateado', async () => {
    const { fb } = fakeFirebase(5);
    const repo = fakeRepo({ id: 'c1', orgId: 'orgA', veterinarioId: 'u1' });
    const svc = new HcService(fb, repo);
    const res = await svc.generarParaConsulta('c1', userConOrg);
    // venia en 5 -> siguiente es 6.
    expect(res.numeroHC).toBe('HC000006');
  });

  it('es idempotente: si la consulta ya tiene numeroHC lo devuelve sin re-numerar', async () => {
    const { fb } = fakeFirebase(99);
    const repo = fakeRepo({ id: 'c1', orgId: 'orgA', veterinarioId: 'u1', numeroHC: 'HC000007' });
    const svc = new HcService(fb, repo);
    const res = await svc.generarParaConsulta('c1', userConOrg);
    expect(res.numeroHC).toBe('HC000007');
  });

  it('rechaza si la consulta es de otro tenant', async () => {
    const { fb } = fakeFirebase(0);
    const repo = fakeRepo({ id: 'c1', orgId: 'orgB', veterinarioId: 'otro' });
    const svc = new HcService(fb, repo);
    await expect(svc.generarParaConsulta('c1', userConOrg)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
