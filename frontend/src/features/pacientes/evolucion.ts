import type { Consulta, SignosVitales } from '../../types';

export interface PuntoEvolucionClinica {
  consultaId?: string;
  fechaHora: Date;
  fechaLabel: string;
  numeroHC?: string;
  peso?: number;
  talla?: number;
  temperatura?: number;
  frecuenciaCardiaca?: number;
  frecuenciaRespiratoria?: number;
  pulso?: string;
}

export interface TendenciaPeso {
  estado: 'sube' | 'baja' | 'estable';
  deltaKg: number;
}

export interface EvolucionClinica {
  puntos: PuntoEvolucionClinica[];
  ultimo: PuntoEvolucionClinica | null;
  tendenciaPeso: TendenciaPeso | null;
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const tieneDatoClinico = (sv?: SignosVitales): boolean => {
  if (!sv) return false;
  return [
    toNumber(sv.peso),
    toNumber(sv.talla),
    toNumber(sv.temperatura),
    toNumber(sv.frecuenciaCardiaca),
    toNumber(sv.frecuenciaRespiratoria),
    toText(sv.pulso),
  ].some((value) => value !== undefined);
};

const puntoDesdeConsulta = (consulta: Consulta): PuntoEvolucionClinica | null => {
  if (!tieneDatoClinico(consulta.signosVitales)) return null;
  const sv = consulta.signosVitales ?? {};
  const fechaHora = new Date(consulta.fechaHora);
  const peso = toNumber(sv.peso);
  const talla = toNumber(sv.talla);
  const temperatura = toNumber(sv.temperatura);
  const frecuenciaCardiaca = toNumber(sv.frecuenciaCardiaca);
  const frecuenciaRespiratoria = toNumber(sv.frecuenciaRespiratoria);
  const pulso = toText(sv.pulso);
  return {
    fechaHora,
    fechaLabel: fechaHora.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    ...(consulta.id ? { consultaId: consulta.id } : {}),
    ...(consulta.numeroHC ? { numeroHC: consulta.numeroHC } : {}),
    ...(peso !== undefined ? { peso } : {}),
    ...(talla !== undefined ? { talla } : {}),
    ...(temperatura !== undefined ? { temperatura } : {}),
    ...(frecuenciaCardiaca !== undefined ? { frecuenciaCardiaca } : {}),
    ...(frecuenciaRespiratoria !== undefined ? { frecuenciaRespiratoria } : {}),
    ...(pulso ? { pulso } : {}),
  };
};

const calcularTendenciaPeso = (puntos: PuntoEvolucionClinica[]): TendenciaPeso | null => {
  const pesos = puntos.filter((p) => p.peso !== undefined);
  if (pesos.length < 2) return null;
  const anterior = pesos[pesos.length - 2].peso!;
  const actual = pesos[pesos.length - 1].peso!;
  const deltaKg = Number((actual - anterior).toFixed(2));
  if (Math.abs(deltaKg) < 0.05) return { estado: 'estable', deltaKg: 0 };
  return { estado: deltaKg > 0 ? 'sube' : 'baja', deltaKg };
};

export const construirEvolucionClinica = (consultas: Consulta[]): EvolucionClinica => {
  const puntos = consultas
    .slice()
    .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
    .map(puntoDesdeConsulta)
    .filter((p): p is PuntoEvolucionClinica => p !== null);

  return {
    puntos,
    ultimo: puntos[puntos.length - 1] ?? null,
    tendenciaPeso: calcularTendenciaPeso(puntos),
  };
};
