import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IaService } from './ia.service';
import { TranscribirDto } from './dto/transcribir.dto';
import { SoapDto } from './dto/soap.dto';
import { SoapResult } from './interfaces/gemini.interface';
import { Public } from '../../common/auth/public.decorator';
import { WorkerGuard } from './worker.guard';
import { IaJob } from './queue/queue.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';

@Controller('ia')
export class IaController {
  constructor(private readonly ia: IaService) {}

  // POST /v1/ia/transcribir -> { transcripcion }
  @Post('transcribir')
  @HttpCode(200)
  async transcribir(
    @Body() dto: TranscribirDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ transcripcion: string }> {
    return this.ia.transcribir({
      audioPath: dto.audioPath,
      audioBase64: dto.audioBase64,
      mimeType: dto.mimeType,
      audioContext: { uid: user.uid, orgId: user.orgId },
    });
  }

  // POST /v1/ia/soap -> SoapResult (mismo shape que generateSOAP del front)
  @Post('soap')
  @HttpCode(200)
  async soap(@Body() dto: SoapDto): Promise<SoapResult> {
    return this.ia.generarSoap(dto.transcripcion);
  }

  // POST /v1/ia/procesar -> worker que invoca Cloud Tasks (o la cola in-memory).
  // Publico (no lleva ID token de usuario) pero protegido por WorkerGuard / OIDC.
  @Public()
  @UseGuards(WorkerGuard)
  @Post('procesar')
  @HttpCode(200)
  async procesar(@Body() job: IaJob): Promise<{ ok: true }> {
    await this.ia.procesar(job);
    return { ok: true };
  }
}
