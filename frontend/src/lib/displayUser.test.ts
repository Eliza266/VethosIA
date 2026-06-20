import { describe, it, expect } from 'vitest';
import { displayUserLabel, isGenericDisplayName } from './displayUser';

describe('displayUserLabel', () => {
  it('usa nombre cuando no es genérico', () => {
    expect(displayUserLabel({ nombre: 'Gerencia Vethosia', email: 'a@b.com' })).toBe(
      'Gerencia Vethosia',
    );
  });

  it('cae a email si nombre es Veterinario', () => {
    expect(displayUserLabel({ nombre: 'Veterinario', email: 'gerencia@vethosia.com' })).toBe(
      'gerencia@vethosia.com',
    );
  });

  it('cae a Usuario si no hay datos', () => {
    expect(displayUserLabel({ nombre: null, email: null })).toBe('Usuario');
  });
});

describe('isGenericDisplayName', () => {
  it('detecta Veterinario', () => {
    expect(isGenericDisplayName('Veterinario')).toBe(true);
    expect(isGenericDisplayName('Ana')).toBe(false);
  });
});
