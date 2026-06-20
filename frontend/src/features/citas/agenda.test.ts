import { describe, it, expect } from 'vitest';
import { citasEnVista, agruparPorDia, inicioSemana, type CitaLike } from './agenda';

const citas: CitaLike[] = [
  { id: 'a', fecha: '2026-06-15T09:00:00Z' }, // lunes
  { id: 'b', fecha: '2026-06-15T15:00:00Z' },
  { id: 'c', fecha: '2026-06-18T10:00:00Z' }, // jueves misma semana
  { id: 'd', fecha: '2026-07-02T10:00:00Z' }, // otro mes
];

describe('agenda', () => {
  const ref = new Date('2026-06-15T12:00:00Z');

  it('vista dia: solo las del mismo dia', () => {
    const r = citasEnVista(citas, 'dia', ref).map((c) => c.id);
    expect(r.sort()).toEqual(['a', 'b']);
  });

  it('vista semana: lunes a domingo', () => {
    const r = citasEnVista(citas, 'semana', ref).map((c) => c.id);
    expect(r.sort()).toEqual(['a', 'b', 'c']);
  });

  it('vista mes: todas las de junio', () => {
    const r = citasEnVista(citas, 'mes', ref).map((c) => c.id);
    expect(r.sort()).toEqual(['a', 'b', 'c']);
  });

  it('inicioSemana cae en lunes', () => {
    expect(inicioSemana(ref).getDay()).toBe(1);
  });

  it('agruparPorDia agrupa por fecha local', () => {
    const grupos = agruparPorDia(citas);
    expect(Object.keys(grupos).length).toBeGreaterThanOrEqual(3);
  });
});
