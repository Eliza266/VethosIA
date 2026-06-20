import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class UbicacionDto {
  @IsString() @MaxLength(200) direccion!: string;
  @IsString() @MaxLength(120) ciudad!: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class CrearBrigadaDto {
  @IsString() @MaxLength(200) nombre!: string;
  @IsOptional() @IsString() @MaxLength(800) descripcion?: string;
  @IsString() @MaxLength(32) fecha!: string;

  @ValidateNested()
  @Type(() => UbicacionDto)
  ubicacion!: UbicacionDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  veterinarioIds?: string[];

  @IsOptional() @IsString() @MaxLength(120) veterinariaId?: string;

  @IsOptional()
  @IsIn(['planificada', 'en_curso', 'finalizada'])
  estado?: 'planificada' | 'en_curso' | 'finalizada';
}

export class ActualizarBrigadaDto {
  @IsOptional() @IsString() @MaxLength(200) nombre?: string;
  @IsOptional() @IsString() @MaxLength(800) descripcion?: string;
  @IsOptional() @IsString() @MaxLength(32) fecha?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UbicacionDto)
  ubicacion?: UbicacionDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  veterinarioIds?: string[];

  @IsOptional() @IsString() @MaxLength(120) veterinariaId?: string;

  @IsOptional()
  @IsIn(['planificada', 'en_curso', 'finalizada'])
  estado?: 'planificada' | 'en_curso' | 'finalizada';

  @IsOptional() @IsNumber() totalConsultas?: number;
}

export class CrearAtencionBrigadaDto {
  @IsOptional() @IsString() @MaxLength(128) pacienteId?: string;
  @IsOptional() @IsString() @MaxLength(128) consultaId?: string;
  @IsOptional() @IsString() @MaxLength(128) veterinarioId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;

  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
  @IsOptional() @IsString() @MaxLength(80) especie?: string;
  @IsOptional() @IsString() @MaxLength(64) fechaHora?: string;
}
