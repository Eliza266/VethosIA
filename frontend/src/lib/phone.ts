export interface PaisIndicativo {
  nombre: string;
  code: string;
}

// Paises frecuentes (LatAm + comunes). El numero se guarda como "<indicativo> <digitos>".
export const PAISES_INDICATIVO: PaisIndicativo[] = [
  { nombre: 'Colombia', code: '+57' },
  { nombre: 'Ecuador', code: '+593' },
  { nombre: 'Perú', code: '+51' },
  { nombre: 'México', code: '+52' },
  { nombre: 'Venezuela', code: '+58' },
  { nombre: 'Chile', code: '+56' },
  { nombre: 'Argentina', code: '+54' },
  { nombre: 'Bolivia', code: '+591' },
  { nombre: 'Panamá', code: '+507' },
  { nombre: 'Costa Rica', code: '+506' },
  { nombre: 'Estados Unidos / Canadá', code: '+1' },
  { nombre: 'España', code: '+34' },
];

export const PAIS_DEFAULT: PaisIndicativo = PAISES_INDICATIVO[0];

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Busca el pais por nombre escrito por el usuario (sin tildes, insensible a mayusculas). */
export function buscarPaisPorNombre(nombreEscrito: string): PaisIndicativo | undefined {
  const normalizado = normalizar(nombreEscrito);
  if (!normalizado) return undefined;
  return (
    PAISES_INDICATIVO.find((p) => normalizar(p.nombre) === normalizado) ??
    PAISES_INDICATIVO.find((p) => normalizar(p.nombre).startsWith(normalizado))
  );
}

/** Separa un telefono guardado ("+57 3001234567") en pais + numero. */
export function splitPhone(raw: string | null | undefined): { pais: PaisIndicativo; numero: string } {
  const v = (raw ?? '').trim();
  if (v.startsWith('+')) {
    const ordenados = [...PAISES_INDICATIVO].sort((a, b) => b.code.length - a.code.length);
    for (const it of ordenados) {
      if (v.startsWith(it.code)) {
        return { pais: it, numero: v.slice(it.code.length).replace(/\D/g, '') };
      }
    }
  }
  return { pais: PAIS_DEFAULT, numero: v.replace(/\D/g, '') };
}

/** Arma el telefono a guardar a partir del pais + numero (solo digitos). */
export function joinPhone(pais: PaisIndicativo, numero: string): string {
  const n = (numero ?? '').replace(/\D/g, '');
  return n ? `${pais.code} ${n}` : '';
}
