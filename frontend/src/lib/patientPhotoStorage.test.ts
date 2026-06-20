import { describe, expect, it } from 'vitest';
import { buildPatientPhotoStoragePath } from './patientPhotoStorage';

describe('buildPatientPhotoStoragePath', () => {
  it('usa orgId, pacienteId y extension del archivo', () => {
    const file = new File(['x'], 'mascota.png', { type: 'image/png' });
    expect(buildPatientPhotoStoragePath('orgA', 'pac1', file)).toBe(
      'fotos-pacientes/orgA/pac1/foto.png',
    );
  });

  it('cae a jpg si la extension no es segura', () => {
    const file = new File(['x'], 'evil.exe', { type: 'image/jpeg' });
    expect(buildPatientPhotoStoragePath('orgA', 'pac1', file)).toBe(
      'fotos-pacientes/orgA/pac1/foto.jpg',
    );
  });
});
