import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpiamos el DOM despues de cada test para que no se pisen los renders.
afterEach(() => {
  cleanup();
});
