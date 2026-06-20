import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PropietarioDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(6) codigoPais?: string;
}

export class CrearPacienteDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsOptional() @IsString() @MaxLength(60) especie?: string;
  @IsOptional() @IsString() @MaxLength(60) raza?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsString() edad?: string;
  @IsOptional() @IsIn(['macho', 'hembra', 'desconocido']) sexo?: 'macho' | 'hembra' | 'desconocido';
  @IsOptional()
  @IsIn(['entero', 'castrado', 'desconocido'])
  estadoReproductivo?: 'entero' | 'castrado' | 'desconocido';
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsOptional() @IsString() @MaxLength(60) chip?: string;
  @IsOptional() @IsString() @MaxLength(2048) foto?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PropietarioDto) propietario?: PropietarioDto;
  @IsOptional() @IsString() @MaxLength(4000) notas?: string;
  @IsOptional() @IsNumber() ultimoPeso?: number;
  @IsOptional() @IsNumber() ultimaTalla?: number;
}

// En update todos los campos son opcionales (no se permite cambiar orgId/codigo).
export class ActualizarPacienteDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(60) especie?: string;
  @IsOptional() @IsString() @MaxLength(60) raza?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsString() edad?: string;
  @IsOptional() @IsIn(['macho', 'hembra', 'desconocido']) sexo?: 'macho' | 'hembra' | 'desconocido';
  @IsOptional()
  @IsIn(['entero', 'castrado', 'desconocido'])
  estadoReproductivo?: 'entero' | 'castrado' | 'desconocido';
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsOptional() @IsString() @MaxLength(60) chip?: string;
  @IsOptional() @IsString() @MaxLength(2048) foto?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PropietarioDto) propietario?: PropietarioDto;
  @IsOptional() @IsString() @MaxLength(4000) notas?: string;
  @IsOptional() @IsNumber() ultimoPeso?: number;
  @IsOptional() @IsNumber() ultimaTalla?: number;
}
