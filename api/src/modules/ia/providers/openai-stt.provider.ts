import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { SttProvider } from './provider.interface';

// STT primario: OpenAI (gpt-4o-transcribe / whisper). Mejor para audio clinico en español.
// Recibe base64 + mimeType, arma multipart y devuelve la transcripcion.
@Injectable()
export class OpenAiSttProvider implements SttProvider {
  readonly nombre = 'openai';

  private get apiKey(): string {
    return process.env.OPENAI_API_KEY ?? '';
  }
  private get model(): string {
    return process.env.OPENAI_STT_MODEL ?? 'gpt-4o-transcribe';
  }

  async transcribir(audioBase64: string, mimeType: string): Promise<string> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY no configurada.');
    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = this.extDe(mimeType);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
    form.append('model', this.model);
    form.append('language', 'es');
    form.append('response_format', 'text');

    const { data } = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      maxBodyLength: Infinity,
    });
    // con response_format=text la API devuelve el texto plano; con json, {text}.
    const texto = typeof data === 'string' ? data : (data?.text ?? '');
    return String(texto).trim();
  }

  private extDe(mimeType: string): string {
    if (!mimeType) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
  }
}
