import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('une strings simples', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('ignora valores falsy', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('soporta arrays anidados', () => {
    const hidden: boolean = false;
    expect(cn('a', ['b', ['c', hidden && 'd']])).toBe('a b c');
  });

  it('soporta objetos condicionales', () => {
    expect(cn('base', { activo: true, oculto: false })).toBe('base activo');
  });

  it('devuelve cadena vacia sin entradas validas', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
