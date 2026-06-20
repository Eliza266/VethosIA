import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { PlanDoc } from './plan.types';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { AuthUser } from '../../common/auth/auth-user.interface';

// CRUD de planes (catalogo comercial). Solo superadmin escribe (lo aplica el controller).
@Injectable()
export class PlanesService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.planes);
  }

  async crear(data: Omit<PlanDoc, 'id'>, actor?: AuthUser): Promise<PlanDoc> {
    const ref = this.col.doc();
    await ref.set(data);
    await this.auditoria.registrar({
      accion: 'plan.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actor?.orgId ?? null,
      recurso: ref.id,
      meta: { op: 'crear' },
    });
    return { ...data, id: ref.id };
  }

  async actualizar(id: string, data: Partial<PlanDoc>, actor?: AuthUser): Promise<PlanDoc> {
    await this.col.doc(id).set(data, { merge: true });
    await this.auditoria.registrar({
      accion: 'plan.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actor?.orgId ?? null,
      recurso: id,
      meta: { op: 'actualizar' },
    });
    return this.obtener(id);
  }

  async obtener(id: string): Promise<PlanDoc> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) throw new NotFoundException(`Plan ${id} no existe.`);
    return { id: snap.id, ...(snap.data() as Omit<PlanDoc, 'id'>) };
  }

  async listar(soloActivos = false): Promise<PlanDoc[]> {
    const snap = await this.col.get();
    const planes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlanDoc, 'id'>) }));
    return soloActivos ? planes.filter((p) => p.activo) : planes;
  }
}
