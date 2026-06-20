import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LlmProvider } from './provider.interface';

// LLM primario: Claude (Anthropic). Caballo de batalla por costo/calidad para estructurar SOAP.
@Injectable()
export class ClaudeLlmProvider implements LlmProvider {
  readonly nombre = 'anthropic';

  private get apiKey(): string {
    return process.env.ANTHROPIC_API_KEY ?? '';
  }
  private get model(): string {
    return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  }

  async completar(prompt: string): Promise<string> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY no configurada.');
    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      },
    );
    // Anthropic devuelve content: [{ type:'text', text:'...' }]
    const bloques = (data?.content ?? []) as Array<{ type?: string; text?: string }>;
    return bloques
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }
}
