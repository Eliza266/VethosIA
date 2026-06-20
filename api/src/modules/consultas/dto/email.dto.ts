import { IsEmail, IsOptional, IsString } from 'class-validator';

// body de POST /v1/consultas/:id/email. El PDF se resuelve server-side por consultaId.
export class EmailConsultaDto {
  @IsEmail({}, { message: 'emailDestinatario no es un correo valido.' })
  emailDestinatario!: string;

  @IsOptional()
  @IsString()
  nombrePropietario?: string;

  @IsOptional()
  @IsString()
  nombrePaciente?: string;

  @IsOptional()
  @IsString()
  nombreVet?: string;
}
