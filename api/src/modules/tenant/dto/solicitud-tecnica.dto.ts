import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FiltrarSolicitudesTecnicasDto {
  @IsOptional()
  @IsIn(['pendiente', 'aprobada', 'rechazada', 'resuelta'])
  estado?: 'pendiente' | 'aprobada' | 'rechazada' | 'resuelta';
}

export class ResolverSolicitudTecnicaDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionTecnica?: string;
}
