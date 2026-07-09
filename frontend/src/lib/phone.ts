export interface PaisIndicativo {
  nombre: string;
  code: string;
  bandera: string;
}

// Paises frecuentes (LatAm + comunes). El numero se guarda como "<indicativo> <digitos>".
export const PAISES_INDICATIVO: PaisIndicativo[] = [
  { nombre: 'Colombia', code: '+57', bandera: '🇨🇴' },
  { nombre: 'Ecuador', code: '+593', bandera: '🇪🇨' },
  { nombre: 'Perú', code: '+51', bandera: '🇵🇪' },
  { nombre: 'México', code: '+52', bandera: '🇲🇽' },
  { nombre: 'Venezuela', code: '+58', bandera: '🇻🇪' },
  { nombre: 'Chile', code: '+56', bandera: '🇨🇱' },
  { nombre: 'Argentina', code: '+54', bandera: '🇦🇷' },
  { nombre: 'Bolivia', code: '+591', bandera: '🇧🇴' },
  { nombre: 'Panamá', code: '+507', bandera: '🇵🇦' },
  { nombre: 'Costa Rica', code: '+506', bandera: '🇨🇷' },
  { nombre: 'Estados Unidos / Canadá', code: '+1', bandera: '🇺🇸' },
  { nombre: 'España', code: '+34', bandera: '🇪🇸' },
];

export const PAIS_DEFAULT: PaisIndicativo = PAISES_INDICATIVO[0];

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
