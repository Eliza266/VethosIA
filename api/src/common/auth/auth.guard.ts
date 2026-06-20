import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase/firebase.service';
import {
  AccountTypeV2,
  AuthUser,
  PlanOwnerTypeV2,
  ROLES_HUMANOS_V2,
  Rol,
  RolV2,
  RequestWithUser,
  VINCULOS_HUMANOS_V2,
  VinculoTipoV2,
} from './auth-user.interface';
import { IS_PUBLIC_KEY } from './public.decorator';

// Verifica el header Authorization: Bearer <Firebase ID token>, valida el token con
// firebase-admin y cuelga el usuario (con claims orgId/rol) en req.user.
// Las rutas marcadas @Public() (health, worker con su propio secreto) se saltan esto.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Falta el token Bearer.');
    }

    try {
      const decoded = await this.firebase.auth.verifyIdToken(token);
      const user: AuthUser = {
        uid: decoded.uid,
        email: decoded.email,
        // los claims pueden no existir todavia (usuario legacy sin org).
        orgId: typeof decoded.orgId === 'string' ? decoded.orgId : undefined,
        rol: this.parseRol(decoded.rol),
        v: decoded.v === 2 ? 2 : undefined,
        role: this.parseRolV2(decoded.role),
        accountType: this.parseAccountType(decoded.accountType),
        accountId: typeof decoded.accountId === 'string' ? decoded.accountId : undefined,
        entidadId: typeof decoded.entidadId === 'string' ? decoded.entidadId : undefined,
        veterinariaId: typeof decoded.veterinariaId === 'string' ? decoded.veterinariaId : undefined,
        membershipId: typeof decoded.membershipId === 'string' ? decoded.membershipId : undefined,
        planOwnerType: this.parsePlanOwnerType(decoded.planOwnerType),
        planOwnerId: typeof decoded.planOwnerId === 'string' ? decoded.planOwnerId : undefined,
        vinculoTipo: this.parseVinculoTipo(decoded.vinculoTipo),
      };
      req.user = user;
      return true;
    } catch {
      // no logueamos el token, obvio. Solo que fallo la verificacion.
      throw new UnauthorizedException('Token invalido o expirado.');
    }
  }

  private extractToken(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }

  private parseRol(rol: unknown): Rol | undefined {
    return rol === 'superadmin' || rol === 'admin' || rol === 'vet' || rol === 'asistente'
      ? rol
      : undefined;
  }

  private parseRolV2(role: unknown): RolV2 | undefined {
    return typeof role === 'string' && ROLES_HUMANOS_V2.includes(role as RolV2)
      ? (role as RolV2)
      : undefined;
  }

  private parseAccountType(value: unknown): AccountTypeV2 | undefined {
    return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad'
      ? value
      : undefined;
  }

  private parsePlanOwnerType(value: unknown): PlanOwnerTypeV2 | undefined {
    return value === 'vet' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
  }

  private parseVinculoTipo(value: unknown): VinculoTipoV2 | undefined {
    return typeof value === 'string' && VINCULOS_HUMANOS_V2.includes(value as VinculoTipoV2)
      ? (value as VinculoTipoV2)
      : undefined;
  }
}
