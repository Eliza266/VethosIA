import { ForbiddenException, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS, consumoDocId, periodoActual } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';

export interface EstadoConsumo {
  periodo: string;
  scopeId: string;
  usados: number;
  limite: number;
  restante: number;
  porcentaje: number;
  alcanzo80: boolean;
  bloqueado: boolean;
}

// Contador de consumo de historias IA por periodo (mes). El scope es la ENTIDAD si el
// usuario pertenece a una (consumo centralizado/asientos compartidos) o el veterinario
// independiente (vet_<uid>). El reinicio es automatico: al cambiar de mes cambia el docId
// (scope_YYYY-MM), asi que el periodo nuevo arranca en 0 sin job de borrado.
@Injectable()
export class ConsumoService {
  constructor(private readonly firebase: FirebaseService) {}

  // entidad (orgId) si existe -> consumo centralizado; si no, vet independiente.
  scopeId(user: AuthUser): string {
    return user.orgId ?? `vet_${user.uid}`;
  }

  private ref(scopeId: string, periodo: string): admin.firestore.DocumentReference {
    return this.firebase.firestore.collection(COLLECTIONS.consumos).doc(consumoDocId(scopeId, periodo));
  }

  private armarEstado(scopeId: string, periodo: string, usados: number, limite: number): EstadoConsumo {
    const restante = Math.max(0, limite - usados);
    const porcentaje = limite > 0 ? Math.round((usados / limite) * 100) : 0;
    return {
      periodo,
      scopeId,
      usados,
      limite,
      restante,
      porcentaje,
      alcanzo80: limite > 0 && usados >= Math.ceil(limite * 0.8),
      bloqueado: limite > 0 && usados >= limite,
    };
  }

  async estado(user: AuthUser, limite: number, hoy: Date = new Date()): Promise<EstadoConsumo> {
    const scopeId = this.scopeId(user);
    const periodo = periodoActual(hoy);
    const snap = await this.ref(scopeId, periodo).get();
    const usados = snap.exists ? Number((snap.data() ?? {}).usados ?? 0) : 0;
    return this.armarEstado(scopeId, periodo, usados, limite);
  }

  // ¿Puede generar IA? (bloqueo al 100%). Se chequea ANTES de arrancar el pipeline.
  async puedeGenerar(user: AuthUser, limite: number, hoy: Date = new Date()): Promise<boolean> {
    return !(await this.estado(user, limite, hoy)).bloqueado;
  }

  // Descuento atomico dentro de una transaccion (aprobar consulta). Falla si ya esta al limite.
  async reservarUsoEnTransaccion(
    tx: admin.firestore.Transaction,
    user: AuthUser,
    limite: number,
    hoy: Date = new Date(),
  ): Promise<EstadoConsumo> {
    const scopeId = this.scopeId(user);
    const periodo = periodoActual(hoy);
    const ref = this.ref(scopeId, periodo);
    const snap = await tx.get(ref);
    const actual = snap.exists ? Number((snap.data() ?? {}).usados ?? 0) : 0;
    if (limite > 0 && actual >= limite) {
      throw new ForbiddenException(
        'Limite de historias con IA del plan alcanzado para este periodo.',
      );
    }
    const nuevo = actual + 1;
    tx.set(
      ref,
      { usados: nuevo, limite, scopeId, orgId: user.orgId ?? null, periodo },
      { merge: true },
    );
    return this.armarEstado(scopeId, periodo, nuevo, limite);
  }

  // Descuento del plan: ocurre al APROBAR una historia (no al crear borrador). Incrementa
  // el contador del periodo de forma atomica y devuelve el estado resultante.
  async registrarUso(user: AuthUser, limite: number, hoy: Date = new Date()): Promise<EstadoConsumo> {
    const scopeId = this.scopeId(user);
    const periodo = periodoActual(hoy);
    const ref = this.ref(scopeId, periodo);
    const db = this.firebase.firestore;

    const usados = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const actual = snap.exists ? Number((snap.data() ?? {}).usados ?? 0) : 0;
      const nuevo = actual + 1;
      tx.set(ref, { usados: nuevo, limite, scopeId, orgId: user.orgId ?? null, periodo }, { merge: true });
      return nuevo;
    });

    return this.armarEstado(scopeId, periodo, usados, limite);
  }
}
