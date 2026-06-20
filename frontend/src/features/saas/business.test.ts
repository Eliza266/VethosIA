import { describe, expect, it } from 'vitest';
import {
  consumoPorcentaje,
  consumoScopeLabel,
  estadoCuentaVisual,
  formatBusinessDate,
  formatCOPFromCents,
  puedeVerResumenNegocio,
} from './business';

describe('saas business helpers', () => {
  it('normaliza estados de cuenta visibles', () => {
    expect(estadoCuentaVisual('activa').label).toBe('Al día');
    expect(estadoCuentaVisual('por_vencer').label).toBe('Por vencer');
    expect(estadoCuentaVisual('bloqueada_mora').label).toBe('Bloqueado');
    expect(estadoCuentaVisual(null).label).toBe('Sin suscripción');
  });

  it('calcula consumo y etiqueta scope por rol sin activar runtime V2', () => {
    expect(consumoPorcentaje({ usados: 8, limite: 10, porcentaje: 80 })).toBe(80);
    expect(consumoPorcentaje({ usados: 12, limite: 10, porcentaje: 140 })).toBe(100);
    expect(consumoScopeLabel('admin_entidad')).toBe('Consumo agregado entidad');
    expect(consumoScopeLabel('admin_veterinaria')).toBe('Consumo de veterinaria');
    expect(consumoScopeLabel('vet')).toBe('Consumo personal/cuenta');
    expect(puedeVerResumenNegocio('asistente')).toBe(false);
    expect(puedeVerResumenNegocio({ rol: 'vet', orgId: 'iVQURlMlESO5af6hbQ8I' })).toBe(false);
    expect(puedeVerResumenNegocio({ rol: 'vet', orgId: null })).toBe(true);
  });

  it('formatea fechas y montos de pago', () => {
    expect(formatBusinessDate({ seconds: 1781654400 })).toMatch(/2026|jun/i);
    expect(formatCOPFromCents(1234500)).toBe('12.345 COP');
    expect(formatCOPFromCents(undefined)).toBe('Monto no disponible');
  });
});
