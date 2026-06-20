import type { Consulta } from '../types';

export type ClinicalDocumentAction = 'pdf' | 'email' | 'whatsapp';

const ACTION_MODULE_ID: Record<ClinicalDocumentAction, string> = {
  pdf: 'pdf-clinico',
  email: 'email-demo',
  whatsapp: 'whatsapp-link',
};

export function clinicalDocumentActionFromModuleId(moduleId: string): ClinicalDocumentAction | null {
  const entry = Object.entries(ACTION_MODULE_ID).find(([, id]) => id === moduleId);
  return entry ? (entry[0] as ClinicalDocumentAction) : null;
}

export function isConsultaAprobada(consulta: Consulta): boolean {
  return consulta.estado === 'aprobada' || Boolean(consulta.soap);
}

export function findLatestApprovedConsulta(consultas: Consulta[]): Consulta | null {
  const approved = consultas.filter(isConsultaAprobada);
  if (approved.length === 0) return null;
  return [...approved].sort(
    (a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime(),
  )[0];
}

export function resolveClinicalDocumentPath(
  action: ClinicalDocumentAction,
  consultas: Consulta[],
): string {
  const latest = findLatestApprovedConsulta(consultas);
  if (latest?.id && latest.pacienteId) {
    return `/pacientes/${latest.pacienteId}/consultas/${latest.id}?documento=${action}`;
  }
  return `/documentos?accion=${action}`;
}

export function consultaDetailPath(consulta: Pick<Consulta, 'id' | 'pacienteId'>): string {
  return `/pacientes/${consulta.pacienteId}/consultas/${consulta.id}`;
}

export function consultaDocumentPath(
  consulta: Pick<Consulta, 'id' | 'pacienteId'>,
  action: ClinicalDocumentAction,
): string {
  return `${consultaDetailPath(consulta)}?documento=${action}`;
}

export function resolveModulePath(
  moduleId: string,
  defaultPath: string,
  consultas: Consulta[],
): string {
  const action = clinicalDocumentActionFromModuleId(moduleId);
  if (action) return resolveClinicalDocumentPath(action, consultas);
  if (moduleId === 'consulta-soap') {
    const latest = findLatestApprovedConsulta(consultas);
    if (latest?.id && latest.pacienteId) {
      return `/pacientes/${latest.pacienteId}/consultas/${latest.id}`;
    }
    const borrador = [...consultas].sort(
      (a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime(),
    )[0];
    if (borrador?.id && borrador.pacienteId) {
      return `/pacientes/${borrador.pacienteId}/consultas/${borrador.id}`;
    }
    return defaultPath;
  }
  return defaultPath;
}
