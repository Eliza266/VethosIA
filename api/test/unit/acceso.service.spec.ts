import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { AccesoService } from '../../src/modules/plataforma/acceso.service';
import { FirebaseService } from '../../src/common/firebase/firebase.service';

describe('AccesoService', () => {
  const build = (doc: { exists: boolean; data?: Record<string, unknown>; throws?: boolean }) => {
    const get = jest.fn(async () => {
      if (doc.throws) throw new Error('firestore down');
      return {
        exists: doc.exists,
        data: () => doc.data ?? {},
      };
    });
    const firebase = {
      firestore: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ get })),
        })),
      },
    } as unknown as FirebaseService;
    return { svc: new AccesoService(firebase), get };
  };

  it('permite si el doc no existe', async () => {
    const { svc } = build({ exists: false });
    await expect(svc.validarEmailPermitido('a@b.com')).resolves.toBeUndefined();
  });

  it('permite si emailsPermitidos esta vacio', async () => {
    const { svc } = build({ exists: true, data: { emailsPermitidos: [] } });
    await expect(svc.validarEmailPermitido('cualquiera@b.com')).resolves.toBeUndefined();
  });

  it('permite si el email esta en la whitelist', async () => {
    const { svc } = build({ exists: true, data: { emailsPermitidos: ['a@b.com'] } });
    await expect(svc.validarEmailPermitido('a@b.com')).resolves.toBeUndefined();
  });

  it('deniega 403 si el email no esta en la whitelist', async () => {
    const { svc } = build({ exists: true, data: { emailsPermitidos: ['otro@b.com'] } });
    await expect(svc.validarEmailPermitido('a@b.com')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fail-closed 503 si falla la lectura en todos los reintentos', async () => {
    const { svc } = build({ exists: true, throws: true });
    await expect(svc.validarEmailPermitido('a@b.com')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('se recupera de un fallo transitorio de Firestore sin tumbar el login', async () => {
    let intentos = 0;
    const get = jest.fn(async () => {
      intentos += 1;
      if (intentos < 3) throw new Error('firestore blip transitorio');
      return { exists: true, data: () => ({ emailsPermitidos: ['a@b.com'] }) };
    });
    const firebase = {
      firestore: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ get })),
        })),
      },
    } as unknown as FirebaseService;
    const svc = new AccesoService(firebase);

    await expect(svc.validarEmailPermitido('a@b.com')).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledTimes(3);
  });
});
