import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { InvitacionesService } from './invitaciones.service';
import {
  CrearInvitacionDto,
  CrearInvitacionV2Dto,
  AceptarInvitacionDto,
  RevocarInvitacionDto,
} from './dto/invitacion.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  // Crea una invitacion (enlace unico 48h). Solo admin de la entidad o superadmin.
  @Roles('admin')
  @Post()
  @HttpCode(200)
  crear(@Body() dto: CrearInvitacionDto, @CurrentUser() user: AuthUser) {
    return this.invitaciones.crear(dto.orgId, dto.email, dto.rol, user);
  }

  @Roles('admin')
  @Post('v2')
  @HttpCode(200)
  crearV2(@Body() dto: CrearInvitacionV2Dto, @CurrentUser() user: AuthUser) {
    return this.invitaciones.crearV2(dto, user);
  }

  // Acepta una invitacion: requiere estar autenticado (el uid del aceptante se toma del token).
  @Post('aceptar')
  @HttpCode(200)
  aceptar(@Body() dto: AceptarInvitacionDto, @CurrentUser() user: AuthUser) {
    return this.invitaciones.aceptar(dto.token, user);
  }

  @Roles('admin')
  @Post('revocar')
  @HttpCode(200)
  revocar(@Body() dto: RevocarInvitacionDto, @CurrentUser() user: AuthUser) {
    return this.invitaciones.revocar(dto.token, user);
  }
}
