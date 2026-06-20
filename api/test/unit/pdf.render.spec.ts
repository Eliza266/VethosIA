import {
  PdfService,
  countPdfPages,
  displayPdfField,
  displayPdfSection,
  displayPdfValue,
  needsPageBreakBeforeBlock,
  PDF_SECTION_TITLE_BLOCK_HEIGHT,
  PDF_SUBHEADING_HEIGHT,
  PDF_SIGNATURE_BLOCK_FULL_HEIGHT,
  PDF_SIGNATURE_BLOCK_COMPACT_HEIGHT,
  PDF_SIGNATURE_SECTION_PADDING,
  PDF_SOAP_CARD_TRAILING_GAP,
  ModeloPdf,
} from '../../src/modules/consultas/pdf.service';
import hc000002Fixture from '../fixtures/hc000002-firulais.json';

type PdfServiceTest = PdfService & {
  construirModelo: PdfService['construirModelo'];
};

const svc = new PdfService({} as never, {} as never, {} as never, {} as never, {} as never) as PdfServiceTest;

function renderPdf(modelo: ModeloPdf, opts?: { compress?: boolean }): Promise<Buffer> {
  return (
    svc as unknown as { render(m: ModeloPdf, o?: { compress?: boolean }): Promise<Buffer> }
  ).render(modelo, opts);
}

function modeloHc000002(): ModeloPdf {
  return svc.construirModelo(
    {
      numeroHC: 'HC000002',
      motivo: 'Control de rutina',
      prioridad: 'rutina',
      fechaHora: new Date('2024-08-01T15:00:00.000Z'),
      signosVitales: { peso: 10, temperatura: 38.2 },
      soap: {
        subjetivo: 'Paciente activo, sin síntomas.',
        objetivo: 'Examen general dentro de parámetros normales.',
        analisis: 'Paciente sano.',
        plan: 'Continuar manejo preventivo.',
      },
    },
    {
      codigo: 'PAC-002',
      nombre: 'Luna',
      especie: 'Felino',
      propietario: { nombre: 'Pedro' },
    },
    { nombre: 'Dr. Test', matriculaProfesional: 'MVZ-99' },
    { nombre: 'Clínica Demo', ciudad: 'Bogotá' },
  );
}

function modeloConMedicamentosLargos(): ModeloPdf {
  const base = modeloHc000002();
  return {
    ...base,
    medicamentos: [
      {
        nombre: 'Metronidazol compuesto suspensión oral veterinaria',
        dosis: '250 mg por cada 12 horas vía oral con alimento',
        via: 'VO',
        frecuencia: 'c/12h durante tratamiento prolongado',
        duracion: '14 días calendario con reevaluación',
        indicacion: 'Control de flora intestinal',
      },
      {
        nombre: 'Suero fisiológico',
        dosis: '100 ml',
        via: 'SC',
        frecuencia: 'c/24h',
        duracion: '3 días',
        indicacion: 'Hidratación',
      },
    ],
  };
}

function modeloDatosFaltantes(): ModeloPdf {
  return svc.construirModelo({}, {}, {}, {});
}

function modeloHc000002Real(): ModeloPdf {
  const { consulta, paciente, vet, entidad } = hc000002Fixture;
  return svc.construirModelo(
    { ...consulta, fechaHora: new Date(consulta.fechaHora) },
    paciente,
    vet,
    entidad,
  );
}

function modeloConContenidoLargoAntesDeSoap(): ModeloPdf {
  const bloque = 'Anamnesis extensa con detalle clínico repetido para ocupar espacio vertical. ';
  const base = modeloHc000002();
  return {
    ...base,
    anamnesis: bloque.repeat(40),
    examenFisico: {
      ...base.examenFisico,
      hallazgos: bloque.repeat(20),
    },
    revisionSistemas: bloque.repeat(15),
  };
}

/** Mismo fixture que scripts/generate-sample-pdf.mjs (sample bonito). */
function modeloSampleBonito(): ModeloPdf {
  return svc.construirModelo(
    {
      numeroHC: 'HC-SAMPLE-001',
      motivo: 'Vómito y anorexia de 48 horas',
      prioridad: 'urgente',
      fechaHora: new Date('2024-11-20T10:00:00.000Z'),
      signosVitales: {
        peso: 8.5,
        talla: 32,
        temperatura: 39.2,
        frecuenciaCardiaca: 110,
        frecuenciaRespiratoria: 28,
        condicionCorporal: 4,
        mucosas: 'Pálidas, TRC 3 s',
        deshidratacion: 'Leve (5%)',
      },
      soap: {
        subjetivo:
          'Propietario refiere vómito en 4 ocasiones en las últimas 48 h, anorexia completa y letargia. No diarrea. Vacunas al día.',
        objetivo:
          'Paciente alerta pero decaído. Mucosas pálidas. Abdomen tenso en cuadrante craneal. Auscultación cardiopulmonar sin soplos.',
        analisis: 'Gastroenteritis aguda vs. cuerpo extraño. Deshidratación leve.',
        plan: 'Fluidoterapia SC, dieta blanda, omeprazol 1 mg/kg c/24h por 5 días. Control en 48 h.',
        medicamentosSugeridos: [
          {
            nombre: 'Omeprazol',
            dosis: '8.5 mg',
            via: 'VO',
            frecuencia: 'c/24h',
            duracion: '5 días',
            indicacion: 'Protección gástrica',
          },
        ],
      },
      transcripcion: 'El perro vomitó cuatro veces ayer y hoy no quiere comer nada.',
    },
    {
      codigo: 'PAC-000256',
      nombre: 'Max',
      especie: 'Canino',
      raza: 'Golden Retriever',
      sexo: 'macho',
      estadoReproductivo: 'castrado',
      fechaNacimiento: '2019-05-10',
      color: 'Dorado',
      chip: '985112000000042',
      propietario: {
        nombre: 'María González',
        telefono: '+57 300 555 1234',
        email: 'maria@email.com',
        whatsapp: '+57 300 555 1234',
      },
    },
    {
      nombre: 'Dra. Carolina Ruiz',
      veterinaria: 'Vethosia Clínica Veterinaria',
      sede: 'Sede Chapinero',
      ciudad: 'Bogotá D.C.',
      telefono: '+57 601 555 0100',
      matriculaProfesional: 'MVZ-45678',
    },
    { nombre: 'Vethosia Clínica Veterinaria', ciudad: 'Bogotá D.C.' },
  );
}

/** Marcadores hex WinAnsi (pdfkit TJ) para acentos en secciones del PDF. */
const ACCENT_HEX_MARKERS = [
  '636ced6e696361', // clínica
  '66ed7369636f', // físico
  'f3737469636f', // óstico (diagnóstico)
  '7465726170e9757469636f', // terapéutico
  '656d697369f36e', // emisión
] as const;

/** Concatena payloads hex de operadores TJ para buscar texto partido entre arrays. */
function pdfHexPayload(buffer: Buffer): string {
  const latin = buffer.toString('latin1');
  const chunks: string[] = [];
  for (const m of latin.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    chunks.push(m[1]);
  }
  return chunks.join('').toLowerCase();
}

/** pdfkit emite texto en operadores TJ como secuencias hex WinAnsi (sin compresión en tests). */
function pdfContainsPdfKitText(buffer: Buffer, text: string): boolean {
  const payload = pdfHexPayload(buffer);
  const hex = Buffer.from(text, 'latin1').toString('hex').toLowerCase();
  return payload.includes(hex);
}

function pdfContainsAccentMarkers(buffer: Buffer): boolean {
  const payload = pdfHexPayload(buffer);
  return ACCENT_HEX_MARKERS.every((hex) => payload.includes(hex));
}

/** Payloads hex por stream de contenido (requiere PDF sin compresión FlateDecode). */
function pdfStreamHexPayloads(buffer: Buffer): string[] {
  const latin = buffer.toString('latin1');
  return [...latin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((match) => {
    const chunks: string[] = [];
    for (const m of match[1].matchAll(/<([0-9A-Fa-f]+)>/g)) {
      chunks.push(m[1]);
    }
    return chunks.join('').toLowerCase();
  });
}

/** Ninguna página debe mostrar el título SOAP sin el bloque S · Subjetivo. */
function assertSoapHeadingNotOrphaned(buffer: Buffer): void {
  const streams = pdfStreamHexPayloads(buffer);
  expect(streams.length).toBeGreaterThan(0);
  const soapHex = Buffer.from('SOAP', 'latin1').toString('hex').toLowerCase();
  const subjHex = Buffer.from('Subjetivo', 'latin1').toString('hex').toLowerCase();
  const notaHex = Buffer.from('Nota cl', 'latin1').toString('hex').toLowerCase();
  for (const payload of streams) {
    const hasHeading = payload.includes(notaHex) && payload.includes(soapHex);
    const hasSubjetivo = payload.includes(subjHex);
    if (hasHeading && !hasSubjetivo) {
      throw new Error('Título "Nota clínica SOAP" huérfano sin bloque Subjetivo en la misma página');
    }
  }
}

describe('PdfService render (pdfkit real)', () => {
  it('displayPdfField usa No registrado en celdas vacías', () => {
    expect(displayPdfField('No documentado')).toBe('No registrado');
    expect(displayPdfField('Dorado')).toBe('Dorado');
  });

  it('displayPdfValue reemplaza No documentado por mensaje de empty state', () => {
    expect(displayPdfValue('No documentado')).toBe('Sin información documentada en esta consulta');
    expect(displayPdfValue('Traqueobronquitis')).toBe('Traqueobronquitis');
  });

  it('displayPdfSection alias de displayPdfValue para secciones vacías', () => {
    expect(displayPdfSection('No documentado')).toBe('Sin información documentada en esta consulta');
  });

  it('needsPageBreakBeforeBlock detecta heading huérfano (título + primer bloque SOAP)', () => {
    const bottomLimit = 772;
    const firstBlockH = 80 + PDF_SOAP_CARD_TRAILING_GAP;
    const yOrphan = bottomLimit - PDF_SECTION_TITLE_BLOCK_HEIGHT - firstBlockH + 1;
    expect(
      needsPageBreakBeforeBlock(yOrphan, bottomLimit, PDF_SECTION_TITLE_BLOCK_HEIGHT, firstBlockH),
    ).toBe(true);
    const yOk = bottomLimit - PDF_SECTION_TITLE_BLOCK_HEIGHT - firstBlockH;
    expect(
      needsPageBreakBeforeBlock(yOk, bottomLimit, PDF_SECTION_TITLE_BLOCK_HEIGHT, firstBlockH),
    ).toBe(false);
  });

  it('needsPageBreakBeforeBlock protege subheading Medicamentos prescritos', () => {
    const bottomLimit = 772;
    const firstMedH = 120;
    const yOrphan = bottomLimit - PDF_SUBHEADING_HEIGHT - firstMedH + 1;
    expect(needsPageBreakBeforeBlock(yOrphan, bottomLimit, PDF_SUBHEADING_HEIGHT, firstMedH)).toBe(
      true,
    );
  });

  it('contenido largo antes de SOAP no deja título huérfano (render multipágina)', async () => {
    const basePages = countPdfPages(await renderPdf(modeloHc000002()));
    const buffer = await renderPdf(modeloConContenidoLargoAntesDeSoap(), { compress: false });
    const pages = countPdfPages(buffer);
    expect(pages).toBeGreaterThan(basePages);
    assertSoapHeadingNotOrphaned(buffer);
    expect(pdfContainsPdfKitText(buffer, 'Subjetivo')).toBe(true);
  });

  it('sample bonito mantiene título SOAP con bloque Subjetivo en la misma página', async () => {
    const buffer = await renderPdf(modeloSampleBonito(), { compress: false });
    expect(countPdfPages(buffer)).toBe(2);
    assertSoapHeadingNotOrphaned(buffer);
    expect(pdfContainsPdfKitText(buffer, 'Nota cl')).toBe(true);
    expect(pdfContainsPdfKitText(buffer, 'Subjetivo')).toBe(true);
  });

  it('render incluye acentos UTF-8/WinAnsi en Helvetica', async () => {
    const buffer = await renderPdf(modeloHc000002(), { compress: false });
    expect(pdfContainsAccentMarkers(buffer)).toBe(true);
  });

  it('HC000002 no genera páginas fantasma (contenido ~2 páginas → ≤3 páginas)', async () => {
    const buffer = await renderPdf(modeloHc000002());
    const pages = countPdfPages(buffer);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(3);
  });

  it('footer refleja el conteo real de páginas (Kids del árbol PDF = páginas reales)', async () => {
    const buffer = await renderPdf(modeloHc000002());
    const pages = countPdfPages(buffer);
    const catalog = buffer.toString('latin1');
    expect(pages).toBe(2);
    expect(catalog).toMatch(/\/Count\s+2/);
    expect(catalog.match(/\/Type\s*\/Page(?!s)/g)?.length).toBe(2);
  });

  it('datos faltantes no repiten No documentado en el flujo renderizado', async () => {
    const buffer = await renderPdf(modeloDatosFaltantes());
    expect(countPdfPages(buffer)).toBeLessThanOrEqual(4);
    const text = buffer.toString('latin1');
    expect(text).not.toContain('No documentado');
  });

  it('medicamentos con textos largos no disparan páginas vacías extra', async () => {
    const buffer = await renderPdf(modeloConMedicamentosLargos());
    const pages = countPdfPages(buffer);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(5);
  });

  it('HC000002 real (Firulais) empty states limpios y medicamento largo', async () => {
    const modelo = modeloHc000002Real();
    expect(modelo.numeroHC).toBe('HC000002');
    expect(modelo.paciente.nombre).toBe('Firulais Test');
    expect(modelo.examenFisico.vitales[0].value).toBe('No documentado');
    expect(modelo.medicamentos[0].nombre).toContain('Ringer Lactato');

    const buffer = await renderPdf(modelo, { compress: false });
    const pages = countPdfPages(buffer);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(5);
    expect(pdfContainsPdfKitText(buffer, 'Firulais')).toBe(true);
    expect(pdfContainsPdfKitText(buffer, 'No registrado')).toBe(true);
    expect(buffer.toString('latin1')).not.toContain('No documentado');
  });

  it('HC000002 real evita página final casi vacía solo con firma', async () => {
    const buffer = await renderPdf(modeloHc000002Real(), { compress: false });
    const pages = countPdfPages(buffer);
    expect(pages).toBe(2);
    expect(pdfContainsPdfKitText(buffer, 'FIRMA DEL PROFESIONAL')).toBe(true);
  });

  it('firma compacta cabe cuando el espacio restante es limitado', () => {
    const bottomLimit = 772;
    const yLimited =
      bottomLimit -
      PDF_SIGNATURE_SECTION_PADDING * 2 -
      PDF_SECTION_TITLE_BLOCK_HEIGHT -
      PDF_SIGNATURE_BLOCK_COMPACT_HEIGHT;
    const yFullNeedsBreak =
      yLimited +
      PDF_SIGNATURE_SECTION_PADDING * 2 +
      PDF_SECTION_TITLE_BLOCK_HEIGHT +
      PDF_SIGNATURE_BLOCK_FULL_HEIGHT;
    expect(yFullNeedsBreak).toBeGreaterThan(bottomLimit);
    expect(
      yLimited +
        PDF_SIGNATURE_SECTION_PADDING * 2 +
        PDF_SECTION_TITLE_BLOCK_HEIGHT +
        PDF_SIGNATURE_BLOCK_COMPACT_HEIGHT,
    ).toBeLessThanOrEqual(bottomLimit);
  });
});
