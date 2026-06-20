import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { VacunasService } from './vacunas.service';
import {
  CrearVacunaDto,
  ActualizarVacunaDto,
  AplicarVacunaDto,
  FiltrarVacunasDto,
} from './dto/vacuna.dto';
import { VacunaDoc } from './vacuna.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('vacunas')
export class VacunasController {
  constructor(private readonly vacunas: VacunasService) {}

  @Get('catalogo')
  catalogo() {
    return this.vacunas.catalogoBase();
  }

  // GET /v1/vacunas?pacienteId=...&estado=...&especie=...&tipo=...
  @Get()
  listar(
    @Query() filtros: FiltrarVacunasDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc[]> {
    return this.vacunas.listar(filtros, user);
  }

  // GET /v1/vacunas/pendientes -> conteo de proximas/vencidas para dashboard.
  @Get('pendientes')
  pendientes(@CurrentUser() user: AuthUser): Promise<{ proximas: number; vencidas: number }> {
    return this.vacunas.contarPendientes(user);
  }

  @Post()
  crear(@Body() dto: CrearVacunaDto, @CurrentUser() user: AuthUser): Promise<VacunaDoc> {
    return this.vacunas.crear(dto, user);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarVacunaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc> {
    return this.vacunas.actualizar(id, dto, user);
  }

  @Post(':id/aplicar')
  aplicar(
    @Param('id') id: string,
    @Body() dto: AplicarVacunaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc> {
    return this.vacunas.marcarAplicada(id, dto, user);
  }

  @Roles('admin', 'vet')
  @Delete(':id')
  eliminar(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<{ eliminado: true }> {
    return this.vacunas.eliminar(id, user);
  }
}
