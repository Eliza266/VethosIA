import { IaJob } from './queue.interface';

// Contrato del que sabe procesar un job (lo implementa IaService). Lo separamos en su
// propio token para romper la dependencia circular Queue <-> IaService: la cola in-memory
// necesita "algo que procese" sin conocer al service concreto.
export interface IaProcessor {
  procesar(job: IaJob): Promise<void>;
}

export const IA_PROCESSOR = Symbol('IA_PROCESSOR');
