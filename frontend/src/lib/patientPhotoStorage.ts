import { extensionFromFile } from './imageFileExtension';

/** Ruta org-scoped para fotos de pacientes en Firebase Storage. */
export function buildPatientPhotoStoragePath(
  orgId: string,
  pacienteId: string,
  file: File,
): string {
  const ext = extensionFromFile(file);
  return `fotos-pacientes/${orgId}/${pacienteId}/foto.${ext}`;
}
