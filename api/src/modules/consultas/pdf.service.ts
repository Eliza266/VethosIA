import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { StorageService } from '../storage/storage.service';
import { ConsultasRepository } from './consultas.repository';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { assertAcceso, particionTenant } from '../../common/auth/access';
import { filterClinicalSubrecordsForPatient } from '../../common/auth/clinical-history-scope';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { loadAppConfig } from '../../common/config/env';
import {
  DiagnosticoEstructurado,
  normalizarDiagnosticosEstructurados,
  textoDiagnosticoFallback,
} from './diagnostico-estructurado';

const ND = 'No documentado';
const EMPTY_FIELD = 'No registrado';
const EMPTY_SECTION = 'Sin información documentada en esta consulta';
const FECHA_COLOMBIA = 'America/Bogota';

const COLOR = {
  brand: '#0F6E56',
  brandDark: '#0A4D3C',
  brandLight: '#E8F5F1',
  brandSoft: '#F0FAF7',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#D1D5DB',
  borderLight: '#E5E7EB',
  white: '#FFFFFF',
  soapAccent: '#94A3B8',
} as const;

const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  rutina: 'Rutina',
  seguimiento: 'Seguimiento',
  brigada: 'Brigada',
};

const SEXO_LABELS: Record<string, string> = {
  macho: 'Macho',
  hembra: 'Hembra',
  desconocido: 'Desconocido',
};

const ESTADO_REPRODUCTIVO_LABELS: Record<string, string> = {
  entero: 'Entero',
  castrado: 'Castrado',
  esterilizado: 'Esterilizado',
  desconocido: 'Desconocido',
};

export interface MedicamentoPdf {
  nombre: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  indicacion: string;
}

export interface VitalPdf {
  label: string;
  value: string;
}

export interface ModeloPdf {
  entidad: {
    nombre: string;
    sede: string;
    ciudad: string;
    telefono: string;
  };
  numeroHC: string;
  fechaConsulta: string;
  fechaImpresion: string;
  prioridad: string;
  motivo: string;
  propietario: {
    nombre: string;
    telefono: string;
    email: string;
    whatsapp: string;
  };
  paciente: {
    codigo: string;
    nombre: string;
    especie: string;
    raza: string;
    sexo: string;
    estadoReproductivo: string;
    edad: string;
    color: string;
    chip: string;
  };
  anamnesis: string;
  examenFisico: {
    vitales: VitalPdf[];
    hallazgos: string;
  };
  revisionSistemas: string;
  soap: { subjetivo: string; objetivo: string; analisis: string; plan: string };
  diagnosticos: DiagnosticoEstructurado[];
  diagnostico: string;
  examenesComplementarios: string;
  planTerapeutico: string;
  medicamentos: MedicamentoPdf[];
  evolucion: string;
  observaciones: string;
  vetNombre: string;
  matricula: string;
  /** @deprecated Usar entidad.nombre; se mantiene por compatibilidad interna. */
  veterinaria: string;
  transcripcion: string;
}

/** Texto visible en celdas y campos cortos sin datos. */
export function displayPdfField(value: string): string {
  return value === ND ? EMPTY_FIELD : value;
}

/** Texto visible cuando una sección completa no tiene datos clínicos. */
export function displayPdfSection(value: string): string {
  return value === ND ? EMPTY_SECTION : value;
}

/** Altura del bloque de título de sección (padding + drawBlockTitle). */
export const PDF_SECTION_TITLE_BLOCK_HEIGHT = 22;

/** Altura del bloque de firma en layout estándar. */
export const PDF_SIGNATURE_BLOCK_FULL_HEIGHT = 96;

/** Altura del bloque de firma compacto (espacio limitado al final de página). */
export const PDF_SIGNATURE_BLOCK_COMPACT_HEIGHT = 76;

/** Padding vertical de la sección de firma (antes del título + después del bloque). */
export const PDF_SIGNATURE_SECTION_PADDING = 6;

/** Altura de un subheading antes del primer bloque de contenido. */
export const PDF_SUBHEADING_HEIGHT = 13;

/** Margen vertical que drawSoapCards aplica tras cada card (ensureSpace + avance de cursor). */
export const PDF_SOAP_CARD_TRAILING_GAP = 8;

/** Indica si conviene saltar de página antes de dibujar título + primer bloque (evita heading huérfano). */
export function needsPageBreakBeforeBlock(
  currentY: number,
  bottomLimit: number,
  headerHeight: number,
  firstBlockHeight: number,
): boolean {
  return currentY + headerHeight + firstBlockHeight > bottomLimit;
}

/** @deprecated Usar displayPdfSection; alias para compatibilidad con tests. */
export function displayPdfValue(value: string): string {
  return displayPdfSection(value);
}

// PDF server-side UNICO (pdfkit). Reglas: solo historias APROBADAS son exportables; el
// almacenamiento esta aislado por tenant (historiales/{tenant}/{id}.pdf) y la exportacion
// queda registrada en auditoria. construirModelo es puro (testeable sin pdfkit).
@Injectable()
export class PdfService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly storage: StorageService,
    private readonly consultas: ConsultasRepository,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async generar(consultaId: string, user: AuthUser): Promise<{ url: string }> {
    const consulta = await this.consultas.getById(consultaId);
    assertAcceso(user, consulta);
    if (consulta.estado !== 'aprobada') {
      throw new BadRequestException('Solo se pueden exportar historias aprobadas.');
    }

    const [consultaRaw, paciente, vet, entidad] = await Promise.all([
      this.leerDoc(COLLECTIONS.consultas, consultaId),
      this.leerDoc(COLLECTIONS.pacientes, consulta.pacienteId),
      this.leerDoc(COLLECTIONS.veterinarios, consulta.veterinarioId),
      this.leerDoc(COLLECTIONS.organizaciones, consulta.orgId),
    ]);

    const modelo = this.construirModelo(consultaRaw, paciente, vet, entidad);
    const buffer = await this.render(modelo);
    const tenant = consulta.orgId ?? particionTenant(user, consulta);
    const path = `historiales/${tenant}/${consultaId}.pdf`;
    await this.storage.subirBuffer(path, buffer, 'application/pdf');
    const url = await this.urlAccesoPdf(consultaId, path);

    await this.auditoria.registrar({
      accion: 'pdf.exportar',
      actorUid: user.uid,
      orgId: consulta.orgId ?? null,
      recurso: consultaId,
    });
    await this.notificaciones.crear({
      destinatarioUid: user.uid,
      orgId: consulta.orgId ?? null,
      tipo: 'pdf_generado',
      titulo: 'PDF generado',
      cuerpo: `El PDF de la consulta ${consulta.numeroHC ?? consultaId} quedo disponible.`,
      resourceType: 'consulta',
      resourceId: consultaId,
      resourcePath: rutaConsultaPaciente(consulta.pacienteId, consultaId),
      pacienteId: consulta.pacienteId,
      consultaId,
      dedupeKey: `pdf_generado:${consultaId}:${user.uid}`,
    });
    return { url };
  }

  /** Descarga el PDF ya generado (Admin SDK; no depende de reglas del Storage emulator). */
  async descargar(
    consultaId: string,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const consulta = await this.consultas.getById(consultaId);
    assertAcceso(user, consulta);
    if (consulta.estado !== 'aprobada') {
      throw new BadRequestException('Solo se pueden exportar historias aprobadas.');
    }
    const tenant = consulta.orgId ?? particionTenant(user, consulta);
    const path = `historiales/${tenant}/${consultaId}.pdf`;
    const { buffer } = await this.storage.descargar(path);
    const numero = consulta.numeroHC ?? consultaId;
    return { buffer, filename: `HC_${numero}.pdf` };
  }

  private async urlAccesoPdf(consultaId: string, storagePath: string): Promise<string> {
    const cfg = loadAppConfig();
    if (cfg.useEmulators) {
      return `http://127.0.0.1:${cfg.port}/${cfg.apiPrefix}/consultas/${consultaId}/pdf/download`;
    }
    return this.storage.signedUrl(storagePath);
  }

  // Modelo puro a partir de los docs crudos (testeable sin renderizar el PDF).
  construirModelo(
    consulta: Record<string, unknown>,
    paciente: Record<string, unknown>,
    vet: Record<string, unknown>,
    entidad: Record<string, unknown> = {},
  ): ModeloPdf {
    const str = (v: unknown, def = ND): string =>
      typeof v === 'string' && v.trim().length > 0 ? v.trim() : def;
    const numStr = (v: unknown, suffix: string): string | null => {
      if (typeof v === 'number' && !Number.isNaN(v)) return `${v}${suffix}`;
      return null;
    };

    const soap = (consulta.soap ?? {}) as Record<string, unknown>;
    const prop = (paciente.propietario ?? {}) as Record<string, unknown>;
    const sv = (consulta.signosVitales ?? {}) as Record<string, unknown>;

    const nombreEntidad =
      typeof entidad.nombre === 'string' && entidad.nombre.length > 0
        ? entidad.nombre
        : str(vet.veterinaria, ND);

    const ciudadEntidad =
      typeof entidad.ciudad === 'string' && entidad.ciudad.length > 0
        ? entidad.ciudad
        : str(vet.ciudad, ND);

    const telefonoEntidad = str(vet.telefono, str(vet.whatsapp, ND));

    const vitales: VitalPdf[] = [
      { label: 'Peso', value: numStr(sv.peso, ' kg') ?? ND },
      { label: 'Talla', value: numStr(sv.talla, ' cm') ?? ND },
      { label: 'Temperatura', value: numStr(sv.temperatura, ' °C') ?? ND },
      { label: 'Frec. cardiaca', value: numStr(sv.frecuenciaCardiaca, ' lpm') ?? ND },
      { label: 'Frec. respiratoria', value: numStr(sv.frecuenciaRespiratoria, ' rpm') ?? ND },
      {
        label: 'Cond. corporal',
        value: numStr(sv.condicionCorporal, '/5') ?? ND,
      },
    ];

    const revisionPartes: string[] = [];
    if (typeof sv.mucosas === 'string' && sv.mucosas.trim()) {
      revisionPartes.push(`Mucosas: ${sv.mucosas.trim()}`);
    }
    if (typeof sv.deshidratacion === 'string' && sv.deshidratacion.trim()) {
      revisionPartes.push(`Deshidratación: ${sv.deshidratacion.trim()}`);
    }
    if (typeof sv.pulso === 'string' && sv.pulso.trim()) {
      revisionPartes.push(`Pulso: ${sv.pulso.trim()}`);
    }

    const medicamentos = this.parseMedicamentos(soap.medicamentosSugeridos);
    const diagnosticos = normalizarDiagnosticosEstructurados(consulta.diagnosticoEstructurado, {
      strict: false,
    });

    const motivo = str(consulta.motivo, ND);
    const subjetivo = str(soap.subjetivo, ND);
    const anamnesis =
      motivo !== ND && subjetivo !== ND
        ? `Motivo de consulta: ${motivo}\n\n${subjetivo}`
        : motivo !== ND
          ? `Motivo de consulta: ${motivo}`
          : subjetivo;

    const observacionesPartes: string[] = [];
    const transcripcion = str(consulta.transcripcion, '');
    if (transcripcion) observacionesPartes.push(`Transcripción original:\n${transcripcion}`);
    const notasPaciente = str(paciente.notas, '');
    if (notasPaciente && notasPaciente !== ND) {
      observacionesPartes.push(`Notas del paciente:\n${notasPaciente}`);
    }

    const prioridadRaw = typeof consulta.prioridad === 'string' ? consulta.prioridad : 'rutina';
    const sexoRaw = typeof paciente.sexo === 'string' ? paciente.sexo : '';
    const estadoRepRaw =
      typeof paciente.estadoReproductivo === 'string' ? paciente.estadoReproductivo : '';

    return {
      entidad: {
        nombre: nombreEntidad,
        sede: str(vet.sede, ND),
        ciudad: ciudadEntidad,
        telefono: telefonoEntidad,
      },
      numeroHC: str(consulta.numeroHC, 'S/N'),
      fechaConsulta: formatFechaHora(consulta.fechaHora ?? consulta.creadoEn),
      fechaImpresion: formatFechaHora(new Date()),
      prioridad: PRIORIDAD_LABELS[prioridadRaw] ?? prioridadRaw,
      motivo,
      propietario: {
        nombre: str(prop.nombre),
        telefono: str(prop.telefono),
        email: str(prop.email),
        whatsapp: str(prop.whatsapp),
      },
      paciente: {
        codigo: str(paciente.codigo, ND),
        nombre: str(paciente.nombre),
        especie: str(paciente.especie),
        raza: str(paciente.raza),
        sexo: SEXO_LABELS[sexoRaw] ?? (sexoRaw || ND),
        estadoReproductivo: ESTADO_REPRODUCTIVO_LABELS[estadoRepRaw] ?? (estadoRepRaw || ND),
        edad: calcEdad(paciente.fechaNacimiento, paciente.edad),
        color: str(paciente.color),
        chip: str(paciente.chip),
      },
      anamnesis,
      examenFisico: {
        vitales,
        hallazgos: str(soap.objetivo, ND),
      },
      revisionSistemas: revisionPartes.length > 0 ? revisionPartes.join('\n') : ND,
      soap: {
        subjetivo: str(soap.subjetivo, ND),
        objetivo: str(soap.objetivo, ND),
        analisis: str(soap.analisis, ND),
        plan: str(soap.plan, ND),
      },
      diagnosticos,
      diagnostico: str(textoDiagnosticoFallback(diagnosticos, str(soap.analisis, '')), ND),
      examenesComplementarios: ND,
      planTerapeutico: str(soap.plan, ND),
      medicamentos,
      evolucion: ND,
      observaciones: observacionesPartes.length > 0 ? observacionesPartes.join('\n\n') : ND,
      vetNombre: str(vet.nombre, 'Veterinario'),
      matricula:
        typeof vet.matriculaProfesional === 'string' && vet.matriculaProfesional.trim()
          ? vet.matriculaProfesional.trim()
          : ND,
      veterinaria: nombreEntidad,
      transcripcion,
    };
  }

  private parseMedicamentos(raw: unknown): MedicamentoPdf[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        nombre: typeof m.nombre === 'string' ? m.nombre : ND,
        dosis: typeof m.dosis === 'string' ? m.dosis : ND,
        via: typeof m.via === 'string' ? m.via : ND,
        frecuencia: typeof m.frecuencia === 'string' ? m.frecuencia : ND,
        duracion: typeof m.duracion === 'string' ? m.duracion : ND,
        indicacion: typeof m.indicacion === 'string' ? m.indicacion : ND,
      }))
      .filter((m) => m.nombre !== ND || m.dosis !== ND);
  }

  async generarHistorialCompleto(pacienteId: string, user: AuthUser): Promise<{ url: string }> {
    const paciente = await this.leerDoc(COLLECTIONS.pacientes, pacienteId);
    assertAcceso(user, paciente as { orgId?: string; veterinarioId?: string });

    const snap = await this.firebase.firestore
      .collection(COLLECTIONS.consultas)
      .where('pacienteId', '==', pacienteId)
      .get();
    const aprobadas: Record<string, unknown>[] = snap.docs
      .map((d): Record<string, unknown> => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .filter((c) => (c as Record<string, unknown>).estado === 'aprobada');
    const aprobadasScope = filterClinicalSubrecordsForPatient(aprobadas, paciente, pacienteId)
      .filter((consulta) => {
        try {
          assertAcceso(user, consulta);
          return true;
        } catch {
          return false;
        }
      });
    if (aprobadasScope.length === 0) {
      throw new BadRequestException('El paciente no tiene historias aprobadas para exportar.');
    }

    const orgId = (paciente.orgId as string | undefined) ?? user.orgId;
    const [vet, entidad] = await Promise.all([
      this.leerDoc(COLLECTIONS.veterinarios, (paciente.veterinarioId as string) ?? user.uid),
      this.leerDoc(COLLECTIONS.organizaciones, orgId),
    ]);
    const modelos = aprobadasScope.map((c) => this.construirModelo(c, paciente, vet, entidad));
    const buffer = await this.renderHistorial(modelos);

    const tenant = orgId ?? particionTenant(user, paciente as { orgId?: string; veterinarioId?: string });
    const path = `historiales/${tenant}/paciente-${pacienteId}.pdf`;
    await this.storage.subirBuffer(path, buffer, 'application/pdf');
    const url = await this.storage.signedUrl(path);

    await this.auditoria.registrar({
      accion: 'pdf.exportar',
      actorUid: user.uid,
      orgId: orgId ?? null,
      recurso: `paciente:${pacienteId}`,
      meta: { historialCompleto: true, consultas: aprobadasScope.length },
    });
    return { url };
  }

  private renderHistorial(modelos: ModeloPdf[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 70, left: 50, right: 50 },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ctx = new PdfLayout(doc);
      const cab = modelos[0];
      ctx.drawPortadaHistorial(cab, modelos.length);

      modelos.forEach((m, i) => {
        if (i > 0) ctx.newPage();
        ctx.drawHistoriaClinica(m, { tituloExtra: `Consulta ${i + 1} de ${modelos.length}` });
      });

      ctx.drawFooters('Vethos AI — Historial clínico completo');
      doc.end();
    });
  }

  private async leerDoc(col: string, id?: string): Promise<Record<string, unknown>> {
    if (!id) return {};
    const snap = await this.firebase.firestore.collection(col).doc(id).get();
    return (snap.data() ?? {}) as Record<string, unknown>;
  }

  private render(m: ModeloPdf, opts?: { compress?: boolean }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 70, left: 50, right: 50 },
        bufferPages: true,
        compress: opts?.compress ?? true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ctx = new PdfLayout(doc);
      ctx.drawHistoriaClinica(m);
      ctx.drawFooters('Vethos AI — Historia clínica veterinaria');
      doc.end();
    });
  }
}

/** Utilidades de layout premium para pdfkit (multipágina, tablas, secciones). */
class PdfLayout {
  private readonly pageWidth: number;
  private readonly contentWidth: number;
  private readonly left: number;
  private readonly bottomLimit: number;
  private y: number;
  private contentPageIndex = 0;

  constructor(private readonly doc: PDFKit.PDFDocument) {
    this.pageWidth = doc.page.width;
    this.left = doc.page.margins.left;
    this.contentWidth = this.pageWidth - doc.page.margins.left - doc.page.margins.right;
    this.bottomLimit = doc.page.height - doc.page.margins.bottom;
    this.y = doc.page.margins.top;
    this.resetCursor();
  }

  drawPortadaHistorial(cab: ModeloPdf | undefined, totalConsultas: number): void {
    this.drawHeaderBand(cab?.entidad ?? { nombre: ND, sede: ND, ciudad: ND, telefono: ND });
    this.y += 8;
    this.drawBlockTitle('Historial clínico completo');
    if (cab) {
      this.drawTwoColumnInfoCards(
        'Paciente',
        [
          ['Nombre', cab.paciente.nombre],
          ['Código', cab.paciente.codigo],
          ['Especie', cab.paciente.especie],
        ],
        'Resumen',
        [
          ['Propietario', cab.propietario.nombre],
          ['Consultas incluidas', String(totalConsultas)],
          ['Entidad', cab.entidad.nombre],
        ],
      );
    }
    this.y += 12;
  }

  drawHistoriaClinica(m: ModeloPdf, opts?: { tituloExtra?: string }): void {
    this.contentPageIndex = 0;
    this.y = this.doc.page.margins.top;
    this.resetCursor();

    this.drawHeaderBand(m.entidad);
    this.drawHcBanner(m.numeroHC, m.fechaConsulta, m.prioridad, opts?.tituloExtra);
    this.drawClinicalSummary(m);

    this.drawTwoColumnInfoCards(
      'Propietario',
      [
        ['Nombre', m.propietario.nombre],
        ['Teléfono', m.propietario.telefono],
        ['WhatsApp', m.propietario.whatsapp],
        ['Correo', m.propietario.email],
      ],
      'Paciente',
      [
        ['Código', m.paciente.codigo],
        ['Nombre', m.paciente.nombre],
        ['Especie', m.paciente.especie],
        ['Raza', m.paciente.raza],
        ['Sexo', m.paciente.sexo],
        ['Edad', m.paciente.edad],
        ['Estado reproductivo', m.paciente.estadoReproductivo],
        ['Color', m.paciente.color],
        ['Microchip', m.paciente.chip],
      ],
    );

    this.drawSection('Anamnesis', () => {
      this.drawParagraph(m.anamnesis);
    });

    this.drawSection('Examen físico', () => {
      this.drawSubheading('Signos vitales y constantes');
      this.drawVitalesCards(m.examenFisico.vitales);
      this.y += 6;
      this.drawSubheading('Hallazgos del examen');
      this.drawParagraph(m.examenFisico.hallazgos);
    });

    this.drawSection('Revisión por sistemas', () => {
      this.drawParagraph(m.revisionSistemas);
    });

    this.drawSection(
      'Nota clínica SOAP',
      () => {
        this.drawSoapCards(m.soap);
      },
      { minFirstBlockHeight: this.measureSoapCardHeight(m.soap.subjetivo) },
    );

    this.drawSection(
      'Diagnóstico',
      () => {
        this.drawHighlightBox(m.diagnostico, COLOR.brandDark, COLOR.brandLight);
      },
      { minFirstBlockHeight: this.measureHighlightBoxHeight(m.diagnostico) },
    );

    this.drawSection('Exámenes complementarios', () => {
      this.drawParagraph(m.examenesComplementarios);
    });

    this.drawSection(
      'Plan terapéutico',
      () => {
        this.drawHighlightBox(m.planTerapeutico, COLOR.brandDark, COLOR.brandLight);
        if (m.medicamentos.length > 0) {
          this.y += 8;
          this.ensureSpaceForSubsection(this.measureMedicamentoCardHeight(m.medicamentos[0]));
          this.drawSubheading('Medicamentos prescritos');
          this.drawMedicamentosCards(m.medicamentos);
        }
      },
      { minFirstBlockHeight: this.measureHighlightBoxHeight(m.planTerapeutico) },
    );

    if (m.evolucion !== ND) {
      this.drawSection('Evolución', () => {
        this.drawParagraph(m.evolucion);
      });
    }

    this.drawSection('Observaciones y anexos', () => {
      this.drawParagraph(m.observaciones);
    });

    this.drawSignatureSection(m);
  }

  drawFooters(tagline: string): void {
    const range = this.doc.bufferedPageRange();
    const totalPages = range.count;
    const impreso = formatFechaHora(new Date());
    const lastPage = range.start + totalPages - 1;

    for (let i = 0; i < totalPages; i++) {
      const pageIndex = range.start + i;
      this.doc.switchToPage(pageIndex);
      const page = this.doc.page;
      const right = page.width - page.margins.right;
      const footerY = page.height - page.margins.bottom + 8;

      this.doc.save();
      this.doc.x = this.left;
      this.doc.y = footerY;

      this.doc
        .strokeColor(COLOR.border)
        .lineWidth(0.5)
        .moveTo(this.left, footerY)
        .lineTo(right, footerY)
        .stroke();

      this.doc.font('Helvetica-Oblique').fontSize(7).fillColor(COLOR.muted);
      this.doc.text(tagline, this.left, footerY + 6, {
        width: this.contentWidth * 0.58,
        height: 9,
        lineBreak: false,
      });
      this.doc.text(`Impreso: ${impreso}`, this.left, footerY + 16, {
        width: this.contentWidth * 0.58,
        height: 9,
        lineBreak: false,
      });
      this.doc.text(`Página ${i + 1} de ${totalPages}`, this.left, footerY + 6, {
        width: this.contentWidth,
        height: 9,
        align: 'right',
        lineBreak: false,
      });
      this.doc.restore();
    }

    this.doc.switchToPage(lastPage);
    this.syncY();
  }

  newPage(): void {
    this.doc.addPage();
    this.contentPageIndex += 1;
    this.y = this.doc.page.margins.top;
    this.resetCursor();
    if (this.contentPageIndex > 0) {
      this.drawContinuationHeader();
    }
  }

  private resetCursor(): void {
    this.doc.x = this.left;
    this.doc.y = this.y;
  }

  private syncY(): void {
    this.y = this.doc.y;
  }

  private ensureSpace(needed: number): void {
    this.syncY();
    if (this.y + needed <= this.bottomLimit) return;
    this.newPage();
  }

  /** Evita dejar solo el título de sección al final de una página. */
  private ensureSpaceForSection(minFirstBlockHeight: number): void {
    this.syncY();
    if (
      !needsPageBreakBeforeBlock(
        this.y,
        this.bottomLimit,
        PDF_SECTION_TITLE_BLOCK_HEIGHT,
        minFirstBlockHeight,
      )
    ) {
      return;
    }
    this.newPage();
  }

  /** Evita dejar solo un subheading (p. ej. Medicamentos prescritos) sin su primer bloque. */
  private ensureSpaceForSubsection(minFirstBlockHeight: number): void {
    this.syncY();
    if (
      !needsPageBreakBeforeBlock(this.y, this.bottomLimit, PDF_SUBHEADING_HEIGHT, minFirstBlockHeight)
    ) {
      return;
    }
    this.newPage();
  }

  /** Altura total del primer bloque SOAP (card + gap) para el orphan guard del título de sección. */
  private measureSoapCardHeight(text: string): number {
    const body = displayPdfSection(text);
    this.doc.font('Helvetica').fontSize(8.5);
    const bodyH = this.doc.heightOfString(body, { width: this.contentWidth - 28, lineGap: 2 });
    return bodyH + 24 + PDF_SOAP_CARD_TRAILING_GAP;
  }

  private measureHighlightBoxHeight(text: string): number {
    const content = displayPdfSection(text);
    this.doc.font('Helvetica').fontSize(9);
    const bodyH = this.doc.heightOfString(content, { width: this.contentWidth - 24, lineGap: 2 });
    return bodyH + 18;
  }

  private measureMedicamentoCardHeight(med: MedicamentoPdf): number {
    const pad = 10;
    const labelW = 68;
    const valueW = this.contentWidth - pad * 2 - labelW - 4;
    const rows: [string, string][] = [
      ['Dosis', med.dosis],
      ['Vía', med.via],
      ['Frecuencia', med.frecuencia],
      ['Duración', med.duracion],
    ];
    if (med.indicacion !== ND) rows.push(['Indicación', med.indicacion]);

    this.doc.font('Helvetica-Bold').fontSize(9);
    const titleH = this.doc.heightOfString(med.nombre, { width: this.contentWidth - pad * 2 });
    this.doc.font('Helvetica').fontSize(8);
    let bodyH = titleH + 8;
    rows.forEach(([, val]) => {
      bodyH += Math.max(14, this.doc.heightOfString(displayPdfField(val), { width: valueW }) + 4);
    });
    return bodyH + pad * 2;
  }

  private measureSignatureBlockHeight(compact = false): number {
    return compact ? PDF_SIGNATURE_BLOCK_COMPACT_HEIGHT : PDF_SIGNATURE_BLOCK_FULL_HEIGHT;
  }

  /** Espacio vertical total de la sección firma (padding + título + bloque). */
  private measureSignatureSectionHeight(compact = false): number {
    return (
      PDF_SIGNATURE_SECTION_PADDING * 2 +
      PDF_SECTION_TITLE_BLOCK_HEIGHT +
      this.measureSignatureBlockHeight(compact)
    );
  }

  /** Firma compacta sin título de sección (el bloque ya incluye encabezado). */
  private measureInlineSignatureHeight(compact = true): number {
    return PDF_SIGNATURE_SECTION_PADDING + this.measureSignatureBlockHeight(compact) + 4;
  }

  /**
   * Coloca la firma al final de la página actual en modo compacto si cabe;
   * evita saltar a una página casi vacía solo para la firma.
   */
  private drawSignatureSection(m: ModeloPdf): void {
    this.syncY();
    const fitsOnPage = (compact: boolean) =>
      this.y + this.measureSignatureSectionHeight(compact) <= this.bottomLimit;
    const fitsInline = () => this.y + this.measureInlineSignatureHeight(true) <= this.bottomLimit;

    let compact = false;
    let inline = false;
    let signatureOnlyPage = false;

    if (fitsOnPage(false)) {
      compact = false;
    } else if (fitsOnPage(true)) {
      compact = true;
    } else if (fitsInline()) {
      compact = true;
      inline = true;
    } else {
      this.newPage();
      signatureOnlyPage = true;
      compact = false;
    }

    if (signatureOnlyPage) {
      this.drawOfficialEmissionBlock();
    }

    if (inline) {
      this.y += PDF_SIGNATURE_SECTION_PADDING;
      this.drawProfessionalSignature(m.vetNombre, m.matricula, m.entidad.nombre, m.fechaImpresion, {
        compact: true,
      });
      this.y += 4;
    } else {
      this.y += PDF_SIGNATURE_SECTION_PADDING;
      this.drawBlockTitle('Firma del profesional');
      this.drawProfessionalSignature(m.vetNombre, m.matricula, m.entidad.nombre, m.fechaImpresion, {
        compact,
      });
      this.y += PDF_SIGNATURE_SECTION_PADDING;
    }
    this.resetCursor();
  }

  /** Bloque de validez oficial cuando la firma cae sola en una página nueva (evita p3 vacía). */
  private drawOfficialEmissionBlock(): void {
    const pad = 12;
    const lines = [
      'Documento generado por Vethos AI a partir del registro clínico aprobado.',
      'Este documento tiene validez como soporte de historia clínica veterinaria.',
      'La información refleja el estado documentado al momento de la consulta.',
    ];
    this.doc.font('Helvetica').fontSize(8.5);
    const bodyH = lines.reduce(
      (h, line) => h + this.doc.heightOfString(line, { width: this.contentWidth - pad * 2, lineGap: 1 }) + 4,
      0,
    );
    const blockH = bodyH + pad * 2 + 16;
    this.ensureSpace(blockH + 8);

    this.doc.save();
    this.doc.roundedRect(this.left, this.y, this.contentWidth, blockH, 5).fill(COLOR.brandSoft);
    this.doc
      .roundedRect(this.left, this.y, this.contentWidth, blockH, 5)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();
    this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(8);
    this.doc.text('EMISIÓN OFICIAL DEL DOCUMENTO', this.left + pad, this.y + pad);
    this.doc.fillColor(COLOR.text).font('Helvetica').fontSize(8.5);
    let lineY = this.y + pad + 16;
    lines.forEach((line) => {
      this.doc.text(line, this.left + pad, lineY, {
        width: this.contentWidth - pad * 2,
        lineGap: 1,
      });
      lineY += this.doc.heightOfString(line, { width: this.contentWidth - pad * 2, lineGap: 1 }) + 4;
    });
    this.doc.restore();
    this.y += blockH + 8;
    this.resetCursor();
  }

  private drawHeaderBand(entidad: ModeloPdf['entidad']): void {
    const bandH = 62;
    this.doc.save();
    this.doc.rect(0, 0, this.pageWidth, bandH).fill(COLOR.brand);
    this.doc.rect(0, bandH - 3, this.pageWidth, 3).fill(COLOR.brandDark);

    this.doc.fillColor(COLOR.white).font('Helvetica-Bold').fontSize(22);
    this.doc.text('Vethos AI', this.left, 12);
    this.doc.font('Helvetica').fontSize(8.5);
    this.doc.text('Historia clínica veterinaria', this.left, 36);

    const badgeW = 88;
    const badgeX = this.left + 130;
    this.doc.roundedRect(badgeX, 14, badgeW, 14, 3).fill(COLOR.brandDark);
    this.doc.fillColor(COLOR.white).font('Helvetica-Bold').fontSize(6.5);
    this.doc.text('DOCUMENTO OFICIAL', badgeX, 18, { width: badgeW, align: 'center' });

    this.doc.fillColor(COLOR.white).font('Helvetica-Bold').fontSize(11);
    this.doc.text(entidad.nombre, this.left, 12, {
      width: this.contentWidth,
      align: 'right',
    });
    const sedeLine =
      entidad.sede !== ND || entidad.ciudad !== ND
        ? [entidad.sede !== ND ? entidad.sede : null, entidad.ciudad !== ND ? entidad.ciudad : null]
            .filter(Boolean)
            .join(' · ')
        : '';
    if (sedeLine) {
      this.doc.font('Helvetica').fontSize(8);
      this.doc.text(sedeLine, this.left, 28, { width: this.contentWidth, align: 'right' });
    }
    if (entidad.telefono !== ND) {
      this.doc.font('Helvetica').fontSize(8);
      this.doc.text(`Tel: ${entidad.telefono}`, this.left, 42, { width: this.contentWidth, align: 'right' });
    }
    this.doc.restore();
    this.y = bandH + 14;
    this.resetCursor();
  }

  private drawContinuationHeader(): void {
    const h = 22;
    this.doc.save();
    this.doc.rect(this.left, this.y, this.contentWidth, h).fill(COLOR.brandSoft);
    this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(8);
    this.doc.text('Vethos AI — continuación', this.left + 10, this.y + 7);
    this.doc.restore();
    this.y += h + 8;
    this.resetCursor();
  }

  private drawHcBanner(numeroHC: string, fecha: string, prioridad: string, extra?: string): void {
    this.ensureSpace(52);
    const h = 44;
    this.doc.save();
    this.doc.roundedRect(this.left, this.y, this.contentWidth, h, 6).fill(COLOR.brandLight);
    this.doc.roundedRect(this.left, this.y, 5, h, 2).fill(COLOR.brand);
    this.doc
      .roundedRect(this.left, this.y, this.contentWidth, h, 6)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(7.5);
    this.doc.text('HISTORIA CLÍNICA N°', this.left + 14, this.y + 7);
    this.doc.font('Helvetica-Bold').fontSize(18);
    this.doc.text(numeroHC, this.left + 14, this.y + 17);

    this.doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.brand);
    this.doc.text('DOCUMENTO OFICIAL', this.left + 14, this.y + 34);

    const metaX = this.left + this.contentWidth * 0.42;
    const metaW = this.contentWidth * 0.58 - 14;
    this.doc.font('Helvetica').fontSize(8).fillColor(COLOR.muted);
    this.doc.text(`Fecha de consulta: ${fecha}`, metaX, this.y + 8, { width: metaW, align: 'right' });
    this.doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.brandDark);
    this.doc.text(`Prioridad: ${prioridad}`, metaX, this.y + 20, { width: metaW, align: 'right' });
    if (extra) {
      this.doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted);
      this.doc.text(extra, metaX, this.y + 32, { width: metaW, align: 'right' });
    }
    this.doc.restore();
    this.y += h + 12;
    this.resetCursor();
  }

  private drawClinicalSummary(m: ModeloPdf): void {
    const tiles: { label: string; value: string }[] = [
      { label: 'Motivo', value: m.motivo },
      { label: 'Prioridad', value: m.prioridad },
      { label: 'Diagnóstico', value: m.diagnostico },
      { label: 'Plan', value: m.planTerapeutico },
    ];
    const gap = 10;
    const tileW = (this.contentWidth - gap) / 2;
    const padX = 10;
    const padTop = 8;
    const labelH = 12;

    this.doc.font('Helvetica').fontSize(8.5);
    const tileHeights = tiles.map((tile) => {
      const content = displayPdfSection(tile.value);
      const bodyH = this.doc.heightOfString(content, { width: tileW - padX * 2, lineGap: 1 });
      return Math.max(36, padTop + labelH + bodyH + 8);
    });

    const row0H = Math.max(tileHeights[0], tileHeights[1]);
    const row1H = Math.max(tileHeights[2], tileHeights[3]);
    const gridH = row0H + gap + row1H;
    this.ensureSpace(gridH + 24);

    this.drawBlockTitle('Resumen clínico');

    tiles.forEach((tile, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = this.left + col * (tileW + gap);
      const y = this.y + (row === 0 ? 0 : row0H + gap);
      const tileH = row === 0 ? row0H : row1H;
      const content = displayPdfSection(tile.value);

      this.doc.save();
      this.doc.roundedRect(x, y, tileW, tileH, 5).fill(COLOR.white);
      this.doc.roundedRect(x, y, tileW, tileH, 5).strokeColor(COLOR.borderLight).lineWidth(0.5).stroke();
      this.doc.fillColor(COLOR.muted).font('Helvetica-Bold').fontSize(7);
      this.doc.text(tile.label.toUpperCase(), x + padX, y + padTop, { width: tileW - padX * 2 });
      this.doc.fillColor(tile.value === ND ? COLOR.muted : COLOR.text).font('Helvetica').fontSize(8.5);
      this.doc.text(content, x + padX, y + padTop + labelH, {
        width: tileW - padX * 2,
        lineGap: 1,
      });
      this.doc.restore();
    });
    this.y += gridH + 8;
    this.resetCursor();
  }

  private drawSection(
    title: string,
    render: () => void,
    orphanGuard?: { minFirstBlockHeight: number },
  ): void {
    if (orphanGuard) {
      this.ensureSpaceForSection(orphanGuard.minFirstBlockHeight);
    } else {
      this.ensureSpace(28);
    }
    this.y += 4;
    this.drawBlockTitle(title);
    render();
    this.y += 6;
    this.resetCursor();
  }

  private drawBlockTitle(title: string): void {
    this.ensureSpace(20);
    this.doc.save();
    this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(10);
    this.doc.text(title, this.left, this.y);
    this.doc
      .strokeColor(COLOR.brand)
      .lineWidth(1.2)
      .moveTo(this.left, this.y + 13)
      .lineTo(this.left + 42, this.y + 13)
      .stroke();
    this.doc.restore();
    this.y += 18;
    this.resetCursor();
  }

  private drawSubheading(text: string): void {
    this.ensureSpace(14);
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.text);
    this.doc.text(text, this.left, this.y);
    this.y += 13;
    this.resetCursor();
  }

  private measureCardHeight(rows: [string, string][], width: number): number {
    const labelW = 86;
    const valueW = width - labelW - 20;
    let h = 32;
    this.doc.font('Helvetica').fontSize(8);
    rows.forEach(([, value]) => {
      const vh = this.doc.heightOfString(displayPdfField(value), { width: valueW });
      h += Math.max(16, vh + 6);
    });
    return h + 6;
  }

  private drawTwoColumnInfoCards(
    leftTitle: string,
    leftRows: [string, string][],
    rightTitle: string,
    rightRows: [string, string][],
  ): void {
    const gap = 14;
    const colW = (this.contentWidth - gap) / 2;
    const cardH = Math.max(this.measureCardHeight(leftRows, colW), this.measureCardHeight(rightRows, colW));
    this.ensureSpace(cardH + 8);
    const startY = this.y;
    this.drawInfoCard(this.left, startY, colW, cardH, leftTitle, leftRows);
    this.drawInfoCard(this.left + colW + gap, startY, colW, cardH, rightTitle, rightRows);
    this.y = startY + cardH + 8;
    this.resetCursor();
  }

  private drawInfoCard(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    rows: [string, string][],
  ): void {
    const labelW = 86;
    const valueW = width - labelW - 20;
    this.doc.save();
    this.doc.roundedRect(x, y, width, height, 5).fill(COLOR.white);
    this.doc.roundedRect(x, y, width, height, 5).strokeColor(COLOR.border).lineWidth(0.6).stroke();
    this.doc.rect(x, y, width, 24).fill(COLOR.brandSoft);
    this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(8.5);
    this.doc.text(title, x + 12, y + 8);
    let rowY = y + 32;
    rows.forEach(([label, value]) => {
      this.doc.fillColor(COLOR.muted).font('Helvetica-Bold').fontSize(7.5);
      this.doc.text(label, x + 12, rowY, { width: labelW });
      this.doc.fillColor(value === ND ? COLOR.muted : COLOR.text).font('Helvetica').fontSize(8);
      const text = displayPdfField(value);
      const vh = this.doc.heightOfString(text, { width: valueW });
      this.doc.text(text, x + labelW + 4, rowY, { width: valueW });
      rowY += Math.max(16, vh + 6);
    });
    this.doc.restore();
  }

  private drawVitalesCards(vitales: VitalPdf[]): void {
    const cols = 3;
    const gap = 6;
    const cellW = (this.contentWidth - gap * (cols - 1)) / cols;
    const cellH = 28;
    const rows = Math.ceil(vitales.length / cols);
    this.ensureSpace(rows * (cellH + gap));

    vitales.forEach((v, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = this.left + col * (cellW + gap);
      const y = this.y + row * (cellH + gap);
      this.doc.save();
      this.doc.roundedRect(x, y, cellW, cellH, 4).fill('#F9FAFB');
      this.doc.roundedRect(x, y, cellW, cellH, 4).strokeColor(COLOR.border).lineWidth(0.4).stroke();
      this.doc.fillColor(COLOR.muted).font('Helvetica-Bold').fontSize(7);
      this.doc.text(v.label, x + 6, y + 5, { width: cellW - 12 });
      this.doc.fillColor(COLOR.text).font('Helvetica').fontSize(8);
      this.doc.text(displayPdfField(v.value), x + 6, y + 14, { width: cellW - 12 });
      this.doc.restore();
    });
    this.y += rows * (cellH + gap);
    this.resetCursor();
  }

  private drawMedicamentosCards(meds: MedicamentoPdf[]): void {
    const pad = 10;
    const labelW = 68;
    const valueW = this.contentWidth - pad * 2 - labelW - 4;

    meds.forEach((m, idx) => {
      const rows: [string, string][] = [
        ['Dosis', m.dosis],
        ['Vía', m.via],
        ['Frecuencia', m.frecuencia],
        ['Duración', m.duracion],
      ];
      if (m.indicacion !== ND) rows.push(['Indicación', m.indicacion]);

      this.doc.font('Helvetica-Bold').fontSize(9);
      const titleH = this.doc.heightOfString(m.nombre, { width: this.contentWidth - pad * 2 });
      this.doc.font('Helvetica').fontSize(8);
      let bodyH = titleH + 8;
      rows.forEach(([, val]) => {
        bodyH += Math.max(14, this.doc.heightOfString(displayPdfField(val), { width: valueW }) + 4);
      });
      const cardH = bodyH + pad * 2;
      this.ensureSpace(cardH + 8);

      this.doc.save();
      this.doc.roundedRect(this.left, this.y, this.contentWidth, cardH, 5).fill(COLOR.white);
      this.doc
        .roundedRect(this.left, this.y, this.contentWidth, cardH, 5)
        .strokeColor(COLOR.borderLight)
        .lineWidth(0.5)
        .stroke();
      this.doc.rect(this.left, this.y, 3, cardH).fill(COLOR.brand);

      this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(9);
      this.doc.text(`${idx + 1}. ${m.nombre}`, this.left + pad + 4, this.y + pad, {
        width: this.contentWidth - pad * 2 - 4,
      });

      let rowY = this.y + pad + titleH + 6;
      rows.forEach(([label, val]) => {
        this.doc.fillColor(COLOR.muted).font('Helvetica-Bold').fontSize(7.5);
        this.doc.text(label, this.left + pad + 4, rowY, { width: labelW });
        this.doc.fillColor(val === ND ? COLOR.muted : COLOR.text).font('Helvetica').fontSize(8);
        const text = displayPdfField(val);
        const vh = this.doc.heightOfString(text, { width: valueW });
        this.doc.text(text, this.left + pad + 4 + labelW, rowY, { width: valueW });
        rowY += Math.max(14, vh + 4);
      });
      this.doc.restore();
      this.y += cardH + 8;
      this.syncY();
    });
    this.resetCursor();
  }

  private drawSoapCards(soap: ModeloPdf['soap']): void {
    const cards: { letter: string; title: string; text: string }[] = [
      { letter: 'S', title: 'Subjetivo', text: soap.subjetivo },
      { letter: 'O', title: 'Objetivo', text: soap.objetivo },
      { letter: 'A', title: 'Análisis', text: soap.analisis },
      { letter: 'P', title: 'Plan', text: soap.plan },
    ];

    cards.forEach((card) => {
      const body = displayPdfSection(card.text);
      this.doc.font('Helvetica').fontSize(8.5);
      const bodyH = this.doc.heightOfString(body, { width: this.contentWidth - 28, lineGap: 2 });
      const cardH = bodyH + 24;
      this.ensureSpace(cardH + 8);

      this.doc.save();
      this.doc.roundedRect(this.left, this.y, this.contentWidth, cardH, 4).fill('#FAFBFC');
      this.doc
        .roundedRect(this.left, this.y, this.contentWidth, cardH, 4)
        .strokeColor(COLOR.borderLight)
        .lineWidth(0.5)
        .stroke();
      this.doc.rect(this.left, this.y, 2.5, cardH).fill(COLOR.soapAccent);

      this.doc.fillColor(COLOR.brandDark).font('Helvetica-Bold').fontSize(8.5);
      this.doc.text(`${card.letter} · ${card.title}`, this.left + 12, this.y + 8);
      this.doc.fillColor(card.text === ND ? COLOR.muted : COLOR.text).font('Helvetica').fontSize(8.5);
      this.doc.text(body, this.left + 12, this.y + 22, {
        width: this.contentWidth - 28,
        lineGap: 2,
      });
      this.doc.restore();
      this.y += cardH + 8;
      this.syncY();
    });
    this.resetCursor();
  }

  private drawHighlightBox(text: string, titleColor: string, bg: string): void {
    const content = displayPdfSection(text);
    this.doc.font('Helvetica').fontSize(9);
    const bodyH = this.doc.heightOfString(content, { width: this.contentWidth - 24, lineGap: 2 });
    const boxH = bodyH + 18;
    this.ensureSpace(boxH + 6);

    this.doc.save();
    this.doc.roundedRect(this.left, this.y, this.contentWidth, boxH, 5).fill(bg);
    this.doc.roundedRect(this.left, this.y, this.contentWidth, boxH, 5).strokeColor(titleColor).lineWidth(0.6).stroke();
    this.doc.fillColor(text === ND ? COLOR.muted : titleColor).font('Helvetica').fontSize(9);
    this.doc.text(content, this.left + 12, this.y + 9, {
      width: this.contentWidth - 24,
      lineGap: 2,
    });
    this.doc.restore();
    this.y += boxH + 6;
    this.syncY();
  }

  private drawParagraph(text: string, fontSize = 9): void {
    const display = displayPdfSection(text);
    const isEmpty = text === ND;
    this.doc.font('Helvetica').fontSize(fontSize).fillColor(isEmpty ? COLOR.muted : COLOR.text);
    this.ensureSpace(fontSize + 8);
    this.doc.text(display, this.left, this.y, {
      width: this.contentWidth,
      align: 'justify',
      lineGap: 2,
    });
    this.syncY();
    this.y += 4;
    this.resetCursor();
  }

  private drawProfessionalSignature(
    vetNombre: string,
    matricula: string,
    entidad: string,
    fechaEmision: string,
    opts?: { compact?: boolean },
  ): void {
    const compact = opts?.compact ?? false;
    const blockH = this.measureSignatureBlockHeight(compact);
    this.ensureSpace(blockH + 4);
    this.doc.save();
    this.doc.roundedRect(this.left, this.y, this.contentWidth, blockH, 5).fill('#FAFBFC');
    this.doc
      .roundedRect(this.left, this.y, this.contentWidth, blockH, 5)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    const padX = 14;
    const labelSize = compact ? 7 : 7.5;
    const nameSize = compact ? 9.5 : 10;
    const metaSize = compact ? 8 : 8.5;
    const labelY = compact ? 8 : 10;
    const lineY = compact ? 28 : 38;
    const nameY = compact ? 32 : 44;
    const metaStartY = compact ? 44 : 58;
    const metaGap = compact ? 10 : 12;

    this.doc.fillColor(COLOR.muted).font('Helvetica-Bold').fontSize(labelSize);
    this.doc.text('FIRMA DEL PROFESIONAL', this.left + padX, this.y + labelY);

    this.doc
      .strokeColor(COLOR.text)
      .lineWidth(0.6)
      .moveTo(this.left + padX, this.y + lineY)
      .lineTo(this.left + (compact ? 180 : 220), this.y + lineY)
      .stroke();

    this.doc.fillColor(COLOR.text).font('Helvetica-Bold').fontSize(nameSize);
    this.doc.text(`Dr(a). ${vetNombre}`, this.left + padX, this.y + nameY);
    this.doc.font('Helvetica').fontSize(metaSize).fillColor(COLOR.muted);
    this.doc.text(`Matrícula: ${displayPdfField(matricula)}`, this.left + padX, this.y + metaStartY);
    this.doc.text(`Entidad: ${displayPdfField(entidad)}`, this.left + padX, this.y + metaStartY + metaGap);
    this.doc.text(
      `Fecha de emisión: ${displayPdfField(fechaEmision)}`,
      this.left + padX,
      this.y + metaStartY + metaGap * 2,
    );

    this.doc.restore();
    this.y += blockH + 4;
    this.resetCursor();
  }
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('toDate' in obj && typeof obj.toDate === 'function') {
      try {
        const d = (obj.toDate as () => Date).call(value);
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {
        // Timestamp mal formado: intentar seconds/_seconds abajo.
      }
    }
    const seconds = obj._seconds ?? obj.seconds;
    if (typeof seconds === 'number') {
      const nanos = (obj._nanoseconds ?? obj.nanoseconds ?? 0) as number;
      const d = new Date(seconds * 1000 + nanos / 1e6);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function formatFechaHora(value: unknown): string {
  const date = toDate(value);
  if (!date) return ND;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: FECHA_COLOMBIA,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
}

function calcEdad(fechaNacimiento: unknown, edadRaw: unknown): string {
  if (typeof edadRaw === 'string' && edadRaw.trim()) return edadRaw.trim();
  if (typeof fechaNacimiento !== 'string' || !fechaNacimiento.trim()) return ND;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  const nacimiento = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return ND;
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const yaCumplio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  if (!yaCumplio) anios -= 1;
  return `${Math.max(anios, 0)} años`;
}

/** Cuenta páginas en un buffer PDF (utilidad de tests). */
export function countPdfPages(buffer: Buffer): number {
  const src = buffer.toString('latin1');
  const matches = src.match(/\/Type\s*\/Page(?!s)/g);
  return matches?.length ?? 0;
}

function rutaConsultaPaciente(pacienteId: string | undefined, consultaId: string): string {
  return pacienteId ? `/pacientes/${pacienteId}/consultas/${consultaId}` : '/pacientes';
}
