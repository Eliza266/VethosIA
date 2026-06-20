import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { loadAppConfig } from '../../common/config/env';

export interface AudioDescargado {
  buffer: Buffer;
  contentType: string;
}

// Todo lo que toca el bucket de Storage pasa por aca.
@Injectable()
export class StorageService {
  private readonly useEmulators = loadAppConfig().useEmulators;

  constructor(private readonly firebase: FirebaseService) {}

  // Sube un buffer (ej. el PDF generado) a una ruta del bucket.
  async subirBuffer(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const file = this.firebase.bucket().file(path);
    await file.save(buffer, { contentType, resumable: false });
  }

  // Lee un objeto del bucket (ej. el audio que subio el cliente a audios/{uid}/...).
  async descargar(path: string): Promise<AudioDescargado> {
    const file = this.firebase.bucket().file(path);
    const [meta] = await file.getMetadata();
    const [buffer] = await file.download();
    return { buffer, contentType: meta.contentType ?? 'application/octet-stream' };
  }

  // Signed URL temporal de lectura. En el emulador no se pueden firmar URLs (no hay
  // credenciales de service account), asi que devolvemos una URL directa del emulador.
  async signedUrl(path: string, expiraMs = 60 * 60 * 1000): Promise<string> {
    if (this.useEmulators) {
      const host = process.env.STORAGE_EMULATOR_HOST ?? 'http://127.0.0.1:9199';
      const bucket = this.firebase.bucket().name;
      return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
    }
    const file = this.firebase.bucket().file(path);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiraMs,
    });
    return url;
  }
}
