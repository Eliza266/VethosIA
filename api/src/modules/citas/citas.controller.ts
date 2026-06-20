import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CitasService } from './citas.service';
import {
  CrearCitaDto,
  ActualizarCitaDto,
  CambiarEstadoCitaDto,
  VincularPacienteCitaDto,
} from './dto/cita.dto';
import { CitaDoc } from './cita.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

@Controller('citas')
export class CitasController {
  constructor(private readonly citas: CitasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser): Promise<CitaDoc[]> {
    return this.citas.listar(user);
  }

  @Post()
  crear(@Body() dto: CrearCitaDto, @CurrentUser() user: AuthUser): Promise<CitaDoc> {
    return this.citas.crear(dto, user);
  }

  @Get('proximas-2h')
  proximas2h(@CurrentUser() user: AuthUser): Promise<CitaDoc[]> {
    return this.citas.proximasHoras(user, 2);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<CitaDoc> {
    return this.citas.obtener(id, user);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarCitaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CitaDoc> {
    return this.citas.actualizar(id, dto, user);
  }

  @Patch(':id/vincular-paciente')
  vincularPaciente(
    @Param('id') id: string,
    @Body() dto: VincularPacienteCitaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CitaDoc> {
    return this.citas.vincularPaciente(id, dto.pacienteId, user);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoCitaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CitaDoc> {
    return this.citas.cambiarEstado(id, dto.estado, user);
  }
}
