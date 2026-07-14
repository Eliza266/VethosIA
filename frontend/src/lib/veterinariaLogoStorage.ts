import { extensionFromFile } from './imageFileExtension';

/** Ruta org-scoped para el logo de la veterinaria en Firebase Storage. */
export function buildVeterinariaLogoStoragePath(orgId: string, file: File): string {
  const ext = extensionFromFile(file);
  return `logos-veterinaria/${orgId}/logo.${ext}`;
}
