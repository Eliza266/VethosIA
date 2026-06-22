import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import type { Response } from 'express';
import { HcService, NumeroHcResult } from './hc.service';
import { PdfService } from './pdf.service';
import { ConsultasService, AprobarResult } from './consultas.service';
import { EmailConsultaDto } from './dto/email.dto';
import { CrearConsultaDto } from './dto/crear-consulta.dto';
import { ActualizarConsultaDto } from './dto/actualizar-consulta.dto';
import { ConsultaDoc } from './consulta.types';
import { EmailService } from '../email/email.service';
import { IaService } from '../ia/ia.service';
import { ConsultasRepository } from './consultas.repository';
import { ProcesarConsultaDto } from '../ia/dto/procesar.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { assertAcceso } from '../../common/auth/access';

@Controller('consultas')
export class ConsultasController {
  constructor(
    private readonly hc: HcService,
    private readonly pdf: PdfService,
    private readonly consultasSvc: ConsultasService,
    private readonly email: EmailService,
    private readonly ia: IaService,
    private readonly consultas: ConsultasRepository,
  ) {}

  @Get()
  async listar(
    @CurrentUser() user: AuthUser,
    @Query('pacienteId') pacienteId?: string,
  ): Promise<ConsultaDoc[]> {
    return this.consultasSvc.listar(user, pacienteId);
  }

  @Post()
  @HttpCode(201)
  async crear(
    @Body() dto: CrearConsultaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ConsultaDoc> {
    return this.consultasSvc.crear(dto, user);
  }

  @Get(':id')
  async obtener(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<ConsultaDoc> {
    return this.consultasSvc.obtener(id, user);
  }

  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarConsultaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ConsultaDoc> {
    return this.consultasSvc.actualizar(id, dto, user);
  }

  // DELETE /v1/consultas/:id -> hard delete; bloquea consultas aprobadas (inmutables).
  @Roles('vet')
  @Delete(':id')
  @HttpCode(200)
  async eliminar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ eliminado: true }> {
    return this.consultasSvc.eliminar(id, user);
  }

  // POST /v1/consultas/:id/hc -> { numeroHC }. Reemplaza la Cloud Function generarNumeroHC
  // pero con numeracion por clinica (sin el contador global que se congestiona).
  @Post(':id/hc')
  @HttpCode(200)
  async generarHc(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<NumeroHcResult> {
    return this.hc.generarParaConsulta(id, user);
  }

  // POST /v1/consultas/:id/pdf -> { url } (signed URL temporal). Genera el PDF server-side.
  @Post(':id/pdf')
  @HttpCode(200)
  async generarPdf(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<{ url: string }> {
    return this.pdf.generar(id, user);
  }

  // GET /v1/consultas/:id/pdf-url -> { url } (signed URL aislada por tenant; regenera el PDF).
  @Get(':id/pdf-url')
  async pdfUrl(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<{ url: string }> {
    return this.pdf.generar(id, user);
  }

  // GET /v1/consultas/:id/pdf/download -> stream PDF (emulador: sustituto de signed URL).
  @Get(':id/pdf/download')
  async descargarPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.pdf.descargar(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // POST /v1/consultas/:id/email -> { success: true }.
  @Post(':id/email')
  @HttpCode(200)
  async enviarEmail(
    @Param('id') id: string,
    @Body() dto: EmailConsultaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    const consulta = await this.consultas.getById(id);
    assertAcceso(user, consulta);
    this.email.assertProviderConfigurado();
    const { url: pdfUrl } = await this.pdf.generar(id, user);
    return this.email.enviarHistorial({ ...dto, pdfUrl, actorUid: user.uid, orgId: user.orgId ?? null });
  }

  // POST /v1/consultas/:id/procesar -> encola el pipeline async de IA (no en el contrato base,
  // es el camino escalable de la fase 5: el cliente sube el audio a Storage y manda audioPath).
  @Post(':id/procesar')
  @HttpCode(202)
  async procesar(
    @Param('id') id: string,
    @Body() dto: ProcesarConsultaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ estado: 'procesando' }> {
    const consulta = await this.consultas.getById(id);
    assertAcceso(user, consulta);
    // gate de consumo (100% bloquea) + auditoria soap.inicio antes de encolar.
    await this.consultasSvc.prepararProcesamiento(id, user);
    await this.ia.encolarProcesamiento({
      consultaId: id,
      orgId: user.orgId ?? consulta.orgId,
      veterinarioId: consulta.veterinarioId,
      audioPath: dto.audioPath,
      audioPaths: dto.audioPaths,
      audioBase64: dto.audioBase64,
      mimeType: dto.mimeType,
    });
    return { estado: 'procesando' };
  }

  // POST /v1/consultas/:id/aprobar -> aprueba (solo lectura), propaga peso/talla y
  // descuenta 1 del consumo del plan. Idempotente. Asistente no puede aprobar.
  @Roles('vet')
  @Post(':id/aprobar')
  @HttpCode(200)
  async aprobar(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<AprobarResult> {
    return this.consultasSvc.aprobar(id, user);
  }

  // POST /v1/consultas/:id/enmienda -> crea una enmienda enlazada (no sobrescribe la aprobada).
  @Post(':id/enmienda')
  @HttpCode(201)
  async enmienda(
    @Param('id') id: string,
    @Body() contenido: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ): Promise<{ enmiendaId: string }> {
    return this.consultasSvc.crearEnmienda(id, user, contenido);
  }
}
