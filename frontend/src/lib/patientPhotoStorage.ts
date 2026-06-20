const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);

function extensionFromFile(file: File): string {
  const fromMime = file.type.startsWith('image/') ? file.type.split('/')[1]?.toLowerCase() : '';
  if (fromMime === 'jpeg') return 'jpg';
  if (fromMime && IMAGE_EXTENSIONS.has(fromMime)) return fromMime;

  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (fromName === 'jpeg') return 'jpg';
  if (fromName && IMAGE_EXTENSIONS.has(fromName)) return fromName;

  return 'jpg';
}

/** Ruta org-scoped para fotos de pacientes en Firebase Storage. */
export function buildPatientPhotoStoragePath(
  orgId: string,
  pacienteId: string,
  file: File,
): string {
  const ext = extensionFromFile(file);
  return `fotos-pacientes/${orgId}/${pacienteId}/foto.${ext}`;
}
