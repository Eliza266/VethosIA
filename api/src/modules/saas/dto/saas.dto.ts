import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ESTADOS_SUSCRIPCION, EstadoSuscripcion } from '../suscripcion.state';

export class CrearPlanDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsInt() @Min(0) precioMensualCOP!: number;
  @IsInt() @Min(0) precioAnualCOP!: number;
  @IsInt() @Min(1) asientosMax!: number;
  @IsInt() @Min(0) limiteHistoriasMes!: number;
  @IsInt() @Min(0) historiasGratisTrial!: number;
  @IsIn(['individual', 'entidad', 'ambos']) tipo!: 'individual' | 'entidad' | 'ambos';
  @IsBoolean() activo!: boolean;
}

export class ActualizarPlanDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsInt() @Min(0) precioMensualCOP?: number;
  @IsOptional() @IsInt() @Min(0) precioAnualCOP?: number;
  @IsOptional() @IsInt() @Min(1) asientosMax?: number;
  @IsOptional() @IsInt() @Min(0) limiteHistoriasMes?: number;
  @IsOptional() @IsInt() @Min(0) historiasGratisTrial?: number;
  @IsOptional() @IsIn(['individual', 'entidad', 'ambos']) tipo?: 'individual' | 'entidad' | 'ambos';
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CambiarEstadoSuscripcionDto {
  @IsIn(ESTADOS_SUSCRIPCION) estado!: EstadoSuscripcion;
}

export class CheckoutDto {
  @IsString() @MinLength(1) planId!: string;
  @IsOptional() @IsIn(['mensual', 'anual']) ciclo?: 'mensual' | 'anual';
}

export class ConfigurarWompiDto {
  @IsString() @MinLength(8) publicKey!: string;
  @IsString() @MinLength(8) privateKey!: string;
  @IsString() @MinLength(8) eventsSecret!: string;
  @IsString() @MinLength(8) integritySecret!: string;
}

export class ExtenderTrialDto {
  @IsOptional() @IsInt() @Min(1) dias?: number;
}
