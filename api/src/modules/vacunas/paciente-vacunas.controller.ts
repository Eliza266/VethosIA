import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { VacunasService } from './vacunas.service';
import { ActualizarVacunaDto, AplicarVacunaDto, CrearVacunaPacienteDto } from './dto/vacuna.dto';
import { VacunaDoc } from './vacuna.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('pacientes/:pacienteId/vacunas')
export class PacienteVacunasController {
  constructor(private readonly vacunas: VacunasService) {}

  @Get()
  listar(
    @Param('pacienteId') pacienteId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc[]> {
    return this.vacunas.listarPorPaciente(pacienteId, user);
  }

  @Post()
  crear(
    @Param('pacienteId') pacienteId: string,
    @Body() dto: CrearVacunaPacienteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc> {
    return this.vacunas.crear({ ...dto, pacienteId }, user);
  }

  @Patch(':vacunaId')
  actualizar(
    @Param('pacienteId') pacienteId: string,
    @Param('vacunaId') vacunaId: string,
    @Body() dto: ActualizarVacunaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc> {
    return this.vacunas.actualizarPorPaciente(pacienteId, vacunaId, dto, user);
  }

  @Post(':vacunaId/aplicar')
  aplicar(
    @Param('pacienteId') pacienteId: string,
    @Param('vacunaId') vacunaId: string,
    @Body() dto: AplicarVacunaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VacunaDoc> {
    return this.vacunas.marcarAplicadaPorPaciente(pacienteId, vacunaId, dto, user);
  }

  @Roles('admin', 'vet')
  @Delete(':vacunaId')
  eliminar(
    @Param('pacienteId') pacienteId: string,
    @Param('vacunaId') vacunaId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ eliminado: true }> {
    return this.vacunas.eliminarPorPaciente(pacienteId, vacunaId, user);
  }
}
