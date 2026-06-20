import * as fs from 'fs';
import * as path from 'path';
import {
  formatoNumeroHcV2,
  legacyCallableUsesGlobalHcCounter,
  resolveHcCounterV2,
} from '../../src/modules/consultas/hc-v2';

describe('HC V2 accountId counter helpers', () => {
  it('particiona contador de vet independiente por accountId', () => {
    expect(
      resolveHcCounterV2({
        accountType: 'vet_individual',
        accountId: 'vet_u1',
      }),
    ).toMatchObject({
      docId: 'contadorHC_vet_u1',
      path: 'configuracion/contadorHC_vet_u1',
      accountId: 'vet_u1',
    });
  });

  it('particiona veterinaria bajo entidad por accountId de veterinaria, no por entidad', () => {
    expect(
      resolveHcCounterV2({
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        entidadId: 'ent_1',
        veterinariaId: 'vetclin_1',
      }),
    ).toMatchObject({
      docId: 'contadorHC_vetclin_1',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
    });
  });

  it('particiona freelance directo de entidad por accountId de entidad', () => {
    expect(
      resolveHcCounterV2({
        accountType: 'entidad',
        accountId: 'ent_1',
        entidadId: 'ent_1',
      }),
    ).toMatchObject({
      docId: 'contadorHC_ent_1',
      accountId: 'ent_1',
      entidadId: 'ent_1',
    });
  });

  it('rechaza contador sin accountId', () => {
    expect(() => resolveHcCounterV2({ accountType: 'veterinaria' })).toThrow(/accountId/);
  });

  it('mantiene formato historico HC000001', () => {
    expect(formatoNumeroHcV2(1)).toBe('HC000001');
    expect(formatoNumeroHcV2(42)).toBe('HC000042');
  });

  it('caracteriza que callable legacy usa contador global y no contador V2 por accountId', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../functions/index.js'), 'utf8');
    expect(legacyCallableUsesGlobalHcCounter(source)).toBe(true);
  });
});
