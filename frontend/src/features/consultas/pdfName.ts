// Nombre de archivo legible y seguro para el PDF de historia clinica (para la descarga/preview).
export function nombreArchivoPdf(numeroHC?: string, pacienteNombre?: string): string {
  const limpio = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const hc = numeroHC ? limpio(numeroHC) : 'historia';
  const pac = pacienteNombre ? `_${limpio(pacienteNombre)}` : '';
  return `${hc}${pac}.pdf`;
}
