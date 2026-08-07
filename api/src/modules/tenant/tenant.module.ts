import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { MeController } from './me.controller';
import { InvitacionesController } from './invitaciones.controller';
import { SolicitudesTecnicasController } from './solicitudes-tecnicas.controller';
import { BackofficeController } from './backoffice.controller';
import { RegistroController } from './registro.controller';
import { TenantService } from './tenant.service';
import { InvitacionesService } from './invitaciones.service';
import { SolicitudesTecnicasService } from './solicitudes-tecnicas.service';
import { BackofficeService } from './backoffice.service';
import { RegistroService } from './registro.service';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { SaasModule } from '../saas/saas.module';

@Module({
  imports: [PlataformaModule, SaasModule],
  controllers: [
    TenantController,
    MeController,
    InvitacionesController,
    SolicitudesTecnicasController,
    BackofficeController,
    RegistroController,
  ],
  providers: [
    TenantService,
    InvitacionesService,
    SolicitudesTecnicasService,
    BackofficeService,
    RegistroService,
  ],
  exports: [TenantService, SolicitudesTecnicasService],
})
export class TenantModule {}
