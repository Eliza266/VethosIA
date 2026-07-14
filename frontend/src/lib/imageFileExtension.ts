const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);

/** Extension normalizada (jpeg -> jpg) a partir del mime type o, si falta, del nombre del archivo. */
export function extensionFromFile(file: File): string {
  const fromMime = file.type.startsWith('image/') ? file.type.split('/')[1]?.toLowerCase() : '';
  if (fromMime === 'jpeg') return 'jpg';
  if (fromMime && IMAGE_EXTENSIONS.has(fromMime)) return fromMime;

  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (fromName === 'jpeg') return 'jpg';
  if (fromName && IMAGE_EXTENSIONS.has(fromName)) return fromName;

  return 'jpg';
}
