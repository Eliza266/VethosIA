import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// Tope de base64 inline (~1.5MB binario). Para audios mas grandes se EXIGE audioPath
// (subir a Storage), para no inflar memoria/payload del request.
export const MAX_AUDIO_BASE64 = 2_000_000;

// body de POST /v1/ia/transcribir. O mandas audioPath (preferido) o audioBase64.
export class TranscribirDto {
  // ruta en Storage del audio ya subido por el cliente (audios/{uid}/...).
  @IsOptional()
  @IsString()
  audioPath?: string;

  // alternativa inline SOLO para audios cortos (con tope de tamaño).
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AUDIO_BASE64, {
    message: 'Audio inline demasiado grande; sube el audio a Storage y envia audioPath.',
  })
  audioBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  // al menos uno de los dos debe venir.
  @ValidateIf((o: TranscribirDto) => !o.audioPath && !o.audioBase64)
  @IsString({ message: 'Debes enviar audioPath o audioBase64.' })
  readonly _requiereAudio?: string;
}
