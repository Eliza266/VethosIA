import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertAudioPathPermitido } from '../../src/common/storage/audio-path';

describe('assertAudioPathPermitido', () => {
  const ctx = { uid: 'vetA', orgId: 'orgA' };

  it('permite audio del propio uid', () => {
    expect(() => assertAudioPathPermitido('audios/vetA/consulta.webm', ctx)).not.toThrow();
  });

  it('permite audio de la org', () => {
    expect(() => assertAudioPathPermitido('audios/orgA/consulta.webm', ctx)).not.toThrow();
  });

  it('rechaza audio de otro tenant (cross-tenant)', () => {
    expect(() => assertAudioPathPermitido('audios/vetB/consulta.webm', ctx)).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza path con traversal', () => {
    expect(() => assertAudioPathPermitido('audios/vetA/../vetB/x.webm', ctx)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza rutas fuera de audios/', () => {
    expect(() => assertAudioPathPermitido('historiales/orgA/x.pdf', ctx)).toThrow(
      BadRequestException,
    );
  });
});
