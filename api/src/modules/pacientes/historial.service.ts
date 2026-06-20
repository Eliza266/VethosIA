import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { PacientesService } from './pacientes.service';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { PacienteDoc } from './paciente.types';
import { assertAcceso } from '../../common/auth/access';
import { filterClinicalSubrecordsForPatient } from '../../common/auth/clinical-history-scope';

export interface HistorialClinico {
  paciente: PacienteDoc;
  consultas: Record<string, unknown>[];
  vacunas: Record<string, unknown>[];
  citas: Record<string, unknown>[];
}

// Consolida el historial clinico de un paciente. pacienteId no basta como frontera de
// seguridad: cada subdocumento tambien debe coincidir con el scope clinico del paciente.
@Injectable()
export class HistorialService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly pacientes: PacientesService,
  ) {}

  async consolidar(pacienteId: string, user: AuthUser): Promise<HistorialClinico> {
    const paciente = await this.pacientes.obtener(pacienteId, user);
    const [consultas, vacunas, citas] = await Promise.all([
      this.porPaciente(COLLECTIONS.consultas, pacienteId),
      this.porPaciente(COLLECTIONS.vacunas, pacienteId),
      this.porPaciente(COLLECTIONS.citas, pacienteId),
    ]);
    return {
      paciente,
      consultas: this.filtrarScopePaciente(consultas, paciente, pacienteId, user),
      vacunas: this.filtrarScopePaciente(vacunas, paciente, pacienteId, user),
      citas: this.filtrarScopePaciente(citas, paciente, pacienteId, user),
    };
  }

  private async porPaciente(col: string, pacienteId: string): Promise<Record<string, unknown>[]> {
    const snap: admin.firestore.QuerySnapshot = await this.firebase.firestore
      .collection(col)
      .where('pacienteId', '==', pacienteId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  }

  private filtrarScopePaciente(
    items: Record<string, unknown>[],
    paciente: PacienteDoc,
    pacienteId: string,
    user: AuthUser,
  ): Record<string, unknown>[] {
    return filterClinicalSubrecordsForPatient(items, paciente as unknown as Record<string, unknown>, pacienteId)
      .filter((item) => {
        try {
          assertAcceso(user, item);
          return true;
        } catch {
          return false;
        }
      });
  }
}
