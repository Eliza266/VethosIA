// ─── VETERINARIO ───────────────────────────────────────────
export interface Veterinario {
  uid: string;
  nombre: string;
  email: string;
  foto?: string;
  telefono?: string;
  whatsapp?: string;
  ciudad?: string;
  sede?: string;
  veterinaria?: string;
  matriculaProfesional?: string;
  creadoEn: Date;
}

// ─── PROPIETARIO ───────────────────────────────────────────
export interface Propietario {
  nombre: string;
  telefono: string;
  whatsapp?: string;
  email?: string;
  direccion?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  // codigo de pais para el link de WhatsApp (ej. '57' Colombia, '52' Mexico).
  // Antes estaba hardcodeado '57' en DetalleConsulta; ahora gana este > env > '57'.
  codigoPais?: string;
}

// ─── PACIENTE ──────────────────────────────────────────────
export interface Paciente {
  id?: string;
  nombre: string;
  especie: 'perro' | 'gato' | 'ave' | 'reptil' | 'otro';
  raza?: string;
  fechaNacimiento?: string;
  sexo: 'macho' | 'hembra';
  estadoReproductivo: 'entero' | 'castrado' | 'esterilizado';
  color?: string;
  chip?: string;
  foto?: string;
  origen?: string;
  notasGenerales?: string;
  ultimoPeso?: number;
  ultimaTalla?: number;
  veterinarioId: string;
  entidadId?: string;
  // multi-tenant: opcional para no romper datos viejos sin orgId
  orgId?: string;
  propietario: Propietario;
  /** true si se creo automaticamente desde "consulta rapida" y aun no se confirmo. */
  esPlaceholder?: boolean;
  creadoEn: Date;
}

// ─── SIGNOS VITALES ────────────────────────────────────────
export interface SignosVitales {
  peso?: number;
  // talla en cm. Ojo: el codigo viejo leia signosVitales.talla / .altura al
  // aprobar para setear paciente.ultimaTalla, pero ni la IA ni el form lo
  // producian => ultimaTalla casi nunca se llenaba. Ahora 'talla' es el campo
  // canonico y el form de signos vitales lo captura.
  talla?: number;
  temperatura?: number;
  frecuenciaCardiaca?: number;
  frecuenciaRespiratoria?: number;
  condicionCorporal?: 1 | 2 | 3 | 4 | 5;
  mucosas?: string;
  deshidratacion?: string;
  pulso?: string;
}

// ─── MEDICAMENTO SUGERIDO ──────────────────────────────────
export interface MedicamentoSugerido {
  nombre: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  indicacion: string;
}

// ─── SOAP ──────────────────────────────────────────────────
export type DiagnosticoTipo = 'principal' | 'diferencial' | 'secundario';
export type DiagnosticoEstado = 'presuntivo' | 'confirmado' | 'descartado';
export type DiagnosticoOrigen = 'ia' | 'manual';

export interface DiagnosticoEstructurado {
  id: string;
  nombre: string;
  tipo: DiagnosticoTipo;
  estado: DiagnosticoEstado;
  especie?: string;
  sistema?: string;
  codigo?: string;
  notas?: string;
  origen: DiagnosticoOrigen;
  creadoEn: string;
  actualizadoEn?: string;
}

export interface SOAP {
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  medicamentosSugeridos?: MedicamentoSugerido[];
  // false => la IA fallo y esto es solo la transcripcion cruda metida en subjetivo.
  // Lo marcamos para que la UI muestre un aviso y nadie lo confunda con una nota
  // estructurada de verdad. undefined = notas viejas (asumimos generadas por IA).
  generadoPorIA?: boolean;
}

// Resultado crudo de la generacion de SOAP por IA (gemini.ts). Antes esto era
// `any` y se accedia a campos a ciegas. Lo tipamos para no perder el autocompletado
// ni meter campos que no existen.
export interface ResultadoSOAP {
  motivo: string;
  prioridad: Consulta['prioridad'];
  signosVitales: SignosVitales;
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  diagnosticoEstructurado: DiagnosticoEstructurado[];
  medicamentosSugeridos: MedicamentoSugerido[];
  // bandera interna: true cuando salio de la IA, false cuando es el fallback.
  generadoPorIA: boolean;
}

// ─── CONSULTA ──────────────────────────────────────────────
export interface ExamenConsulta {
  id: string;
  nombre: string;
  resumen: string;
  storagePath: string;
  subidoEn: string;
}

/** Paciente/propietario detectados por la IA en consultas rapidas (sin paciente preseleccionado). */
export interface DatosDetectadosConsulta {
  nombrePaciente?: string | null;
  especie?: string | null;
  raza?: string | null;
  nombrePropietario?: string | null;
  telefonoPropietario?: string | null;
}

export interface Consulta {
  id?: string;
  numeroHC?: string;
  pacienteId: string;
  veterinarioId: string;
  orgId?: string;
  brigadaId?: string;
  citaId?: string;
  fechaHora: Date;
  motivo?: string;
  prioridad?: 'urgente' | 'rutina' | 'seguimiento' | 'brigada';
  signosVitales?: SignosVitales;
  audioUrl?: string;
  // URLs de cada bloque grabado. audioUrl conserva el primero por compatibilidad.
  audioUrls?: string[];
  transcripcion?: string;
  soap?: SOAP;
  diagnosticoEstructurado?: DiagnosticoEstructurado[];
  /** Resultados de examenes (PDF) subidos con resumen de IA. No forma parte del SOAP. */
  examenes?: ExamenConsulta[];
  /** Datos de paciente/propietario que la IA detecto en el audio (consulta rapida). */
  datosDetectados?: DatosDetectadosConsulta;
  /** true si esta consulta se inicio con un paciente placeholder (aun sin confirmar). */
  pacientePendienteConfirmar?: boolean;
  estado: 'procesando' | 'borrador' | 'aprobada' | 'error';
  ubicacion?: {
    direccion?: string;
    lat?: number;
    lng?: number;
  };
  creadoEn: Date;
}

// ─── CITA ──────────────────────────────────────────────────
export interface Cita {
  id?: string;
  pacienteId: string;
  nombrePaciente: string;
  veterinarioId: string;
  orgId?: string;
  fecha: string;
  horaInicio: string;
  duracion: number;
  motivo: string;
  estado: 'programada' | 'en_atencion' | 'realizada' | 'cancelada' | 'no_asistio';
  consultaId?: string;
  creadoEn: Date;
}

// ─── BRIGADA ───────────────────────────────────────────────
export interface Brigada {
  id?: string;
  nombre: string;
  descripcion?: string;
  fecha: string;
  ubicacion: {
    direccion: string;
    ciudad: string;
    lat?: number;
    lng?: number;
  };
  veterinarioIds: string[];
  accountType?: 'vet_individual' | 'veterinaria' | 'entidad';
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  orgId?: string;
  estado: 'planificada' | 'en_curso' | 'finalizada';
  totalConsultas?: number;
  creadoEn: Date;
}

export interface BrigadaAtencion {
  id: string;
  brigadaId: string;
  pacienteId?: string;
  consultaId?: string;
  veterinarioId: string;
  motivo: string;
  notas?: string;
  especie?: string;
  fechaHora: string;
  entidadId?: string;
  veterinariaId?: string;
  orgId?: string;
  createdBy: string;
  creadoEn?: Date;
}

export interface BrigadaConsolidado {
  brigadaId: string;
  nombre: string;
  estado: Brigada['estado'];
  fecha: string;
  entidadId?: string;
  veterinariaId?: string;
  totalAtenciones: number;
  pacientesUnicos: number;
  veterinariosParticipantes: number;
  veterinariosConAtencion: number;
}

// ─── CONTADOR HC ───────────────────────────────────────────
export interface ContadorHC {
  ultimo: number;
}

// ─── MULTI-TENANT ──────────────────────────────────────────
// Modelo organizaciones/{orgId} + miembros/{uid}. Por ahora dejamos los tipos y
// un helper de contexto (ver lib/orgContext.ts); NO forzamos multi-tenant en la UI
// para no romper la app de un vet individual.
// Legacy Firestore model. `asistente` can exist in old data, but new
// memberships/invitations must use RolMiembroAsignable.
export type RolMiembro = 'admin' | 'vet' | 'asistente';
export type RolMiembroAsignable = 'admin' | 'vet';

export interface Organizacion {
  id?: string;
  nombre: string;
  // datos de la clinica que hoy viven sueltos en veterinarios/{uid}
  ciudad?: string;
  sede?: string;
  logo?: string;
  creadoEn: Date;
}

export interface Miembro {
  // id del doc = uid del usuario
  uid: string;
  orgId: string;
  rol: RolMiembro;
  creadoEn?: Date;
}
