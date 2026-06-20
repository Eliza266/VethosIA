import { Inject, Injectable, Logger } from '@nestjs/common';
import { STT_PROVIDERS, SttProvider } from './providers/provider.interface';

// Orquesta los proveedores STT en orden: si el primario falla, cae al siguiente.
// Asi mezclamos lo mejor de cada vendor sin atarnos a uno.
@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  constructor(@Inject(STT_PROVIDERS) private readonly providers: SttProvider[]) {}

  async transcribir(audioBase64: string, mimeType: string): Promise<string> {
    if (this.providers.length === 0) throw new Error('No hay proveedores STT configurados.');
    let ultimoError: unknown;
    for (const p of this.providers) {
      try {
        const texto = await p.transcribir(audioBase64, mimeType);
        if (texto && texto.trim()) return texto.trim();
        this.logger.warn(`STT ${p.nombre} devolvio vacio, probando siguiente.`);
      } catch (err) {
        ultimoError = err;
        this.logger.warn(`STT ${p.nombre} fallo: ${(err as Error).message}. Probando fallback.`);
      }
    }
    throw new Error(
      `Todos los proveedores STT fallaron. Ultimo error: ${(ultimoError as Error)?.message ?? 'desconocido'}`,
    );
  }
}
