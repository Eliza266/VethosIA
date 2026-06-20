import { Injectable } from '@nestjs/common';
import { SttProvider } from './provider.interface';

// Transcripcion veterinaria realista para desarrollo local sin claves de STT.
export const MOCK_TRANSCRIPCION_VET =
  'Paciente Max, canino mestizo de 4 años. Motivo: vómito desde ayer. ' +
  'El propietario reporta que comió basura en el parque. A la exploración: abdomen blando, ' +
  'mucosas rosadas, temperatura 38.5 grados, peso 12 kilos, frecuencia cardíaca 100 por minuto. ' +
  'Diagnóstico presuntivo: gastroenteritis. Plan: ayuno 12 horas, omeprazol 10 miligramos cada 12 horas por 5 días.';

@Injectable()
export class MockSttProvider implements SttProvider {
  readonly nombre = 'mock';

  async transcribir(_audioBase64: string, _mimeType: string): Promise<string> {
    return MOCK_TRANSCRIPCION_VET;
  }
}
