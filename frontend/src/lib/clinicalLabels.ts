const QA_PREFIX = /^(qa|test|e2e|demo|smoke)[-_]?/i;
const HASH_LIKE = /^[a-f0-9]{8,}$/i;

export function formatClinicalName(name: string | null | undefined, fallback = 'Paciente'): string {
  const raw = name?.trim();
  if (!raw) return fallback;
  if (HASH_LIKE.test(raw)) return 'Paciente registrado';
  if (QA_PREFIX.test(raw)) {
    const cleaned = raw.replace(QA_PREFIX, '').split(/[-_]/).filter(Boolean);
    if (cleaned.length === 0) return 'Paciente demo';
    return cleaned
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return raw;
}

export function formatConsultaEstado(estado: string | undefined): string {
  if (estado === 'aprobada') return 'SOAP aprobado';
  if (estado === 'borrador') return 'Borrador clínico';
  if (!estado) return 'Sin estado';
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

export function formatClinicalDateTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatSedeLabel(idOrName: string | null | undefined): string {
  const raw = idOrName?.trim();
  if (!raw) return 'Sede sin nombre';
  if (HASH_LIKE.test(raw) || /^vet(clin|_)?/i.test(raw)) {
    return raw.replace(/^(vetclin_|vet_)/i, 'Sede ').replace(/_/g, ' ');
  }
  return formatClinicalName(raw, 'Sede');
}
