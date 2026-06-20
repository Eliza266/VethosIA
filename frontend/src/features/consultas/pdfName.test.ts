import { describe, it, expect } from 'vitest';
import { nombreArchivoPdf } from './pdfName';

describe('nombreArchivoPdf', () => {
  it('combina numeroHC y paciente, saneando acentos/espacios', () => {
    expect(nombreArchivoPdf('HC000010', 'Rex Júnior')).toBe('HC000010_Rex_Junior.pdf');
  });
  it('usa defaults cuando faltan datos', () => {
    expect(nombreArchivoPdf()).toBe('historia.pdf');
    expect(nombreArchivoPdf('HC1')).toBe('HC1.pdf');
  });
  it('elimina caracteres peligrosos', () => {
    expect(nombreArchivoPdf('../../etc', 'a/b')).toBe('etc_a_b.pdf');
  });
});
