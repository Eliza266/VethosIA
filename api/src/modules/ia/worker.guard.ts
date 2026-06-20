import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { loadQueueConfig } from '../../common/config/env';

const MIN_SECRET_LEN_PROD = 32;

// Protege el endpoint worker (/v1/ia/procesar) que llama Cloud Tasks, no un usuario.
// FAIL-CLOSED en produccion: IA_WORKER_SECRET obligatorio (min 32 chars). Cloud Run usa
// --no-invoker-iam-check (HTTP publico a nivel IAM); un JWT con forma valida NO basta.
@Injectable()
export class WorkerGuard implements CanActivate {
  private readonly secret = loadQueueConfig().workerSecret;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const esProd = process.env.NODE_ENV === 'production' && !process.env.FIRESTORE_EMULATOR_HOST;

    if (esProd && !this.secret) {
      throw new UnauthorizedException(
        'Worker no autenticado: IA_WORKER_SECRET es obligatorio en produccion.',
      );
    }

    if (this.secret) {
      if (esProd && this.secret.length < MIN_SECRET_LEN_PROD) {
        throw new UnauthorizedException(
          'IA_WORKER_SECRET demasiado corto para produccion (min 32 caracteres).',
        );
      }
      const provided = req.header('x-worker-secret');
      if (!provided || !this.compararSecreto(provided, this.secret)) {
        throw new UnauthorizedException('Worker secret invalido.');
      }
      return true;
    }

    return true;
  }

  private compararSecreto(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
