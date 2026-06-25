import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TIPOS_ENTIDAD = ['gobierno', 'cadena', 'ong', 'entidad'] as const;
export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number];

export class CrearEntidadBackofficeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsIn(TIPOS_ENTIDAD)
  tipo?: TipoEntidad | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsIn(['activa', 'inactiva'])
  estado?: 'activa' | 'inactiva';
}

export class ActualizarEntidadBackofficeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsIn(TIPOS_ENTIDAD)
  tipo?: TipoEntidad | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsIn(['activa', 'inactiva'])
  estado?: 'activa' | 'inactiva';
}

export class CrearVeterinariaBackofficeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  veterinariaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entidadId?: string;

  @IsOptional()
  @IsIn(['veterinaria', 'entidad'])
  planOwnerType?: 'veterinaria' | 'entidad';

  @IsOptional()
  @IsString()
  @MaxLength(180)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;
}

export class CrearVeterinarioCredencialesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  // Solo lo usan admin_entidad/superadmin para apuntar a una sede concreta.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  veterinariaId?: string;
}

export class ActualizarVeterinariaBackofficeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsIn(['activa', 'inactiva'])
  estado?: 'activa' | 'inactiva';
}
