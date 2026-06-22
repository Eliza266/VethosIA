import { IsOptional, IsString, MaxLength, IsArray, ArrayMaxSize } from 'class-validator';
import { MAX_AUDIO_BASE64 } from './transcribir.dto';

// body de POST /v1/consultas/:id/procesar (encola el pipeline async de IA).
// Preferido: audioPath (Storage). El base64 inline tiene tope de tamaño.
export class ProcesarConsultaDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  audioPaths?: string[];
  @IsOptional()
  @IsString()
  audioPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AUDIO_BASE64, {
    message: 'Audio inline demasiado grande; sube el audio a Storage y envia audioPath.',
  })
  audioBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
