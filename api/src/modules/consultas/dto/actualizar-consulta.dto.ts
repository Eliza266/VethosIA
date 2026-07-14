import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

// Campos editables vía PATCH. orgId/veterinarioId/pacienteId/id quedan fuera (whitelist).
export class ActualizarConsultaDto {
  @IsOptional()
  @IsIn(['procesando', 'borrador', 'aprobada', 'error'])
  estado?: 'procesando' | 'borrador' | 'aprobada' | 'error';

  @IsOptional() @IsString() @MaxLength(120) numeroHC?: string;
  @IsOptional() @IsString() @MaxLength(8000) transcripcion?: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
  @IsOptional() @IsIn(['urgente', 'rutina', 'seguimiento', 'brigada'])
  prioridad?: 'urgente' | 'rutina' | 'seguimiento' | 'brigada';

  @IsOptional() @IsString() @MaxLength(2048) audioUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(2048, { each: true })
  audioUrls?: string[];
  @IsOptional() @IsString() @MaxLength(512) audioPath?: string;

  @IsOptional() @IsObject() soap?: Record<string, unknown>;
  @IsOptional() @IsObject() signosVitales?: Record<string, unknown>;
  @IsOptional() @IsArray() diagnosticoEstructurado?: unknown[];

  // Flag de workflow (no es contenido clinico): permite confirmar/vincular el paciente
  // detectado por IA en consultas de creacion rapida. Se puede limpiar aun en consultas
  // aprobadas (ver ConsultasService.actualizar), a diferencia de los campos clinicos de arriba.
  @IsOptional() @IsBoolean() pacientePendienteConfirmar?: boolean;
}
