import type { DatosDetectadosConsulta, Paciente } from '../../types';

const ACENTOS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };

const normalizar = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (c) => ACENTOS[c] ?? c);

// Consulta rapida (Opcion B): la IA detecto un nombre de mascota en el audio; buscamos si
// ya existe un paciente real (no placeholder) con ese mismo nombre para ofrecer vincular
// en vez de duplicar. Coincidencia exacta por nombre (normalizado); si hay varios con el
// mismo nombre, se desempata por nombre de propietario cuando la IA tambien lo detecto.
export const buscarPacienteCoincidente = (
  datos: DatosDetectadosConsulta | undefined,
  pacientes: Paciente[],
  excluirId?: string
): Paciente | null => {
  const nombrePaciente = datos?.nombrePaciente?.trim();
  if (!nombrePaciente) return null;
  const nombreNorm = normalizar(nombrePaciente);

  const candidatos = pacientes.filter(
    (p) => p.id !== excluirId && !p.esPlaceholder && normalizar(p.nombre) === nombreNorm
  );
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  const nombrePropietario = datos?.nombrePropietario?.trim();
  if (nombrePropietario) {
    const propNorm = normalizar(nombrePropietario);
    const porDueno = candidatos.find((p) => normalizar(p.propietario.nombre || '') === propNorm);
    if (porDueno) return porDueno;
  }
  return candidatos[0];
};

// Mapea la especie libre que devuelve la IA a las opciones cerradas que acepta Paciente.
export const mapEspecieDetectada = (especie?: string | null): Paciente['especie'] => {
  const norm = especie ? normalizar(especie) : '';
  if (norm.startsWith('perr') || norm === 'canino') return 'perro';
  if (norm.startsWith('gat') || norm === 'felino') return 'gato';
  if (norm.startsWith('ave') || norm.includes('pajaro') || norm.includes('loro')) return 'ave';
  if (norm.startsWith('reptil') || norm.includes('tortuga') || norm.includes('iguana')) return 'reptil';
  return 'otro';
};
