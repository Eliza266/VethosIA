import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { BloqueoMiembroDto } from './dto/invitacion.dto';
import {
  ActualizarEntidadBackofficeDto,
  ActualizarVeterinariaBackofficeDto,
  CrearEntidadBackofficeDto,
  CrearVeterinariaBackofficeDto,
} from './dto/backoffice.dto';
import { BackofficeService } from './backoffice.service';

@Controller('backoffice')
export class BackofficeController {
  constructor(private readonly backoffice: BackofficeService) {}

  @Get('permisos')
  permisos(@CurrentUser() user: AuthUser) {
    return this.backoffice.permisos(user);
  }

  @Get('entidades')
  listarEntidades(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarEntidades(user);
  }

  @Post('entidades')
  crearEntidad(@Body() dto: CrearEntidadBackofficeDto, @CurrentUser() user: AuthUser) {
    return this.backoffice.crearEntidadGlobal(user, dto);
  }

  @Patch('entidades/:id')
  actualizarEntidadGlobal(
    @Param('id') id: string,
    @Body() dto: ActualizarEntidadBackofficeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backoffice.actualizarEntidadGlobal(user, id, dto);
  }

  @Get('entidad')
  obtenerEntidad(@CurrentUser() user: AuthUser) {
    return this.backoffice.obtenerEntidadActual(user);
  }

  @Patch('entidad')
  actualizarEntidad(@Body() dto: ActualizarEntidadBackofficeDto, @CurrentUser() user: AuthUser) {
    return this.backoffice.actualizarEntidadActual(user, dto);
  }

  @Get('veterinarias')
  listarVeterinarias(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarVeterinarias(user);
  }

  @Post('veterinarias')
  crearVeterinaria(@Body() dto: CrearVeterinariaBackofficeDto, @CurrentUser() user: AuthUser) {
    return this.backoffice.crearVeterinaria(user, dto);
  }

  @Get('veterinaria')
  obtenerVeterinaria(@CurrentUser() user: AuthUser) {
    return this.backoffice.obtenerVeterinariaActual(user);
  }

  @Patch('veterinarias/:id')
  actualizarVeterinaria(
    @Param('id') id: string,
    @Body() dto: ActualizarVeterinariaBackofficeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backoffice.actualizarVeterinaria(user, id, dto);
  }

  @Get('miembros')
  listarMiembros(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarMiembros(user);
  }

  @Get('veterinarios')
  listarVeterinarios(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarVeterinarios(user);
  }

  @Patch('miembros/:id/bloqueo')
  bloquearMiembro(
    @Param('id') id: string,
    @Body() dto: BloqueoMiembroDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backoffice.setBloqueoMiembro(user, id, dto.bloqueado);
  }

  @Get('consumos')
  listarConsumos(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarConsumos(user);
  }

  @Get('suscripciones')
  listarSuscripciones(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarSuscripciones(user);
  }

  @Get('auditoria')
  listarAuditoria(@CurrentUser() user: AuthUser) {
    return this.backoffice.listarAuditoria(user);
  }
}
