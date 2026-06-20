import { Module } from '@nestjs/common';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';
import { PacientesRepository } from './pacientes.repository';
import { HistorialService } from './historial.service';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [PlataformaModule, ConsultasModule],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository, HistorialService],
  exports: [PacientesService, PacientesRepository],
})
export class PacientesModule {}
