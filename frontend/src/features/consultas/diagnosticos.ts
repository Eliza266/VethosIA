import type {
  DiagnosticoEstructurado,
  DiagnosticoEstado,
  DiagnosticoOrigen,
  DiagnosticoTipo,
} from '../../types';

export const DIAGNOSTICO_TIPOS: { value: DiagnosticoTipo; label: string }[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'diferencial', label: 'Diferencial' },
  { value: 'secundario', label: 'Secundario' },
];

export const DIAGNOSTICO_ESTADOS: { value: DiagnosticoEstado; label: string }[] = [
  { value: 'presuntivo', label: 'Presuntivo' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'descartado', label: 'Descartado' },
];

const TIPOS = DIAGNOSTICO_TIPOS.map((t) => t.value);
const ESTADOS = DIAGNOSTICO_ESTADOS.map((e) => e.value);
const ORIGENES: DiagnosticoOrigen[] = ['ia', 'manual'];

const asString = (value: unknown, max = 120): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;

const slugId = (nombre: string, index: number): string =>
  `diag-${index + 1}-${nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'manual'}`;

export const crearDiagnosticoManual = (now = new Date().toISOString()): DiagnosticoEstructurado => ({
  id: `diag-${Date.now()}`,
  nombre: 'Nuevo diagnostico',
  tipo: 'principal',
  estado: 'presuntivo',
  origen: 'manual',
  creadoEn: now,
});

export const normalizarDiagnosticosEstructurados = (
  raw: unknown,
): DiagnosticoEstructurado[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .map((item, index): DiagnosticoEstructurado | null => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const nombre = asString(data.nombre);
      if (!nombre) return null;
      const diagnostico: DiagnosticoEstructurado = {
        id: asString(data.id, 64) ?? slugId(nombre, index),
        nombre,
        tipo: oneOf(data.tipo, TIPOS, 'principal'),
        estado: oneOf(data.estado, ESTADOS, 'presuntivo'),
        origen: oneOf(data.origen, ORIGENES, 'manual'),
        creadoEn: asString(data.creadoEn, 40) ?? new Date().toISOString(),
      };
      const especie = asString(data.especie, 80);
      const sistema = asString(data.sistema, 80);
      const codigo = asString(data.codigo, 64);
      const notas = asString(data.notas, 500);
      const actualizadoEn = asString(data.actualizadoEn, 40);
      if (especie) diagnostico.especie = especie;
      if (sistema) diagnostico.sistema = sistema;
      if (codigo) diagnostico.codigo = codigo;
      if (notas) diagnostico.notas = notas;
      if (actualizadoEn) diagnostico.actualizadoEn = actualizadoEn;
      return diagnostico;
    })
    .filter((item): item is DiagnosticoEstructurado => Boolean(item));
};

export const descripcionDiagnostico = (
  diagnosticos: DiagnosticoEstructurado[] | undefined,
  analisisTexto: string,
): string => {
  if (diagnosticos?.length) {
    return diagnosticos.map((d) => d.nombre).join(', ');
  }
  return analisisTexto.trim() || 'Sin diagnostico registrado';
};
