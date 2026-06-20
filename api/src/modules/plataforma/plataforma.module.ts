import { Module } from '@nestjs/common';
import {
  NotificacionesController,
  MetricasController,
  AuditoriaController,
  SystemConfigController,
  SystemJobsController,
} from './plataforma.controller';
import { AuditoriaService } from './auditoria.service';
import { NotificacionesService } from './notificaciones.service';
import { MetricasService } from './metricas.service';
import { AccesoService } from './acceso.service';
import { SystemJobsService } from './system-jobs.service';
import { SystemConfigService } from './system-config.service';
import { WorkerGuard } from '../ia/worker.guard';

@Module({
  controllers: [
    NotificacionesController,
    MetricasController,
    AuditoriaController,
    SystemConfigController,
    SystemJobsController,
  ],
  providers: [
    AuditoriaService,
    NotificacionesService,
    MetricasService,
    AccesoService,
    SystemJobsService,
    SystemConfigService,
    WorkerGuard,
  ],
  exports: [
    AuditoriaService,
    NotificacionesService,
    MetricasService,
    AccesoService,
    SystemJobsService,
    SystemConfigService,
  ],
})
export class PlataformaModule {}
