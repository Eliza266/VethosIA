import { Module } from '@nestjs/common';
import { VacunasController } from './vacunas.controller';
import { PacienteVacunasController } from './paciente-vacunas.controller';
import { VacunasService } from './vacunas.service';
import { VacunasRepository } from './vacunas.repository';
import { PacientesModule } from '../pacientes/pacientes.module';
import { PlataformaModule } from '../plataforma/plataforma.module';

@Module({
  imports: [PacientesModule, PlataformaModule],
  controllers: [VacunasController, PacienteVacunasController],
  providers: [VacunasService, VacunasRepository],
  exports: [VacunasService, VacunasRepository],
})
export class VacunasModule {}
