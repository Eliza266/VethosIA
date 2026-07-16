import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { PdfService } from './pdf.service';

// Endpoint publico (sin Firebase ID token): resuelve el link corto que se comparte por
// WhatsApp/correo con el propietario de la mascota, que no tiene cuenta en Vethos.
@Controller('pdf')
export class PdfLinkController {
  constructor(private readonly pdf: PdfService) {}

  @Public()
  @Get(':token')
  async resolver(
    @Param('token') token: string,
  ): Promise<{ ok: true; downloadUrl: string } | { ok: false }> {
    return this.pdf.resolverLinkPublico(token);
  }
}
