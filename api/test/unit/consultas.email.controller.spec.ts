import { ConflictException } from '@nestjs/common';
import { ConsultasController } from '../../src/modules/consultas/consultas.controller';
import { EMAIL_PROVIDER_NOT_CONFIGURED } from '../../src/modules/email/email.service';
import type { AuthUser } from '../../src/common/auth/auth-user.interface';

describe('ConsultasController email', () => {
  it('devuelve error controlado sin generar PDF si el proveedor de email no esta configurado', async () => {
    const providerError = new ConflictException({
      code: EMAIL_PROVIDER_NOT_CONFIGURED,
      message: 'Email no configurado.',
    });
    const pdf = { generar: jest.fn() };
    const email = {
      assertProviderConfigurado: jest.fn(() => {
        throw providerError;
      }),
      enviarHistorial: jest.fn(),
    };
    const consultas = {
      getById: jest.fn().mockResolvedValue({
        id: 'c1',
        orgId: 'org1',
        veterinarioId: 'vet1',
      }),
    };
    const controller = new ConsultasController(
      {} as never,
      pdf as never,
      {} as never,
      email as never,
      {} as never,
      consultas as never,
      {} as never,
    );
    const user = { uid: 'vet1', rol: 'vet', orgId: 'org1' } as AuthUser;

    await expect(
      controller.enviarEmail(
        'c1',
        {
          emailDestinatario: 'qa@example.com',
          nombrePaciente: 'Mascota QA',
          nombrePropietario: 'Propietario QA',
          nombreVet: 'Vet QA',
        },
        user,
      ),
    ).rejects.toBe(providerError);

    expect(email.assertProviderConfigurado).toHaveBeenCalledTimes(1);
    expect(pdf.generar).not.toHaveBeenCalled();
    expect(email.enviarHistorial).not.toHaveBeenCalled();
  });
});
