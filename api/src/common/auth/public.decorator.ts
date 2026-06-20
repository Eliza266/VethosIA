import { SetMetadata } from '@nestjs/common';

// Marca un endpoint como publico (sin Firebase ID token). Lo usa el AuthGuard.
// Ej: /v1/health y el endpoint worker que se autentica con su propio secreto/OIDC.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
