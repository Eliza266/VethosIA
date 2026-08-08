import { Body, Controller, Get, Param, Patch, Post, HttpCode, Put } from '@nestjs/common';
import { PlanesService } from './planes.service';
import { SuscripcionesService } from './suscripciones.service';
import { ConsumoService } from './consumo.service';
import { WompiService, WompiEvent } from './wompi.service';
import { PagosConfigService } from './pagos-config.service';
import {
  CrearPlanDto,
  ActualizarPlanDto,
  CambiarEstadoSuscripcionDto,
  CheckoutDto,
  ConfigurarWompiDto,
  ExtenderTrialDto,
} from './dto/saas.dto';
import { PlanDoc } from './plan.types';
import { Roles } from '../../common/auth/roles.decorator';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

// ── Planes (catalogo) ─ solo superadmin escribe ─────────────────────
@Controller('planes')
export class PlanesController {
  constructor(private readonly planes: PlanesService) {}

  @Get()
  listar(): Promise<PlanDoc[]> {
    return this.planes.listar(false);
  }

  @Roles('superadmin')
  @Post()
  crear(@Body() dto: CrearPlanDto, @CurrentUser() user: AuthUser): Promise<PlanDoc> {
    return this.planes.crear(dto, user);
  }

  @Roles('superadmin')
  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPlanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PlanDoc> {
    return this.planes.actualizar(id, dto, user);
  }
}

// ── Suscripciones + consumo ─────────────────────────────────────────
@Controller('suscripciones')
export class SuscripcionesController {
  constructor(
    private readonly subs: SuscripcionesService,
    private readonly consumo: ConsumoService,
  ) {}

  @Get('me')
  async mia(@CurrentUser() user: AuthUser) {
    const sub = await this.subs.obtenerDeUsuario(user);
    const asientos = await this.subs.asientosDisponibles(user);
    return { suscripcion: sub, asientos };
  }

  // cambiar estado: admin de la entidad o superadmin.
  @Roles('admin')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoSuscripcionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subs.cambiarEstado(id, dto.estado, user);
  }

  // extender trial N dias (PDF 06.B). admin de la entidad o superadmin.
  @Roles('admin')
  @Post(':id/extender-trial')
  @HttpCode(200)
  extenderTrial(
    @Param('id') id: string,
    @Body() dto: ExtenderTrialDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subs.extenderTrial(id, dto.dias ?? 7, user);
  }

  // asignar plan manualmente desde Super Admin
  @Roles('admin')
  @Patch(':id/plan')
  asignarPlan(
    @Param('id') id: string,
    @Body() dto: { planId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.subs.asignarPlan(id, dto.planId, user);
  }
}

@Controller('consumo')
export class ConsumoController {
  constructor(
    private readonly consumo: ConsumoService,
    private readonly subs: SuscripcionesService,
  ) {}

  @Get()
  async actual(@CurrentUser() user: AuthUser) {
    const limite = await this.subs.limiteHistoriasMes(user);
    return this.consumo.estado(user, limite);
  }
}

// ── Pagos (Wompi) ───────────────────────────────────────────────────
@Controller('pagos')
export class PagosController {
  constructor(
    private readonly wompi: WompiService,
    private readonly pagosConfig: PagosConfigService,
  ) {}

  @Get('me')
  estadoCuenta(@CurrentUser() user: AuthUser) {
    return this.wompi.estadoCuenta(user);
  }

  @Get('config/me')
  configMe(@CurrentUser() user: AuthUser) {
    return this.pagosConfig.getConfigPublic(user);
  }

  @Put('config/wompi')
  configurarWompi(@Body() dto: ConfigurarWompiDto, @CurrentUser() user: AuthUser) {
    return this.pagosConfig.configurarWompi(user, dto);
  }

  @Patch('config/wompi/deshabilitar')
  deshabilitarWompi(@CurrentUser() user: AuthUser) {
    return this.pagosConfig.deshabilitarWompi(user);
  }

  // Listado de eventos/pagos Wompi para Super Admin (PDF 03 'consulta eventos Wompi').
  @Roles('superadmin')
  @Get()
  listar() {
    return this.wompi.listarPagos();
  }

  @Post('checkout')
  @HttpCode(200)
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthUser) {
    return this.wompi.crearCheckoutSeguro(user, dto.planId, dto.ciclo ?? 'mensual');
  }

  // Webhook publico (no lleva ID token de usuario); se valida por FIRMA de Wompi.
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() event: WompiEvent): Promise<{ ok: boolean; status?: string }> {
    const res = await this.wompi.procesarWebhook(event);
    return { ok: res.procesado, status: res.status };
  }
}
