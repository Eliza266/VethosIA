// Cola de audios para PWA: si se graba sin conexion, el audio se encola localmente y se
// sube al reconectar (background sync). Abstraemos el almacenamiento (KVStore) para poder
// testear con un store en memoria y, en runtime, usar IndexedDB.
export interface AudioPendiente {
  id: string;
  consultaId: string;
  blob: Blob;
  mimeType: string;
  creadoEn: number;
}

export interface KVStore {
  set(id: string, value: AudioPendiente): Promise<void>;
  getAll(): Promise<AudioPendiente[]>;
  delete(id: string): Promise<void>;
}

// Store en memoria (default para tests / fallback sin IndexedDB).
export class MemoryKV implements KVStore {
  private map = new Map<string, AudioPendiente>();
  async set(id: string, value: AudioPendiente): Promise<void> {
    this.map.set(id, value);
  }
  async getAll(): Promise<AudioPendiente[]> {
    return [...this.map.values()];
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

export class OfflineAudioQueue {
  private readonly store: KVStore;
  constructor(store: KVStore = new MemoryKV()) {
    this.store = store;
  }

  async encolar(consultaId: string, blob: Blob, mimeType: string): Promise<string> {
    const id = `${consultaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.store.set(id, { id, consultaId, blob, mimeType, creadoEn: Date.now() });
    return id;
  }

  async pendientes(): Promise<AudioPendiente[]> {
    return this.store.getAll();
  }

  async contar(): Promise<number> {
    return (await this.store.getAll()).length;
  }

  // Sube todos los pendientes con la funcion dada. Si una subida falla, ese item se queda
  // en la cola (se reintenta en el proximo flush / reconexion). Devuelve cuantos subio.
  async flush(subir: (item: AudioPendiente) => Promise<void>): Promise<number> {
    let subidos = 0;
    for (const item of await this.store.getAll()) {
      try {
        await subir(item);
        await this.store.delete(item.id);
        subidos++;
      } catch {
        // se mantiene en la cola para el proximo intento.
      }
    }
    return subidos;
  }
}
