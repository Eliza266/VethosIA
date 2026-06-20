import { describe, it, expect } from 'vitest';
import { pickSupportedAudioMime } from './audioMime';

describe('pickSupportedAudioMime', () => {
  it('elige webm cuando esta soportado', () => {
    expect(pickSupportedAudioMime(undefined, (m) => m === 'audio/webm')).toBe('audio/webm');
  });

  it('cae a mp4 en navegadores tipo Safari (sin webm/ogg)', () => {
    expect(pickSupportedAudioMime(undefined, (m) => m === 'audio/mp4')).toBe('audio/mp4');
  });

  it('devuelve "" si ninguno esta soportado (default del navegador)', () => {
    expect(pickSupportedAudioMime(undefined, () => false)).toBe('');
  });

  it('respeta el orden de preferencia', () => {
    expect(pickSupportedAudioMime(undefined, () => true)).toBe('audio/webm');
  });
});
