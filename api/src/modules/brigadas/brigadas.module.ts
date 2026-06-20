import { Module } from '@nestjs/common';
import { BrigadasController } from './brigadas.controller';
import { BrigadasService } from './brigadas.service';
import { BrigadasRepository } from './brigadas.repository';
import { PlataformaModule } from '../plataforma/plataforma.module';

@Module({
  imports: [PlataformaModule],
  controllers: [BrigadasController],
  providers: [BrigadasService, BrigadasRepository],
  exports: [BrigadasService, BrigadasRepository],
})
export class BrigadasModule {}
