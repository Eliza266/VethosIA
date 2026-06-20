import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { FiltrarSolicitudesTecnicasDto, ResolverSolicitudTecnicaDto } from './dto/solicitud-tecnica.dto';
import { SolicitudesTecnicasService } from './solicitudes-tecnicas.service';

// Area Tecnica: revision server-side de conflictos de vinculacion.
@Controller('solicitudes-tecnicas')
export class SolicitudesTecnicasController {
  constructor(private readonly solicitudes: SolicitudesTecnicasService) {}

  @Get()
  listar(@Query() query: FiltrarSolicitudesTecnicasDto, @CurrentUser() user: AuthUser) {
    return this.solicitudes.listar(user, query.estado);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitudes.obtener(id, user);
  }

  @Post(':id/aprobar')
  @HttpCode(200)
  aprobar(
    @Param('id') id: string,
    @Body() dto: ResolverSolicitudTecnicaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitudes.aprobar(id, user, dto.decisionTecnica);
  }

  @Post(':id/rechazar')
  @HttpCode(200)
  rechazar(
    @Param('id') id: string,
    @Body() dto: ResolverSolicitudTecnicaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitudes.rechazar(id, user, dto.decisionTecnica);
  }

  @Post(':id/resolver')
  @HttpCode(200)
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverSolicitudTecnicaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitudes.marcarResuelta(id, user, dto.decisionTecnica);
  }
}
