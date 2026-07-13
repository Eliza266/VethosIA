import { jsPDF } from 'jspdf';
import type { Consulta, Paciente } from '../../types';

// PDF de la historia clinica extraido del god component DetalleConsulta.
// En produccion (VITE_USE_API_DOCS=true) el PDF oficial lo genera la API server-side
// (pdf.service.ts); este jsPDF es fallback legacy/local y no debe contradecir el branding.

const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  rutina: 'Rutina',
  seguimiento: 'Seguimiento',
  brigada: 'Brigada',
};

// Datos del veterinario para el encabezado/firma. Antes salian de un `perfilVet:any`
// + fallbacks a user. Lo tipamos para no acceder a campos fantasma.
export interface DatosVetPDF {
  veterinaria?: string;
  sede?: string;
  ciudad?: string;
  telefono?: string;
  whatsapp?: string;
  nombre?: string;
  matriculaProfesional?: string;
}

export interface HistoriaClinicaPDFInput {
  consulta: Consulta;
  paciente: Paciente;
  vet: DatosVetPDF;
}

export interface VitalPDF {
  label: string;
  val: string;
}

export interface SoapSectionPDF {
  title: string;
  text: string;
}

// Modelo intermedio 100% serializable -> ideal para snapshot/golden testing.
export interface HistoriaClinicaModel {
  header: {
    vetName: string;
    vetSede: string;
    vetTel: string;
    numeroHC: string;
    fecha: string;
  };
  paciente: {
    nombre: string;
    especie: string;
    raza: string;
    sexo: string;
    color: string;
    chip: string;
    edad: string;
    peso: string;
    propietarioNombre: string;
    propietarioTelefono: string;
  };
  consulta: {
    fechaHora: string;
    prioridad: string;
    motivo: string;
  };
  vitales: VitalPDF[];
  soapSections: SoapSectionPDF[];
  plan: string;
  examenes: { nombre: string; resumen: string }[];
  firma: {
    nombre: string;
    matricula: string | null;
  };
}

const FECHA_COLOMBIA_TIME_ZONE = 'America/Bogota';

const normalizeEsCoDateTime = (value: string): string =>
  value.replace(/\b([ap])\. m\./g, '$1.\u00a0m.');

const formatFechaEsCo = (date: Date): string =>
  new Intl.DateTimeFormat('es-CO', { timeZone: FECHA_COLOMBIA_TIME_ZONE }).format(date);

const formatFechaHoraEsCo = (date: Date): string =>
  normalizeEsCoDateTime(
    new Intl.DateTimeFormat('es-CO', {
      timeZone: FECHA_COLOMBIA_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(date),
  );

const parseFechaNacimiento = (fechaNacimiento: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (!match) {
    const date = new Date(fechaNacimiento);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const calcEdad = (fechaNacimiento?: string): string => {
  if (!fechaNacimiento) return 'N/A';
  const nacimiento = parseFechaNacimiento(fechaNacimiento);
  if (!nacimiento) return 'N/A';

  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const yaCumplio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());

  if (!yaCumplio) anios -= 1;
  return `${Math.max(anios, 0)} años`;
};

/**
 * Arma el modelo del PDF a partir de los datos. Pura y determinista salvo por la
 * fecha de impresion (que vive solo en el footer del render, no aca).
 */
export const buildHistoriaClinicaModel = (input: HistoriaClinicaPDFInput): HistoriaClinicaModel => {
  const { consulta, paciente, vet } = input;
  const sv = consulta.signosVitales;
  const soap = consulta.soap ?? { subjetivo: '', objetivo: '', analisis: '', plan: '' };

  const vitales: VitalPDF[] = [
    { label: 'Peso', val: sv?.peso ? `${sv.peso} kg` : '' },
    { label: 'Talla', val: sv?.talla ? `${sv.talla} cm` : '' },
    { label: 'Temp', val: sv?.temperatura ? `${sv.temperatura} °C` : '' },
    { label: 'FC', val: sv?.frecuenciaCardiaca ? `${sv.frecuenciaCardiaca} lpm` : '' },
    { label: 'FR', val: sv?.frecuenciaRespiratoria ? `${sv.frecuenciaRespiratoria} rpm` : '' },
    { label: 'CC', val: sv?.condicionCorporal ? `${sv.condicionCorporal}/5` : '' },
  ].filter((v) => v.val !== '');

  return {
    header: {
      vetName: vet.veterinaria || 'Clínica Veterinaria',
      vetSede: vet.sede ? `Sede: ${vet.sede} - ${vet.ciudad || ''}` : 'Sede Principal',
      vetTel: `Tel: ${vet.telefono || vet.whatsapp || 'No registrado'}`,
      numeroHC: consulta.numeroHC || 'S/N',
      fecha: formatFechaEsCo(new Date(consulta.fechaHora)),
    },
    paciente: {
      nombre: paciente.nombre,
      especie: paciente.especie,
      raza: paciente.raza || 'N/A',
      sexo: paciente.sexo,
      color: paciente.color || 'N/A',
      chip: paciente.chip || 'N/A',
      edad: calcEdad(paciente.fechaNacimiento),
      peso: sv?.peso ? `${sv.peso} kg` : 'N/A',
      propietarioNombre: paciente.propietario.nombre,
      propietarioTelefono: paciente.propietario.telefono,
    },
    consulta: {
      fechaHora: formatFechaHoraEsCo(new Date(consulta.fechaHora)),
      prioridad: PRIORIDAD_LABELS[consulta.prioridad || 'rutina'],
      motivo: consulta.motivo || 'No reportado',
    },
    vitales,
    soapSections: [
      { title: 'SUBJETIVO (S)', text: soap.subjetivo || 'No registrado' },
      { title: 'OBJETIVO (O)', text: soap.objetivo || 'No registrado' },
      { title: 'ANÁLISIS (A)', text: soap.analisis || 'No registrado' },
    ],
    plan: soap.plan || 'Sin plan médico registrado',
    examenes: (consulta.examenes ?? []).map((ex) => ({
      nombre: ex.nombre,
      resumen: ex.resumen || 'Sin resumen disponible.',
    })),
    firma: {
      nombre: `Dr(a). ${vet.nombre || 'Veterinario'}`,
      matricula: vet.matriculaProfesional ? `Matrícula Profesional: ${vet.matriculaProfesional}` : null,
    },
  };
};

/** Dibuja el PDF de la historia clinica y devuelve el documento jsPDF. */
export const renderHistoriaClinicaPDF = (input: HistoriaClinicaPDFInput): jsPDF => {
  const model = buildHistoriaClinicaModel(input);
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 14;

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      pdf.addPage();
      y = 20;
    }
  };

  // --- ENCABEZADO ---
  pdf.setFillColor(15, 110, 86);
  pdf.rect(0, 0, pageWidth, 35, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(model.header.vetName, 14, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(model.header.vetSede, 14, 23);
  pdf.text(model.header.vetTel, 14, 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`HISTORIA CLÍNICA N° ${model.header.numeroHC}`, pageWidth - 14, 22, { align: 'right' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Fecha: ${model.header.fecha}`, pageWidth - 14, 28, { align: 'right' });

  y = 45;

  // --- SECCIÓN I: PACIENTE ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 110, 86);
  pdf.text('I. DATOS DEL PACIENTE Y PROPIETARIO', 14, y);
  y += 6;
  pdf.setDrawColor(200, 200, 200);
  pdf.setFillColor(245, 245, 245);
  pdf.rect(14, y, pageWidth - 28, 30);
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  const p = model.paciente;
  pdf.setFont('helvetica', 'bold'); pdf.text('Nombre:', 16, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.nombre, 35, y + 6);
  pdf.setFont('helvetica', 'bold'); pdf.text('Especie:', 80, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.especie, 98, y + 6);
  pdf.setFont('helvetica', 'bold'); pdf.text('Raza:', 140, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.raza, 152, y + 6);
  pdf.setFont('helvetica', 'bold'); pdf.text('Sexo:', 16, y + 13);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.sexo, 35, y + 13);
  pdf.setFont('helvetica', 'bold'); pdf.text('Color:', 80, y + 13);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.color, 98, y + 13);
  pdf.setFont('helvetica', 'bold'); pdf.text('Chip:', 140, y + 13);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.chip, 152, y + 13);
  pdf.setFont('helvetica', 'bold'); pdf.text('Edad:', 16, y + 20);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.edad, 35, y + 20);
  pdf.setFont('helvetica', 'bold'); pdf.text('Peso:', 80, y + 20);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.peso, 98, y + 20);
  pdf.line(14, y + 23, pageWidth - 14, y + 23);
  pdf.setFont('helvetica', 'bold'); pdf.text('Propietario:', 16, y + 28);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.propietarioNombre, 40, y + 28);
  pdf.setFont('helvetica', 'bold'); pdf.text('Teléfono:', 100, y + 28);
  pdf.setFont('helvetica', 'normal'); pdf.text(p.propietarioTelefono, 120, y + 28);
  y += 38;

  // --- SECCIÓN II: CONSULTA ---
  checkPage(30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 110, 86);
  pdf.text('II. DATOS DE LA CONSULTA', 14, y);
  y += 6;
  pdf.rect(14, y, pageWidth - 28, 20);
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold'); pdf.text('Fecha/Hora:', 16, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.text(model.consulta.fechaHora, 40, y + 6);
  pdf.setFont('helvetica', 'bold'); pdf.text('Prioridad:', 100, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.text(model.consulta.prioridad, 120, y + 6);
  pdf.setFont('helvetica', 'bold'); pdf.text('Motivo:', 16, y + 13);
  pdf.setFont('helvetica', 'normal');
  const motivoLines = pdf.splitTextToSize(model.consulta.motivo, pageWidth - 45);
  pdf.text(motivoLines, 32, y + 13);
  y += 28;

  // --- SECCIÓN III: SIGNOS VITALES ---
  if (model.vitales.length > 0) {
    checkPage(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 110, 86);
    pdf.text('III. EXAMEN FÍSICO / SIGNOS VITALES', 14, y);
    y += 6;
    pdf.rect(14, y, pageWidth - 28, 12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(9);
    let xOffset = 16;
    model.vitales.forEach((v) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${v.label}:`, xOffset, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(v.val, xOffset + pdf.getTextWidth(`${v.label}: `), y + 7);
      xOffset += 35;
    });
    y += 20;
  }

  // --- SECCIÓN IV: SOAP ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 110, 86);
  pdf.text('IV. NOTA DE EVOLUCIÓN (SOAP)', 14, y);
  y += 8;
  model.soapSections.forEach((section) => {
    checkPage(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text(section.title, 14, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    const lines = pdf.splitTextToSize(section.text, pageWidth - 28);
    lines.forEach((line: string) => {
      checkPage(5);
      pdf.text(line, 14, y);
      y += 4.5;
    });
    y += 4;
  });

  // --- SECCIÓN V: PLAN / RECETA ---
  checkPage(30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 110, 86);
  pdf.text('V. PLAN MÉDICO / RECETA', 14, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  const planLines = pdf.splitTextToSize(model.plan, pageWidth - 28);
  planLines.forEach((line: string) => {
    checkPage(5);
    pdf.text(line, 14, y);
    y += 4.5;
  });
  y += 15;

  // --- SECCIÓN VI: EXÁMENES COMPLEMENTARIOS ---
  if (model.examenes.length > 0) {
    checkPage(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 110, 86);
    pdf.text('VI. EXÁMENES COMPLEMENTARIOS', 14, y);
    y += 8;
    model.examenes.forEach((ex) => {
      checkPage(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(ex.nombre, 14, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      const lines = pdf.splitTextToSize(ex.resumen, pageWidth - 28);
      lines.forEach((line: string) => {
        checkPage(5);
        pdf.text(line, 14, y);
        y += 4.5;
      });
      y += 4;
    });
  }

  // --- FIRMA ---
  checkPage(40);
  y += 20;
  pdf.line(14, y, 80, y);
  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text(model.firma.nombre, 14, y);
  y += 4;
  pdf.setFont('helvetica', 'normal');
  if (model.firma.matricula) {
    pdf.text(model.firma.matricula, 14, y);
  }

  // --- FOOTERS ---
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(220, 220, 220);
    pdf.line(14, 282, pageWidth - 14, 282);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text('Generado por Vethos AI - Software Clínico Veterinario', 14, 288);
    pdf.text(`Impreso: ${formatFechaHoraEsCo(new Date())}`, pageWidth / 2, 288, { align: 'center' });
    pdf.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 288, { align: 'right' });
  }

  return pdf;
};
