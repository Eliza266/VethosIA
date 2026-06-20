import { SoapService } from '../../src/modules/ia/soap.service';
import { LlmProvider } from '../../src/modules/ia/providers/provider.interface';
import { normalizarSoap, soapFallback, extraerJson } from '../../src/modules/ia/providers/soap.schema';

const provider = (nombre: string, fn: (prompt: string) => Promise<string>): LlmProvider => ({
  nombre,
  completar: fn,
});

describe('soap.schema', () => {
  it('extraerJson tolera backticks/texto alrededor', () => {
    expect(extraerJson('texto ```json\n{"a":1}\n``` fin')).toEqual({ a: 1 });
    expect(extraerJson('no json')).toBeNull();
  });

  it('normalizarSoap rellena y no inventa: subjetivo vacio cae a transcripcion', () => {
    const soap = normalizarSoap({ motivo: 'tos' }, 'el perro tose');
    expect(soap.motivo).toBe('tos');
    expect(soap.subjetivo).toBe('el perro tose');
    expect(soap.objetivo).toBe('');
    expect(soap.analisis).toBe('');
    expect(soap.diagnosticoEstructurado).toEqual([]);
    expect(soap.signosVitales.peso).toBeNull();
    expect(soap.medicamentosSugeridos).toEqual([]);
  });

  it('normaliza prioridad invalida a rutina y numeros desde string', () => {
    const soap = normalizarSoap(
      { prioridad: 'loquesea', signosVitales: { peso: '12.5' } },
      't',
    );
    expect(soap.prioridad).toBe('rutina');
    expect(soap.signosVitales.peso).toBe(12.5);
  });

  it('normaliza diagnosticos estructurados sugeridos por IA', () => {
    const soap = normalizarSoap(
      {
        diagnosticoEstructurado: [
          {
            nombre: 'Dermatitis alergica',
            tipo: 'principal',
            estado: 'presuntivo',
            sistema: 'piel',
          },
        ],
      },
      't',
    );
    expect(soap.diagnosticoEstructurado[0]).toMatchObject({
      nombre: 'Dermatitis alergica',
      tipo: 'principal',
      estado: 'presuntivo',
      sistema: 'piel',
      origen: 'ia',
    });
  });

  it('soapFallback mete la transcripcion en subjetivo', () => {
    expect(soapFallback('cruda').subjetivo).toBe('cruda');
  });
});

describe('SoapService', () => {
  it('usa el primario cuando devuelve JSON valido', async () => {
    const p = provider('claude', async () => '{"motivo":"tos","prioridad":"urgente","subjetivo":"x"}');
    const svc = new SoapService([p]);
    const soap = await svc.generarSoap('el perro tose');
    expect(soap.motivo).toBe('tos');
    expect(soap.prioridad).toBe('urgente');
  });

  it('reintenta con prompt simple si el primer intento no trae JSON', async () => {
    let llamada = 0;
    const p = provider('claude', async () => {
      llamada++;
      return llamada === 1 ? 'sin json' : '{"motivo":"reintento"}';
    });
    const svc = new SoapService([p]);
    const soap = await svc.generarSoap('t');
    expect(soap.motivo).toBe('reintento');
    expect(llamada).toBe(2);
  });

  it('cae al proveedor fallback si el primario lanza error', async () => {
    const primario = provider('claude', async () => {
      throw new Error('429');
    });
    const fallback = provider('gemini', async () => '{"motivo":"desde-gemini"}');
    const svc = new SoapService([primario, fallback]);
    const soap = await svc.generarSoap('t');
    expect(soap.motivo).toBe('desde-gemini');
  });

  it('si todos fallan, devuelve fallback con la transcripcion', async () => {
    const p1 = provider('claude', async () => 'basura');
    const p2 = provider('gemini', async () => 'mas basura');
    const svc = new SoapService([p1, p2]);
    const soap = await svc.generarSoap('transcripcion cruda');
    expect(soap.subjetivo).toBe('transcripcion cruda');
    expect(soap.prioridad).toBe('rutina');
    expect(soap.diagnosticoEstructurado).toEqual([]);
  });
});
