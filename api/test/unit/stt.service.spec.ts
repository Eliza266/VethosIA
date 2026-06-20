import { SttService } from '../../src/modules/ia/stt.service';
import { SttProvider } from '../../src/modules/ia/providers/provider.interface';

const stt = (nombre: string, fn: (b: string, m: string) => Promise<string>): SttProvider => ({
  nombre,
  transcribir: fn,
});

describe('SttService (fallback)', () => {
  it('usa el primario si funciona y le pasa el mimeType', async () => {
    const recibido: string[] = [];
    const primario = stt('openai', async (_b, m) => {
      recibido.push(m);
      return 'transcripcion openai';
    });
    const svc = new SttService([primario]);
    const out = await svc.transcribir('base64', 'audio/ogg');
    expect(out).toBe('transcripcion openai');
    expect(recibido).toEqual(['audio/ogg']);
  });

  it('cae al fallback si el primario falla', async () => {
    const primario = stt('openai', async () => {
      throw new Error('down');
    });
    const fallback = stt('gemini', async () => 'transcripcion gemini');
    const svc = new SttService([primario, fallback]);
    const out = await svc.transcribir('b', 'audio/webm');
    expect(out).toBe('transcripcion gemini');
  });

  it('cae al fallback si el primario devuelve vacio', async () => {
    const primario = stt('openai', async () => '   ');
    const fallback = stt('gemini', async () => 'ok');
    const svc = new SttService([primario, fallback]);
    expect(await svc.transcribir('b', 'm')).toBe('ok');
  });

  it('si todos fallan, lanza error', async () => {
    const p = stt('openai', async () => {
      throw new Error('x');
    });
    const svc = new SttService([p]);
    await expect(svc.transcribir('b', 'm')).rejects.toThrow(/STT/);
  });
});
