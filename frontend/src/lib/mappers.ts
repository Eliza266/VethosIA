import { Timestamp } from 'firebase/firestore';

// Conversion Timestamp <-> Date centralizada. Antes este snippet
// `data.x?.toDate ? data.x.toDate() : new Date(data.x)` estaba copy-pasteado en
// usePacientes, useConsultas, useBrigadas, useAuth, DetalleConsulta... una sola
// funcion evita que se desincronicen.

type TimestampLike = { toDate: () => Date };

const isTimestampLike = (value: unknown): value is TimestampLike =>
  !!value && typeof value === 'object' && typeof (value as TimestampLike).toDate === 'function';

/**
 * Normaliza cualquier representacion de fecha que venga de Firestore
 * (Timestamp, Date, string ISO, epoch ms) a un Date de JS.
 * Si no hay nada, devuelve la fecha actual (mismo comportamiento que el codigo viejo).
 */
export const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (isTimestampLike(value)) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
};

/**
 * Igual que toDate pero conserva null/undefined (para campos opcionales donde
 * "no hay fecha" es distinto de "ahora").
 */
export const toDateOrNull = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  return toDate(value);
};

/**
 * Pasa un Date a Timestamp de Firestore. Firestore acepta Date directo, pero ser
 * explicitos ayuda cuando escribimos contra la API o serializamos a JSON.
 */
export const toTimestamp = (date: Date): Timestamp => Timestamp.fromDate(date);

/** Serializa un Date a string ISO para mandarlo por la API. */
export const serializeDate = (date: Date): string => date.toISOString();

/**
 * Aplica toDate a un set de campos de un documento crudo de Firestore.
 * Devuelve un objeto nuevo con esos campos convertidos a Date.
 */
export const mapDates = <T extends Record<string, unknown>>(
  data: T,
  fields: string[]
): T => {
  const out = { ...data } as Record<string, unknown>;
  for (const field of fields) {
    if (field in out) out[field] = toDate(out[field]);
  }
  return out as T;
};
