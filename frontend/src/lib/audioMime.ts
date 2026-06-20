// Selecciona el mimeType de grabacion realmente soportado por el navegador. Antes el
// codigo legacy hardcodeaba 'audio/webm' (rompia en Safari, que usa mp4). Inyectamos
// isSupported para poder testear sin un MediaRecorder real.
export const CANDIDATOS_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4'] as const;

export function pickSupportedAudioMime(
  candidatos: readonly string[] = CANDIDATOS_AUDIO,
  isSupported: (m: string) => boolean = (m) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
): string {
  for (const m of candidatos) {
    if (isSupported(m)) return m;
  }
  return ''; // que el navegador elija su default
}
