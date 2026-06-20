import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CrearOrgDto } from './dto/crear-org.dto';
import { AsignarMiembroDto } from './dto/asignar-miembro.dto';
import { BloqueoMiembroDto } from './dto/invitacion.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('organizaciones')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  // POST /v1/organizaciones -> crea org y deja al caller como admin. Onboarding.
  @Post()
  async crear(
    @Body() dto: CrearOrgDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ orgId: string }> {
    return this.tenant.crearOrganizacion(dto, user.uid);
  }

  // POST /v1/organizaciones/:orgId/miembros -> alta de miembro. Solo admin de ESA org.
  @Roles('admin')
  @Post(':orgId/miembros')
  async asignar(
    @Param('orgId') orgId: string,
    @Body() dto: AsignarMiembroDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ orgId: string; rol: string }> {
    if (user.role === 'admin_veterinaria') {
      throw new ForbiddenException('Admin Veterinaria debe usar invitaciones V2 con scope de veterinaria.');
    }
    // doble check: un admin solo gestiona miembros de su propia org.
    if (user.orgId !== orgId) {
      throw new ForbiddenException('Solo puedes gestionar miembros de tu propia organizacion.');
    }
    return this.tenant.asignarMiembro(orgId, dto.uid, dto.rol);
  }

  // GET /v1/organizaciones/:orgId/miembros -> listado (admin de la org o superadmin).
  @Roles('admin')
  @Get(':orgId/miembros')
  async miembros(@Param('orgId') orgId: string, @CurrentUser() user: AuthUser) {
    if (user.role === 'admin_veterinaria') {
      throw new ForbiddenException('Admin Veterinaria no puede listar miembros de toda la entidad.');
    }
    if (user.rol !== 'superadmin' && user.orgId !== orgId) {
      throw new ForbiddenException('Solo miembros de tu propia organizacion.');
    }
    return this.tenant.listarMiembros(orgId);
  }

  // PATCH /v1/organizaciones/:orgId/miembros/:uid/bloqueo -> bloquear/desbloquear miembro.
  @Roles('admin')
  @Patch(':orgId/miembros/:uid/bloqueo')
  async bloqueo(
    @Param('orgId') orgId: string,
    @Param('uid') uid: string,
    @Body() dto: BloqueoMiembroDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === 'admin_veterinaria') {
      throw new ForbiddenException('Admin Veterinaria no puede bloquear miembros de toda la entidad.');
    }
    if (user.rol !== 'superadmin' && user.orgId !== orgId) {
      throw new ForbiddenException('Solo miembros de tu propia organizacion.');
    }
    return this.tenant.setBloqueoMiembro(uid, dto.bloqueado);
  }

  // GET /v1/organizaciones/me -> devuelve la membresia del usuario actual (util para el front).
  @Get('me')
  async miMembresia(@CurrentUser() user: AuthUser): Promise<{ orgId: string | null; rol: string | null }> {
    const m = await this.tenant.obtenerMiembro(user.uid);
    return { orgId: m?.orgId ?? null, rol: m?.rol ?? null };
  }
}
