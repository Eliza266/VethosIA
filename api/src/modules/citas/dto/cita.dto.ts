import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ESTADOS_CITA, EstadoCita } from '../cita.types';

export class CrearCitaDto {
  @IsISO8601() fecha!: string;
  /** Motivo de la consulta agendada. */
  @IsString() @MinLength(1) @MaxLength(160) motivo!: string;
  @IsString() @MinLength(1) pacienteId!: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
  /** Legacy: solo citas antiguas creadas sin paciente. */
  @IsOptional() @IsString() @MaxLength(160) titulo?: string;
}

export class ActualizarCitaDto {
  @IsOptional() @IsString() @MaxLength(160) motivo?: string;
  @IsOptional() @IsISO8601() fecha?: string;
  @IsOptional() @IsString() pacienteId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
  @IsOptional() @IsString() @MaxLength(160) titulo?: string;
}

export class VincularPacienteCitaDto {
  @IsString() @MinLength(1) pacienteId!: string;
}

export class CambiarEstadoCitaDto {
  @IsIn(ESTADOS_CITA) estado!: EstadoCita;
}
