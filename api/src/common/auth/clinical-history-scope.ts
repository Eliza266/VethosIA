export type ClinicalHistoryRecord = Record<string, unknown>;

export function filterClinicalSubrecordsForPatient<T extends ClinicalHistoryRecord>(
  records: T[],
  patient: ClinicalHistoryRecord,
  pacienteId: string,
): T[] {
  return records.filter((record) => belongsToPatientClinicalScope(record, patient, pacienteId));
}

export function belongsToPatientClinicalScope(
  record: ClinicalHistoryRecord,
  patient: ClinicalHistoryRecord,
  pacienteId: string,
): boolean {
  if (text(record.pacienteId) !== pacienteId) return false;

  const patientEntidadId = text(patient.entidadId);
  const patientVeterinariaId = text(patient.veterinariaId);
  const patientAccountId = text(patient.accountId);
  const patientOrgId = text(patient.orgId);
  const patientVeterinarioId = text(patient.veterinarioId);

  if (patientEntidadId) {
    if (text(record.entidadId) !== patientEntidadId) return false;
    if (patientVeterinariaId && text(record.veterinariaId) !== patientVeterinariaId) return false;
    return true;
  }

  if (patientVeterinariaId) return text(record.veterinariaId) === patientVeterinariaId;
  if (patientAccountId) return text(record.accountId) === patientAccountId;
  if (patientOrgId) return text(record.orgId) === patientOrgId;
  if (patientVeterinarioId) return text(record.veterinarioId) === patientVeterinarioId;

  return false;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
