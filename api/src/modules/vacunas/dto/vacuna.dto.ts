import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { EstadoVacuna, FuenteVacuna } from '../vacuna.types';

export class CrearVacunaDto {
  @IsString() @MinLength(1) pacienteId!: string;
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsOptional() @IsString() @MaxLength(60) especie?: string;
  @IsOptional() @IsString() @MaxLength(80) catalogoCodigo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsIn(['catalogo_base', 'personalizada']) fuente?: FuenteVacuna;
  @IsOptional() @IsISO8601() aplicada?: string;
  @IsOptional() @IsISO8601() proximaDosis?: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
}

export class ActualizarVacunaDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(60) especie?: string;
  @IsOptional() @IsString() @MaxLength(80) catalogoCodigo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsIn(['catalogo_base', 'personalizada']) fuente?: FuenteVacuna;
  @IsOptional() @IsISO8601() aplicada?: string;
  @IsOptional() @IsISO8601() proximaDosis?: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
}

/** Body de POST anidado bajo /pacientes/:pacienteId/vacunas (pacienteId va en la URL). */
export class CrearVacunaPacienteDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsOptional() @IsString() @MaxLength(60) especie?: string;
  @IsOptional() @IsString() @MaxLength(80) catalogoCodigo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsIn(['catalogo_base', 'personalizada']) fuente?: FuenteVacuna;
  @IsOptional() @IsISO8601() aplicada?: string;
  @IsOptional() @IsISO8601() proximaDosis?: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
}

export class AplicarVacunaDto {
  @IsOptional() @IsISO8601() aplicada?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
}

export class FiltrarVacunasDto {
  @IsOptional() @IsString() pacienteId?: string;
  @IsOptional() @IsString() especie?: string;
  @IsOptional() @IsIn(['al_dia', 'proxima_a_vencer', 'proxima', 'vencida']) estado?: EstadoVacuna | 'proxima';
  @IsOptional() @IsString() proximas?: string;
  @IsOptional() @IsString() vencidas?: string;
  @IsOptional() @IsString() tipo?: string;
}

export class CrearCatalogoVacunaDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsIn(['perro', 'gato', 'ave', 'reptil', 'otro']) especie!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsString() @MaxLength(2000) descripcion?: string;
}

export class ActualizarCatalogoVacunaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
  @IsOptional() @IsIn(['perro', 'gato', 'ave', 'reptil', 'otro']) especie?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) intervaloDias?: number;
  @IsOptional() @IsString() @MaxLength(2000) descripcion?: string;
}
