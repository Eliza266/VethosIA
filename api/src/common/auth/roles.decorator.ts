import { SetMetadata } from '@nestjs/common';
import { Rol } from './auth-user.interface';

export const ROLES_KEY = 'roles';
// @Roles('admin') restringe un endpoint a ciertos roles dentro de la org.
export const Roles = (...roles: Rol[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
