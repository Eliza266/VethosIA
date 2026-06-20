import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearOrgDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  // plan comercial; lo dejamos abierto pero con un default razonable.
  @IsOptional()
  @IsIn(['free', 'pro', 'enterprise'])
  plan?: 'free' | 'pro' | 'enterprise';

  @IsOptional()
  @IsString()
  ciudad?: string;
}
