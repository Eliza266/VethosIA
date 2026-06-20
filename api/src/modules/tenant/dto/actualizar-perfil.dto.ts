import { IsOptional, IsString, MaxLength } from 'class-validator';

// Campos editables del perfil veterinario vía PATCH /v1/me.
// uid, email, orgId, rol y claims quedan fuera (solo server-side).
export class ActualizarPerfilDto {
  @IsOptional() @IsString() @MaxLength(120) telefono?: string;
  @IsOptional() @IsString() @MaxLength(120) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(120) ciudad?: string;
  @IsOptional() @IsString() @MaxLength(120) sede?: string;
  @IsOptional() @IsString() @MaxLength(200) veterinaria?: string;
  @IsOptional() @IsString() @MaxLength(80) matriculaProfesional?: string;
}
