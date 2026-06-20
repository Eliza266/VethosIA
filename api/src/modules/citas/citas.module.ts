import { Module } from '@nestjs/common';
import { CitasController } from './citas.controller';
import { CitasService } from './citas.service';
import { CitasRepository } from './citas.repository';

@Module({
  controllers: [CitasController],
  providers: [CitasService, CitasRepository],
  exports: [CitasService, CitasRepository],
})
export class CitasModule {}
