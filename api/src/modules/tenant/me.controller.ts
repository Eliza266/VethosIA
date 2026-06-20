import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AccesoService } from '../plataforma/acceso.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import {
  AccountTypeV2,
  AuthUser,
  PlanOwnerTypeV2,
  Rol,
  RolV2,
  VinculoTipoV2,
} from '../../common/auth/auth-user.interface';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

export interface MeResponse {
  uid: string;
  email: string | null;
  orgId: string | null;
  rol: Rol | null;
  role: RolV2 | null;
  accountType: AccountTypeV2 | null;
  accountId: string | null;
  entidadId: string | null;
  veterinariaId: string | null;
  membershipId: string | null;
  planOwnerType: PlanOwnerTypeV2 | null;
  planOwnerId: string | null;
  vinculoTipo: VinculoTipoV2 | null;
  nombre: string | null;
  foto: string | null;
  telefono: string | null;
  whatsapp: string | null;
  ciudad: string | null;
  sede: string | null;
  veterinaria: string | null;
  matriculaProfesional: string | null;
  organizacionNombre: string | null;
  veterinariaNombre: string | null;
}

// GET/PATCH /v1/me -> identidad, claims, membresia y perfil veterinario del usuario actual.
@Controller('me')
export class MeController {
  constructor(
    private readonly tenant: TenantService,
    private readonly acceso: AccesoService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    await this.acceso.validarEmailPermitido(user.email);
    return this.buildMeResponse(user, true);
  }

  @Patch()
  async actualizarPerfil(
    @CurrentUser() user: AuthUser,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<MeResponse> {
    await this.acceso.validarEmailPermitido(user.email);
    await this.tenant.asegurarPerfilVeterinario(user.uid, {
      nombre: user.email ? undefined : 'Veterinario',
      email: user.email ?? null,
    });
    await this.tenant.actualizarPerfilVeterinario(user.uid, { ...dto });
    return this.buildMeResponse(user, false);
  }

  private async buildMeResponse(user: AuthUser, asegurarPerfil: boolean): Promise<MeResponse> {
    const membershipV2 =
      user.role && user.accountId
        ? null
        : await this.tenant.obtenerMembershipV2(user.uid, user.membershipId);
    const miembro =
      (user.orgId && user.rol) || membershipV2 ? null : await this.tenant.obtenerMiembro(user.uid);
    const orgId = user.orgId ?? membershipV2?.orgId ?? miembro?.orgId ?? null;
    const rol = user.rol ?? membershipV2?.rol ?? miembro?.rol ?? null;
    const role = user.role ?? membershipV2?.role ?? null;
    const accountType = user.accountType ?? membershipV2?.accountType ?? null;
    const accountId = user.accountId ?? membershipV2?.accountId ?? null;
    const entidadId = user.entidadId ?? membershipV2?.entidadId ?? null;
    const veterinariaId = user.veterinariaId ?? membershipV2?.veterinariaId ?? null;
    const membershipId = user.membershipId ?? membershipV2?.membershipId ?? null;
    const planOwnerType = user.planOwnerType ?? membershipV2?.planOwnerType ?? null;
    const planOwnerId = user.planOwnerId ?? membershipV2?.planOwnerId ?? null;
    const vinculoTipo = user.vinculoTipo ?? membershipV2?.vinculoTipo ?? null;

    const perfil = asegurarPerfil
      ? await this.tenant.asegurarPerfilVeterinario(user.uid, {
          email: user.email ?? null,
        })
      : (await this.tenant.obtenerPerfilVeterinario(user.uid)) ??
        (await this.tenant.asegurarPerfilVeterinario(user.uid, {
          email: user.email ?? null,
        }));

    const [organizacionNombre, veterinariaNombre] = await Promise.all([
      orgId ? this.tenant.obtenerNombreOrganizacion(orgId) : Promise.resolve(null),
      veterinariaId ? this.tenant.obtenerNombreVeterinaria(veterinariaId) : Promise.resolve(null),
    ]);

    return {
      uid: user.uid,
      email: user.email ?? perfil.email ?? null,
      orgId,
      rol,
      role,
      accountType,
      accountId,
      entidadId,
      veterinariaId,
      membershipId,
      planOwnerType,
      planOwnerId,
      vinculoTipo,
      nombre: perfil.nombre ?? null,
      foto: perfil.foto ?? null,
      telefono: perfil.telefono ?? null,
      whatsapp: perfil.whatsapp ?? null,
      ciudad: perfil.ciudad ?? null,
      sede: perfil.sede ?? null,
      veterinaria: perfil.veterinaria ?? null,
      matriculaProfesional: perfil.matriculaProfesional ?? null,
      organizacionNombre,
      veterinariaNombre,
    };
  }
}
