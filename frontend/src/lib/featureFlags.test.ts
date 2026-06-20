import { describe, it, expect, afterEach, vi } from 'vitest';
import { getFeatureFlags } from './featureFlags';

afterEach(() => vi.unstubAllEnvs());

describe('getFeatureFlags', () => {
  it('por defecto TODO apagado (comportamiento legacy)', () => {
    vi.stubEnv('VITE_USE_API_HC', '');
    vi.stubEnv('VITE_USE_API_IA', '');
    vi.stubEnv('VITE_USE_API_DOCS', '');
    vi.stubEnv('VITE_USE_API_CRUD', '');
    expect(getFeatureFlags()).toEqual({
      useApiHC: false,
      useApiIA: false,
      useApiDocs: false,
      useApiCRUD: false,
      emailRealEnabled: false,
    });
  });

  it('reconoce "true"', () => {
    vi.stubEnv('VITE_USE_API_IA', 'true');
    expect(getFeatureFlags().useApiIA).toBe(true);
  });

  it('reconoce variantes (1, on, yes, mayusculas)', () => {
    vi.stubEnv('VITE_USE_API_HC', '1');
    vi.stubEnv('VITE_USE_API_DOCS', 'ON');
    const f = getFeatureFlags();
    expect(f.useApiHC).toBe(true);
    expect(f.useApiDocs).toBe(true);
  });

  it('cualquier otra cosa es false', () => {
    vi.stubEnv('VITE_USE_API_IA', 'maybe');
    expect(getFeatureFlags().useApiIA).toBe(false);
  });
});
