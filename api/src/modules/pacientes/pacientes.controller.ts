import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PacientesService } from './pacientes.service';
import { HistorialService } from './historial.service';
import { PdfService } from '../consultas/pdf.service';
import { CrearPacienteDto, ActualizarPacienteDto } from './dto/paciente.dto';
import { PacienteDoc } from './paciente.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('pacientes')
export class PacientesController {
  constructor(
    private readonly pacientes: PacientesService,
    private readonly historial: HistorialService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  async listar(@CurrentUser() user: AuthUser): Promise<PacienteDoc[]> {
    return this.pacientes.listar(user);
  }

  @Post()
  async crear(
    @Body() dto: CrearPacienteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PacienteDoc> {
    return this.pacientes.crear(dto, user);
  }

  @Get(':id')
  async obtener(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<PacienteDoc> {
    return this.pacientes.obtener(id, user);
  }

  @Get(':id/historial')
  async historialClinico(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.historial.consolidar(id, user);
  }

  // PDF del historial completo del paciente (todas las consultas aprobadas).
  @Post(':id/historial-pdf')
  async historialPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ url: string }> {
    return this.pdf.generarHistorialCompleto(id, user);
  }

  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPacienteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PacienteDoc> {
    return this.pacientes.actualizar(id, dto, user);
  }

  // Soft delete: el asistente NO borra (jerarquia: @Roles('vet') excluye asistente).
  @Roles('vet')
  @Delete(':id')
  async eliminar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ eliminado: true }> {
    return this.pacientes.eliminar(id, user);
  }
}
