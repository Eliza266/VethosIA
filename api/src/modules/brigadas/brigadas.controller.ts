import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { BrigadasService } from './brigadas.service';
import { CrearBrigadaDto, ActualizarBrigadaDto, CrearAtencionBrigadaDto } from './dto/brigada.dto';
import { BrigadaAtencionDoc, BrigadaConsolidado, BrigadaDoc } from './brigada.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

@Controller('brigadas')
export class BrigadasController {
  constructor(private readonly brigadas: BrigadasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser): Promise<BrigadaDoc[]> {
    return this.brigadas.listar(user);
  }

  @Post()
  @HttpCode(201)
  crear(@Body() dto: CrearBrigadaDto, @CurrentUser() user: AuthUser): Promise<BrigadaDoc> {
    return this.brigadas.crear(dto, user);
  }

  @Get(':id/atenciones')
  listarAtenciones(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<BrigadaAtencionDoc[]> {
    return this.brigadas.listarAtenciones(id, user);
  }

  @Post(':id/atenciones')
  @HttpCode(201)
  registrarAtencion(
    @Param('id') id: string,
    @Body() dto: CrearAtencionBrigadaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BrigadaAtencionDoc> {
    return this.brigadas.registrarAtencion(id, dto, user);
  }

  @Get(':id/consolidado')
  consolidado(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<BrigadaConsolidado> {
    return this.brigadas.consolidado(id, user);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<BrigadaDoc> {
    return this.brigadas.obtener(id, user);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarBrigadaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BrigadaDoc> {
    return this.brigadas.actualizar(id, dto, user);
  }
}
