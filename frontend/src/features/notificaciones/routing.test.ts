import { describe, expect, it } from 'vitest';
import { etiquetaNotificacion, rutaNotificacion } from './routing';

describe('rutaNotificacion', () => {
  it('usa pacienteId y consultaId para navegar al detalle de consulta', () => {
    expect(
      rutaNotificacion({
        resourceType: 'consulta',
        resourceId: 'c1',
        resourcePath: 'consultas/c1',
        pacienteId: 'p1',
        consultaId: 'c1',
      }),
    ).toBe('/pacientes/p1/consultas/c1');
  });

  it('cae a ficha de paciente cuando falta consultaId', () => {
    expect(
      rutaNotificacion({
        resourceType: 'consulta',
        resourceId: 'c1',
        pacienteId: 'p1',
      }),
    ).toBe('/pacientes/p1');
  });

  it('mantiene fallback seguro para consultas legacy sin pacienteId', () => {
    expect(
      rutaNotificacion({
        resourceType: 'consulta',
        resourceId: 'c1',
        resourcePath: 'consultas/c1',
      }),
    ).toBe('/pacientes');
  });

  it('dirige consumo y suscripcion a la ruta canonica existente', () => {
    expect(
      rutaNotificacion({
        resourceType: 'consumo',
        resourceId: 'entA_2026-06',
        resourcePath: 'consumos/entA_2026-06',
      }),
    ).toBe('/suscripcion');
    expect(
      rutaNotificacion({
        resourceType: 'suscripcion',
        resourceId: 'sub1',
        resourcePath: 'suscripciones/sub1',
      }),
    ).toBe('/suscripcion');
  });

  it('rechaza rutas directas que no son pantallas reales del frontend', () => {
    expect(
      rutaNotificacion({
        resourceType: 'sistema',
        resourcePath: '/sistema/jobs/run',
      }),
    ).toBeNull();
  });

  it('etiqueta tipos de sistema', () => {
    expect(etiquetaNotificacion('cita_recordatorio')).toBe('Cita');
    expect(etiquetaNotificacion('vacunas_pendientes')).toBe('Vacuna');
    expect(etiquetaNotificacion('consumo_100')).toBe('Consumo');
    expect(etiquetaNotificacion('suscripcion_vencida')).toBe('Suscripción');
    expect(etiquetaNotificacion('invitacion_expirada')).toBe('Invitacion');
  });
});
