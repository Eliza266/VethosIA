import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// ~15mb de archivo en base64 (los examenes de laboratorio suelen ser pocas paginas escaneadas).
export const MAX_EXAMEN_PDF_BASE64 = 20_000_000;

export const MIME_TYPES_EXAMEN = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

// body de POST /v1/consultas/:id/examenes. Archivo inline en base64 (mismo patron que el
// audio). Acepta PDF o imagen (foto de un resultado impreso); mimeType decide como se
// resume con IA y con que content-type se guarda en Storage. Por compatibilidad, si no
// viene mimeType se asume PDF (asi era el unico tipo soportado antes).
export class SubirExamenDto {
  @IsString()
  @MinLength(1, { message: 'nombre es requerido.' })
  nombre!: string;

  @IsString()
  @MinLength(1, { message: 'pdfBase64 es requerido.' })
  @MaxLength(MAX_EXAMEN_PDF_BASE64, { message: 'El archivo es demasiado grande.' })
  pdfBase64!: string;

  @IsOptional()
  @IsIn(MIME_TYPES_EXAMEN, { message: 'Tipo de archivo no soportado. Usa PDF, JPG, PNG o WEBP.' })
  mimeType?: (typeof MIME_TYPES_EXAMEN)[number];
}
