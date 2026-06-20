import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConsultasController } from '../../src/modules/consultas/consultas.controller';
import { ConsultasService } from '../../src/modules/consultas/consultas.service';
import { HcService } from '../../src/modules/consultas/hc.service';
import { PdfService } from '../../src/modules/consultas/pdf.service';
import { EmailService } from '../../src/modules/email/email.service';
import { IaService } from '../../src/modules/ia/ia.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { RolesGuard } from '../../src/common/auth/roles.guard';
import { ROLES_KEY } from '../../src/common/auth/roles.decorator';
import { Rol } from '../../src/common/auth/auth-user.interface';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: unknown }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer role-')) {
      throw new UnauthorizedException('Falta el token Bearer.');
    }
    const rol = header.replace('Bearer role-', '') as Rol;
    req.user = { uid: 'u-test', orgId: 'org-test', rol, email: `${rol}@test.local` };
    return true;
  }
}

describe('POST /v1/consultas/:id/aprobar RBAC', () => {
  let app: INestApplication;
  const aprobarMock = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConsultasController],
      providers: [
        { provide: ConsultasService, useValue: { aprobar: aprobarMock } },
        { provide: HcService, useValue: {} },
        { provide: PdfService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: IaService, useValue: {} },
        { provide: ConsultasRepository, useValue: {} },
        { provide: APP_GUARD, useClass: MockAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    aprobarMock.mockReset();
    aprobarMock.mockImplementation(async (_id: string, user: { rol?: Rol }) => {
      if (user.rol !== 'vet') {
        throw new ForbiddenException('Tu rol no permite operar flujos clinicos tenant.');
      }
      return { estado: 'aprobada' };
    });
  });

  it('declara @Roles(vet) en el handler aprobar', () => {
    const reflector = new Reflector();
    const roles = reflector.get<Rol[]>(ROLES_KEY, ConsultasController.prototype.aprobar);
    expect(roles).toEqual(['vet']);
  });

  it('vet aprueba -> 200', async () => {
    await request(app.getHttpServer())
      .post('/v1/consultas/c1/aprobar')
      .set('Authorization', 'Bearer role-vet')
      .expect(200)
      .expect({ estado: 'aprobada' });
    expect(aprobarMock).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'superadmin'] as const)(
    '%s llega al handler legacy pero el servicio bloquea -> 403',
    async (rol) => {
      await request(app.getHttpServer())
        .post('/v1/consultas/c1/aprobar')
        .set('Authorization', `Bearer role-${rol}`)
        .expect(403);
      expect(aprobarMock).toHaveBeenCalledTimes(1);
    },
  );

  it('asistente aprueba -> 403 y no invoca servicio', async () => {
    await request(app.getHttpServer())
      .post('/v1/consultas/c1/aprobar')
      .set('Authorization', 'Bearer role-asistente')
      .expect(403);
    expect(aprobarMock).not.toHaveBeenCalled();
  });

  it('sin auth -> 401', async () => {
    await request(app.getHttpServer()).post('/v1/consultas/c1/aprobar').expect(401);
    expect(aprobarMock).not.toHaveBeenCalled();
  });
});
