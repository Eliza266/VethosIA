import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolverCodigoPais,
  construirNumeroWhatsApp,
  construirMensajeHistoria,
  construirUrlWhatsApp,
} from './sharing';
import type { Consulta, Paciente } from '../../types';

afterEach(() => vi.unstubAllEnvs());

describe('resolverCodigoPais', () => {
  it('prioriza el codigo del propietario', () => {
    vi.stubEnv('VITE_WHATSAPP_COUNTRY_CODE', '52');
    expect(resolverCodigoPais('1')).toBe('1');
  });
  it('usa el env si no hay del propietario', () => {
    vi.stubEnv('VITE_WHATSAPP_COUNTRY_CODE', '52');
    expect(resolverCodigoPais()).toBe('52');
  });
  it('cae a 57 (Colombia) por defecto', () => {
    expect(resolverCodigoPais()).toBe('57');
  });
});

describe('construirNumeroWhatsApp', () => {
  it('antepone el codigo de pais por defecto', () => {
    expect(construirNumeroWhatsApp('3001234567')).toBe('573001234567');
  });
  it('respeta numero con + (ya trae codigo)', () => {
    expect(construirNumeroWhatsApp('+52 333 444 5566')).toBe('523334445566');
  });
  it('no duplica el codigo si el numero ya empieza con el', () => {
    expect(construirNumeroWhatsApp('573001234567')).toBe('573001234567');
  });
  it('usa el codigo del propietario', () => {
    expect(construirNumeroWhatsApp('3001234567', '52')).toBe('523001234567');
  });
});

describe('construirMensajeHistoria', () => {
  it('arma el mensaje con nombre, paciente y url', () => {
    const msg = construirMensajeHistoria('Ana', 'Firulais', new Date('2024-01-10'), 'http://x/y.pdf');
    expect(msg).toContain('Ana');
    expect(msg).toContain('Firulais');
    expect(msg).toContain('http://x/y.pdf');
  });
});

describe('construirUrlWhatsApp', () => {
  const paciente = {
    nombre: 'Firulais',
    propietario: { nombre: 'Ana', telefono: '3001234567' },
  } as Paciente;
  const consulta = { fechaHora: new Date('2024-01-10') } as Consulta;

  it('arma una url wa.me valida', () => {
    const url = construirUrlWhatsApp({ paciente, consulta, urlPdf: 'http://x/y.pdf' });
    expect(url.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Firulais');
  });

  it('incluye URL de PDF server-side (proxy /pdf/download) en el mensaje', () => {
    const apiPdfUrl = 'http://127.0.0.1:8081/v1/consultas/abc123/pdf/download';
    const url = construirUrlWhatsApp({ paciente, consulta, urlPdf: apiPdfUrl });
    expect(decodeURIComponent(url)).toContain(apiPdfUrl);
    expect(decodeURIComponent(url)).toContain('Ana');
  });
});
