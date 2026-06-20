import { Module } from '@nestjs/common';
import {
  PlanesController,
  SuscripcionesController,
  ConsumoController,
  PagosController,
} from './saas.controller';
import { PlanesService } from './planes.service';
import { SuscripcionesService } from './suscripciones.service';
import { ConsumoService } from './consumo.service';
import { WompiService } from './wompi.service';
import { CobrosService } from './cobros.service';
import { PagosConfigService } from './pagos-config.service';
import { TenantSecretsService } from './tenant-secrets.service';
import { PlataformaModule } from '../plataforma/plataforma.module';

@Module({
  imports: [PlataformaModule],
  controllers: [PlanesController, SuscripcionesController, ConsumoController, PagosController],
  providers: [
    PlanesService,
    SuscripcionesService,
    ConsumoService,
    WompiService,
    CobrosService,
    PagosConfigService,
    TenantSecretsService,
  ],
  exports: [
    PlanesService,
    SuscripcionesService,
    ConsumoService,
    WompiService,
    CobrosService,
    PagosConfigService,
  ],
})
export class SaasModule {}
