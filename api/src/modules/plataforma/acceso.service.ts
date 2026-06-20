import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';

const MSG_DENEGADO = 'Tu cuenta no tiene acceso a Vethos AI. Contacta al administrador.';
const MSG_NO_VERIFICABLE =
  'No pudimos verificar tu acceso en este momento. Intenta de nuevo más tarde o contacta al administrador.';

// Valida whitelist de login (configuracion/acceso) server-side con Admin SDK.
@Injectable()
export class AccesoService {
  constructor(private readonly firebase: FirebaseService) {}

  async validarEmailPermitido(email: string | null | undefined): Promise<void> {
    try {
      const snap = await this.firebase.firestore
        .collection(COLLECTIONS.configuracion)
        .doc('acceso')
        .get();

      if (!snap.exists) return;

      const data = snap.data() ?? {};
      const emailsPermitidos = Array.isArray(data.emailsPermitidos)
        ? data.emailsPermitidos.filter((e): e is string => typeof e === 'string')
        : [];

      if (emailsPermitidos.length === 0) return;

      if (!email || !emailsPermitidos.includes(email)) {
        throw new ForbiddenException(MSG_DENEGADO);
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException(MSG_NO_VERIFICABLE);
    }
  }
}
