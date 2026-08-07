import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Datos que el usuario llena en /registro. El usuario de Firebase Auth (Google o
// email/password) ya existe cuando este DTO llega: el registro solo aprovisiona
// la veterinaria, la membresia y el trial sobre ese uid.
export class RegistroPublicoDto {
  @IsNotEmpty() @IsString() @MaxLength(150) nombre!: string;
  @IsNotEmpty() @IsString() @MaxLength(200) veterinariaNombre!: string;
  @IsNotEmpty() @IsString() @MaxLength(80) matriculaProfesional!: string;
  @IsOptional() @IsString() @MaxLength(120) telefono?: string;
  @IsOptional() @IsString() @MaxLength(120) ciudad?: string;
  @IsOptional() @IsString() @MaxLength(80) pais?: string;
}
