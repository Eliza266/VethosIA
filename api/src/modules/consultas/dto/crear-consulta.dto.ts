import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearConsultaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  pacienteId!: string;

  /** Opcional: legacy pedía HC antes del doc; la API puede recibirlo y persistirlo. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  numeroHC?: string;

  /** Cita de agenda desde la cual se inicia la atención. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  citaId?: string;
}
