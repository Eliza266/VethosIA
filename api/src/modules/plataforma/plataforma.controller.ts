import { Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { NotificacionesService } from './notificaciones.service';
import { MetricasService, Metricas } from './metricas.service';
import { SystemJobsService } from './system-jobs.service';
import { SystemConfigService } from './system-config.service';
import { Roles } from '../../common/auth/roles.decorator';
import { Public } from '../../common/auth/public.decorator';
import { WorkerGuard } from '../ia/worker.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notis: NotificacionesService) {}

  @Get()
  listar(@Query('noLeidas') noLeidas: string, @CurrentUser() user: AuthUser) {
    return this.notis.listar(user, noLeidas === 'true');
  }

  @Post('leer-todas')
  marcarTodas(@CurrentUser() user: AuthUser) {
    return this.notis.marcarTodasLeidas(user);
  }

  @Post(':id/leer')
  marcarLeidaPost(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notis.marcarLeida(id, user);
  }

  @Patch(':id/leida')
  marcarLeida(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notis.marcarLeida(id, user);
  }
}

@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  @Get()
  resumen(
    @CurrentUser() user: AuthUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ): Promise<Metricas> {
    return this.metricas.resumen(user, { desde, hasta });
  }
}

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  // Solo admin/superadmin listan auditoria.
  @Roles('admin')
  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.auditoria.listar(user);
  }
}

@Controller('sistema/configuracion')
export class SystemConfigController {
  constructor(private readonly config: SystemConfigService) {}

  @Roles('superadmin')
  @Get()
  obtener() {
    return this.config.obtener();
  }
}

@Controller('sistema/jobs')
export class SystemJobsController {
  constructor(private readonly jobs: SystemJobsService) {}

  // Endpoint interno para Cloud Scheduler/Tasks. No usa Firebase ID token;
  // queda protegido por IA_WORKER_SECRET via header x-worker-secret.
  @Public()
  @UseGuards(WorkerGuard)
  @Post('run')
  @HttpCode(200)
  ejecutar() {
    return this.jobs.ejecutar();
  }
}
