import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../src/common/auth/auth.guard';
import { RolesGuard } from '../../src/common/auth/roles.guard';
import { Rol } from '../../src/common/auth/auth-user.interface';

// Construye un ExecutionContext falso con un request dado y metadatos de reflector.
function makeContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('AuthGuard (fail-closed)', () => {
  const fakeFirebase = (verify: jest.Mock) =>
    ({ auth: { verifyIdToken: verify } }) as never;

  it('deja pasar rutas @Public sin token', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new AuthGuard(fakeFirebase(jest.fn()), reflector);
    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(true);
  });

  it('sin Authorization Bearer → 401', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new AuthGuard(fakeFirebase(jest.fn()), reflector);
    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('token invalido → 401', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const verify = jest.fn().mockRejectedValue(new Error('bad token'));
    const guard = new AuthGuard(fakeFirebase(verify), reflector);
    const ctx = makeContext({ headers: { authorization: 'Bearer xxx' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token valido → puebla req.user con claims', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const verify = jest
      .fn()
      .mockResolvedValue({ uid: 'u1', email: 'a@b.com', orgId: 'orgA', rol: 'admin' });
    const guard = new AuthGuard(fakeFirebase(verify), reflector);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer ok' } };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(req.user).toEqual({ uid: 'u1', email: 'a@b.com', orgId: 'orgA', rol: 'admin' });
  });

  it('claim de rol desconocido se descarta (rol undefined)', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const verify = jest.fn().mockResolvedValue({ uid: 'u1', rol: 'hacker' });
    const guard = new AuthGuard(fakeFirebase(verify), reflector);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer ok' } };
    await guard.canActivate(makeContext(req));
    expect((req.user as { rol?: Rol }).rol).toBeUndefined();
  });
});

describe('RolesGuard (jerarquico)', () => {
  const guardFor = (required?: Rol[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('sin @Roles deja pasar', () => {
    expect(guardFor(undefined).canActivate(makeContext({ user: { uid: 'u', rol: 'vet' } }))).toBe(
      true,
    );
  });

  it('rol insuficiente → 403', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'vet' } });
    expect(() => guardFor(['admin']).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rol exacto pasa', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'admin' } });
    expect(guardFor(['admin']).canActivate(ctx)).toBe(true);
  });

  it('superadmin pasa una ruta @Roles(admin) (jerarquia inclusiva)', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'superadmin' } });
    expect(guardFor(['admin']).canActivate(ctx)).toBe(true);
  });

  it('admin pasa una ruta @Roles(vet)', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'admin' } });
    expect(guardFor(['vet']).canActivate(ctx)).toBe(true);
  });

  it('solo superadmin pasa @Roles(superadmin); admin no alcanza → 403', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'admin' } });
    expect(() => guardFor(['superadmin']).canActivate(ctx)).toThrow(ForbiddenException);
    const ctxSuper = makeContext({ user: { uid: 'u', rol: 'superadmin' } });
    expect(guardFor(['superadmin']).canActivate(ctxSuper)).toBe(true);
  });

  it('sin rol → 403', () => {
    const ctx = makeContext({ user: { uid: 'u' } });
    expect(() => guardFor(['vet']).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('asistente no pasa @Roles(admin, vet) (p. ej. DELETE vacunas)', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'asistente' } });
    expect(() => guardFor(['admin', 'vet']).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('asistente no pasa @Roles(vet) (p. ej. POST aprobar consulta)', () => {
    const ctx = makeContext({ user: { uid: 'u', rol: 'asistente' } });
    expect(() => guardFor(['vet']).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('admin y vet pasan @Roles(admin, vet)', () => {
    expect(
      guardFor(['admin', 'vet']).canActivate(makeContext({ user: { uid: 'a', rol: 'admin' } })),
    ).toBe(true);
    expect(
      guardFor(['admin', 'vet']).canActivate(makeContext({ user: { uid: 'v', rol: 'vet' } })),
    ).toBe(true);
  });

  it('role V2 admin_veterinaria pasa rutas admin sin degradarse a admin_entidad', () => {
    const ctx = makeContext({ user: { uid: 'adminVet', role: 'admin_veterinaria' } });
    expect(guardFor(['admin']).canActivate(ctx)).toBe(true);
    expect(() => guardFor(['superadmin']).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('role V2 veterinario pasa rutas vet pero no admin', () => {
    const ctx = makeContext({ user: { uid: 'vet', role: 'veterinario' } });
    expect(guardFor(['vet']).canActivate(ctx)).toBe(true);
    expect(() => guardFor(['admin']).canActivate(ctx)).toThrow(ForbiddenException);
  });
});
