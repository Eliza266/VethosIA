import { Module } from '@nestjs/common';
import { ConsultasController } from './consultas.controller';
import { ConsultasRepository } from './consultas.repository';
import { ConsultasService } from './consultas.service';
import { HcService } from './hc.service';
import { PdfService } from './pdf.service';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../storage/storage.module';
import { IaModule } from '../ia/ia.module';
import { SaasModule } from '../saas/saas.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { CitasModule } from '../citas/citas.module';

@Module({
  imports: [EmailModule, StorageModule, IaModule, SaasModule, PlataformaModule, CitasModule],
  controllers: [ConsultasController],
  providers: [ConsultasRepository, ConsultasService, HcService, PdfService],
  exports: [ConsultasRepository, PdfService],
})
export class ConsultasModule {}
