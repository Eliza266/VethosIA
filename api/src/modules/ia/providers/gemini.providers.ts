import { Injectable } from '@nestjs/common';
import { GeminiService } from '../gemini.service';
import { SttProvider, LlmProvider } from './provider.interface';

// Adaptadores que envuelven el cliente Gemini existente para encajar en las interfaces.
@Injectable()
export class GeminiSttProvider implements SttProvider {
  readonly nombre = 'gemini';
  constructor(private readonly gemini: GeminiService) {}
  transcribir(audioBase64: string, mimeType: string): Promise<string> {
    return this.gemini.transcribir(audioBase64, mimeType);
  }
}

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly nombre = 'gemini';
  constructor(private readonly gemini: GeminiService) {}
  completar(prompt: string): Promise<string> {
    return this.gemini.completarTexto(prompt);
  }
}
