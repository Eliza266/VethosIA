import { Body, Controller, Post } from '@nestjs/common';
import { RegistroService, RegistroPublicoResultado } from './registro.service';
import { RegistroPublicoDto } from './dto/registro-publico.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

// POST /v1/registro: requiere un Firebase ID token valido (el usuario ya se creo
// en Firebase Auth desde el frontend, via Google o email/password) pero no pasa
// por AccesoService.validarEmailPermitido: es justamente el paso que da de alta
// un tenant nuevo, asi que no puede depender de una whitelist previa.
@Controller('registro')
export class RegistroController {
  constructor(private readonly registro: RegistroService) {}

  @Post()
  registrar(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegistroPublicoDto,
  ): Promise<RegistroPublicoResultado> {
    return this.registro.registrarNuevaCuenta(user, dto);
  }
}
