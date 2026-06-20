import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseModule } from './common/firebase/firebase.module';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { ConsultasModule } from './modules/consultas/consultas.module';
import { IaModule } from './modules/ia/ia.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { EmailModule } from './modules/email/email.module';
import { StorageModule } from './modules/storage/storage.module';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { CitasModule } from './modules/citas/citas.module';
import { VacunasModule } from './modules/vacunas/vacunas.module';
import { BrigadasModule } from './modules/brigadas/brigadas.module';
import { SaasModule } from './modules/saas/saas.module';
import { PlataformaModule } from './modules/plataforma/plataforma.module';

@Module({
  imports: [
    FirebaseModule,
    HealthModule,
    EmailModule,
    StorageModule,
    IaModule,
    ConsultasModule,
    TenantModule,
    PacientesModule,
    CitasModule,
    VacunasModule,
    BrigadasModule,
    SaasModule,
    PlataformaModule,
  ],
  providers: [
    // AuthGuard global: TODO endpoint exige Firebase ID token salvo los @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
    // RolesGuard corre despues y aplica @Roles(...) donde este declarado.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
