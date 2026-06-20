import { describe, it, expect } from 'vitest';
import { toDate, toDateOrNull, serializeDate, mapDates } from './mappers';

describe('toDate', () => {
  it('devuelve el mismo Date si ya es Date', () => {
    const d = new Date('2024-01-01');
    expect(toDate(d)).toBe(d);
  });

  it('convierte un Timestamp de Firestore (objeto con toDate)', () => {
    const d = new Date('2024-05-05');
    const ts = { toDate: () => d };
    expect(toDate(ts)).toBe(d);
  });

  it('convierte string ISO', () => {
    expect(toDate('2024-03-03T00:00:00.000Z').toISOString()).toBe('2024-03-03T00:00:00.000Z');
  });

  it('convierte epoch ms', () => {
    const ms = 1700000000000;
    expect(toDate(ms).getTime()).toBe(ms);
  });

  it('devuelve una fecha (ahora) si el valor es null/undefined', () => {
    expect(toDate(undefined)).toBeInstanceOf(Date);
    expect(toDate(null)).toBeInstanceOf(Date);
  });
});

describe('toDateOrNull', () => {
  it('conserva null/undefined', () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
  });
  it('convierte si hay valor', () => {
    expect(toDateOrNull('2024-01-01')).toBeInstanceOf(Date);
  });
});

describe('serializeDate', () => {
  it('serializa a ISO', () => {
    expect(serializeDate(new Date('2024-02-02T00:00:00.000Z'))).toBe('2024-02-02T00:00:00.000Z');
  });
});

describe('mapDates', () => {
  it('convierte solo los campos indicados', () => {
    const d = new Date('2024-01-01');
    const out = mapDates({ creadoEn: { toDate: () => d }, otro: 'x' }, ['creadoEn']);
    expect(out.creadoEn).toBe(d);
    expect(out.otro).toBe('x');
  });
});
