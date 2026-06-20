import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Rol, RequestWithUser, JERARQUIA_ROL, RolV2 } from './auth-user.interface';

// Corre despues del AuthGuard. Si el endpoint declara @Roles(...), exige que el rol del
// claim alcance el nivel minimo requerido. La jerarquia es inclusiva: superadmin > admin >
// vet > asistente, asi que @Roles('admin') tambien deja pasar a un superadmin. Si no hay
// @Roles, deja pasar (la autenticacion ya la garantizo el AuthGuard).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const rol = req.user?.rol ?? this.rolLegacyDesdeV2(req.user?.role);
    if (!rol) {
      throw new ForbiddenException('No tienes el rol necesario para esta operacion.');
    }

    // nivel minimo aceptable entre los roles requeridos (jerarquia inclusiva).
    const nivelMinimo = Math.min(...required.map((r) => JERARQUIA_ROL[r]));
    if (JERARQUIA_ROL[rol] < nivelMinimo) {
      throw new ForbiddenException('No tienes el rol necesario para esta operacion.');
    }
    return true;
  }

  private rolLegacyDesdeV2(role: RolV2 | undefined): Rol | undefined {
    switch (role) {
      case 'superadmin':
        return 'superadmin';
      case 'admin_entidad':
      case 'admin_veterinaria':
        return 'admin';
      case 'veterinario':
        return 'vet';
      default:
        return undefined;
    }
  }
}
