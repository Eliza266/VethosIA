import { IsNotEmpty, IsString } from 'class-validator';

// body de POST /v1/ia/soap.
export class SoapDto {
  @IsString()
  @IsNotEmpty({ message: 'La transcripcion es obligatoria.' })
  transcripcion!: string;
}
