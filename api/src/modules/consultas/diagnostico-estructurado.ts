export const DIAGNOSTICO_TIPOS = ['principal', 'diferencial', 'secundario'] as const;
export const DIAGNOSTICO_ESTADOS = ['presuntivo', 'confirmado', 'descartado'] as const;
export const DIAGNOSTICO_ORIGENES = ['ia', 'manual'] as const;
export const MAX_DIAGNOSTICOS_ESTRUCTURADOS = 10;

export type DiagnosticoTipo = (typeof DIAGNOSTICO_TIPOS)[number];
export type DiagnosticoEstado = (typeof DIAGNOSTICO_ESTADOS)[number];
export type DiagnosticoOrigen = (typeof DIAGNOSTICO_ORIGENES)[number];

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

export class DiagnosticoEstructuradoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagnosticoEstructuradoValidationError';
  }
}

interface NormalizeOptions {
  origenDefault?: DiagnosticoOrigen;
  now?: () => string;
  strict?: boolean;
}

const DEFAULT_NOW = (): string => new Date().toISOString();

const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

const asOptionalString = (
  value: unknown,
  maxLength: number,
  field: string,
  strict: boolean,
): string | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    if (strict) throw new DiagnosticoEstructuradoValidationError(`${field} debe ser texto.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    if (strict) {
      throw new DiagnosticoEstructuradoValidationError(
        `${field} excede ${maxLength} caracteres.`,
      );
    }
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const fallbackId = (nombre: string, index: number): string => {
  const slug = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `diag-${index + 1}${slug ? `-${slug}` : ''}`;
};

export function normalizarDiagnosticosEstructurados(
  raw: unknown,
  options: NormalizeOptions = {},
): DiagnosticoEstructurado[] {
  const strict = options.strict ?? true;
  const origenDefault = options.origenDefault ?? 'manual';
  const now = options.now ?? DEFAULT_NOW;

  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    if (strict) {
      throw new DiagnosticoEstructuradoValidationError('diagnosticoEstructurado debe ser un array.');
    }
    return [];
  }
  if (raw.length > MAX_DIAGNOSTICOS_ESTRUCTURADOS) {
    if (strict) {
      throw new DiagnosticoEstructuradoValidationError(
        `diagnosticoEstructurado permite maximo ${MAX_DIAGNOSTICOS_ESTRUCTURADOS} items.`,
      );
    }
  }

  const items = raw.slice(0, MAX_DIAGNOSTICOS_ESTRUCTURADOS);
  const normalized: DiagnosticoEstructurado[] = [];

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object') {
      if (strict) {
        throw new DiagnosticoEstructuradoValidationError(
          `diagnosticoEstructurado[${index}] debe ser objeto.`,
        );
      }
      continue;
    }
    const data = item as Record<string, unknown>;
    const nombre = asOptionalString(data.nombre, 120, `diagnosticoEstructurado[${index}].nombre`, strict);
    if (!nombre) {
      if (strict) {
        throw new DiagnosticoEstructuradoValidationError(
          `diagnosticoEstructurado[${index}].nombre es requerido.`,
        );
      }
      continue;
    }

    const tipo = isOneOf(data.tipo, DIAGNOSTICO_TIPOS) ? data.tipo : undefined;
    const estado = isOneOf(data.estado, DIAGNOSTICO_ESTADOS) ? data.estado : undefined;
    const origen = isOneOf(data.origen, DIAGNOSTICO_ORIGENES) ? data.origen : origenDefault;

    if (!tipo && strict) {
      throw new DiagnosticoEstructuradoValidationError(
        `diagnosticoEstructurado[${index}].tipo no es valido.`,
      );
    }
    if (!estado && strict) {
      throw new DiagnosticoEstructuradoValidationError(
        `diagnosticoEstructurado[${index}].estado no es valido.`,
      );
    }

    const creadoEn =
      asOptionalString(data.creadoEn, 40, `diagnosticoEstructurado[${index}].creadoEn`, strict) ??
      now();
    const actualizadoEn = asOptionalString(
      data.actualizadoEn,
      40,
      `diagnosticoEstructurado[${index}].actualizadoEn`,
      strict,
    );

    normalized.push({
      id:
        asOptionalString(data.id, 64, `diagnosticoEstructurado[${index}].id`, strict) ??
        fallbackId(nombre, index),
      nombre,
      tipo: tipo ?? 'principal',
      estado: estado ?? 'presuntivo',
      ...(asOptionalString(data.especie, 80, `diagnosticoEstructurado[${index}].especie`, strict)
        ? {
            especie: asOptionalString(
              data.especie,
              80,
              `diagnosticoEstructurado[${index}].especie`,
              strict,
            ),
          }
        : {}),
      ...(asOptionalString(data.sistema, 80, `diagnosticoEstructurado[${index}].sistema`, strict)
        ? {
            sistema: asOptionalString(
              data.sistema,
              80,
              `diagnosticoEstructurado[${index}].sistema`,
              strict,
            ),
          }
        : {}),
      ...(asOptionalString(data.codigo, 64, `diagnosticoEstructurado[${index}].codigo`, strict)
        ? {
            codigo: asOptionalString(
              data.codigo,
              64,
              `diagnosticoEstructurado[${index}].codigo`,
              strict,
            ),
          }
        : {}),
      ...(asOptionalString(data.notas, 500, `diagnosticoEstructurado[${index}].notas`, strict)
        ? {
            notas: asOptionalString(
              data.notas,
              500,
              `diagnosticoEstructurado[${index}].notas`,
              strict,
            ),
          }
        : {}),
      origen,
      creadoEn,
      ...(actualizadoEn ? { actualizadoEn } : {}),
    });
  }

  return normalized;
}

export function textoDiagnosticoFallback(
  diagnosticos: DiagnosticoEstructurado[] | undefined,
  analisis: string,
): string {
  if (diagnosticos?.length) {
    return diagnosticos
      .map((d) =>
        [
          d.nombre,
          d.tipo !== 'principal' ? d.tipo : '',
          d.estado,
          d.sistema ? `Sistema: ${d.sistema}` : '',
          d.codigo ? `Codigo: ${d.codigo}` : '',
          d.notas ?? '',
        ]
          .filter(Boolean)
          .join(' - '),
      )
      .join('\n');
  }
  return analisis.trim();
}
