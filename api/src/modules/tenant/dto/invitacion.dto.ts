import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Rol } from '../../../common/auth/auth-user.interface';

export class CrearInvitacionDto {
  @IsString() @MinLength(1) orgId!: string;
  @IsEmail() email!: string;
  @IsIn(['admin', 'vet']) rol!: Exclude<Rol, 'superadmin' | 'asistente'>;
}

export class CrearInvitacionV2Dto {
  @IsEmail() email!: string;
  @IsIn(['admin_veterinaria', 'veterinario']) role!: 'admin_veterinaria' | 'veterinario';
  @IsOptional() @IsString() @MinLength(1) orgId?: string;
  @IsOptional() @IsString() @MinLength(1) entidadId?: string;
  @IsOptional() @IsString() @MinLength(1) veterinariaId?: string;
  @IsOptional() @IsString() @MinLength(1) accountId?: string;
  @IsOptional() @IsIn(['veterinaria', 'entidad']) accountType?: 'veterinaria' | 'entidad';
  @IsOptional() @IsIn(['veterinaria', 'entidad']) planOwnerType?: 'veterinaria' | 'entidad';
  @IsOptional() @IsString() @MinLength(1) planOwnerId?: string;
  @IsOptional() @IsIn(['staff', 'owner', 'freelance']) vinculoTipo?: 'staff' | 'owner' | 'freelance';
}

export class AceptarInvitacionDto {
  @IsString() @MinLength(10) token!: string;
}

export class RevocarInvitacionDto {
  @IsString() @MinLength(10) token!: string;
}

export class BloqueoMiembroDto {
  @IsIn([true, false]) bloqueado!: boolean;
}
