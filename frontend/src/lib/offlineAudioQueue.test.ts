import { describe, it, expect, vi } from 'vitest';
import { OfflineAudioQueue, MemoryKV } from './offlineAudioQueue';

const blob = () => new Blob(['x'], { type: 'audio/webm' });

describe('OfflineAudioQueue', () => {
  it('encola audios y los cuenta', async () => {
    const q = new OfflineAudioQueue(new MemoryKV());
    await q.encolar('c1', blob(), 'audio/webm');
    await q.encolar('c2', blob(), 'audio/webm');
    expect(await q.contar()).toBe(2);
  });

  it('flush sube y vacia la cola cuando la subida tiene exito', async () => {
    const q = new OfflineAudioQueue(new MemoryKV());
    await q.encolar('c1', blob(), 'audio/webm');
    const subir = vi.fn().mockResolvedValue(undefined);
    const n = await q.flush(subir);
    expect(n).toBe(1);
    expect(await q.contar()).toBe(0);
    expect(subir).toHaveBeenCalledTimes(1);
  });

  it('si la subida falla, el item permanece para reintentar', async () => {
    const q = new OfflineAudioQueue(new MemoryKV());
    await q.encolar('c1', blob(), 'audio/webm');
    const subir = vi.fn().mockRejectedValue(new Error('offline'));
    const n = await q.flush(subir);
    expect(n).toBe(0);
    expect(await q.contar()).toBe(1);
  });
});
