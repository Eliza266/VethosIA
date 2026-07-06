import { IsString, MaxLength, MinLength } from 'class-validator';

// ~15mb de PDF en base64 (los examenes de laboratorio suelen ser pocas paginas escaneadas).
export const MAX_EXAMEN_PDF_BASE64 = 20_000_000;

// body de POST /v1/consultas/:id/examenes. PDF inline en base64 (mismo patron que el audio).
export class SubirExamenDto {
  @IsString()
  @MinLength(1, { message: 'nombre es requerido.' })
  nombre!: string;

  @IsString()
  @MinLength(1, { message: 'pdfBase64 es requerido.' })
  @MaxLength(MAX_EXAMEN_PDF_BASE64, { message: 'El PDF es demasiado grande.' })
  pdfBase64!: string;
}
