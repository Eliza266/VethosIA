import { BadRequestException, ForbiddenException } from '@nestjs/common';

export interface AudioPathContext {
  uid: string;
  orgId?: string;
}

/** Valida que la ruta de audio pertenezca al usuario u org del tenant (anti cross-tenant). */
export function assertAudioPathPermitido(path: string, ctx: AudioPathContext): void {
  const normalizado = path.trim();
  if (!normalizado || normalizado.includes('..') || normalizado.startsWith('/')) {
    throw new BadRequestException('audioPath invalido.');
  }
  const match = normalizado.match(/^audios\/([^/]+)\/.+$/);
  if (!match) {
    throw new BadRequestException('audioPath debe estar bajo audios/{uid|orgId}/...');
  }
  const segmento = match[1];
  const permitido =
    segmento === ctx.uid || (ctx.orgId !== undefined && segmento === ctx.orgId);
  if (!permitido) {
    throw new ForbiddenException('No tienes acceso a ese audio.');
  }
}
