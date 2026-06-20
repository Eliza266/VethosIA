import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS, contadorHcDocId } from '../../common/firebase/collections';
import { ConsultasRepository } from './consultas.repository';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { assertAcceso, particionTenant } from '../../common/auth/access';

export interface NumeroHcResult {
  numeroHC: string;
}

// Genera el numero de HC. El problema del diseño viejo: UN solo doc global
// (configuracion/contadorHC) con una transaccion -> todas las clinicas pelean por el
// mismo documento y Firestore aguanta ~1 escritura/seg por doc. Con 10k usuarios eso
// es contencion pura y errores de "too much contention".
//
// Fix: partimos el contador por clinica (configuracion/contadorHC_{orgId}). En un SaaS
// los usuarios estan repartidos en muchas clinicas, asi que la carga se distribuye y
// cada doc solo recibe la escritura de SU clinica. Mantenemos el formato HC000001 y la
// unicidad (la transaccion garantiza monotonia dentro de la clinica).
//
// Nota sobre sharding: para una UNICA clinica con picos brutales, se podria shardear el
// contador, pero eso rompe la numeracion monotonica/sin huecos que un HC necesita. Por eso
// elegimos particionar por tenant (escala donde de verdad importa) y no shardear el HC.
@Injectable()
export class HcService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly consultas: ConsultasRepository,
  ) {}

  async generarParaConsulta(consultaId: string, user: AuthUser): Promise<NumeroHcResult> {
    const consulta = await this.consultas.getById(consultaId);
    assertAcceso(user, consulta);

    // si la consulta ya tiene numero, lo devolvemos (idempotente: reintentos no duplican).
    if (consulta.numeroHC) {
      return { numeroHC: consulta.numeroHC };
    }

    const tenant = particionTenant(user, consulta);
    const numeroHC = await this.siguienteNumero(tenant, consultaId);
    return { numeroHC };
  }

  // Transaccion: lee el contador de la clinica, lo incrementa y de paso escribe el
  // numeroHC en la consulta. Todo atomico para que dos requests no se pisen el numero.
  private async siguienteNumero(tenant: string, consultaId: string): Promise<string> {
    const db = this.firebase.firestore;
    const contadorRef = db.collection(COLLECTIONS.configuracion).doc(contadorHcDocId(tenant));
    const consultaRef = this.consultas.ref(consultaId);

    const numero = await db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      const actual = snap.exists ? this.leerUltimo(snap) : 0;
      const nuevo = actual + 1;
      tx.set(contadorRef, { ultimo: nuevo, orgId: tenant }, { merge: true });
      tx.set(consultaRef, { numeroHC: this.formato(nuevo) }, { merge: true });
      return nuevo;
    });

    return this.formato(numero);
  }

  private leerUltimo(snap: admin.firestore.DocumentSnapshot): number {
    const v = (snap.data() ?? {}).ultimo;
    return typeof v === 'number' ? v : 0;
  }

  // formato historico: HC + 6 digitos con padding. No cambiar sin avisar al frontend/PDF.
  formato(n: number): string {
    return `HC${String(n).padStart(6, '0')}`;
  }
}
