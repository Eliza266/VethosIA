import type { Notificacion } from './api';

export function rutaNotificacion(
  n: Pick<Notificacion, 'resourcePath' | 'resourceType' | 'resourceId' | 'pacienteId' | 'consultaId'>,
): string | null {
  const pacienteId = cleanId(n.pacienteId);
  const consultaId = cleanId(n.consultaId);
  if (pacienteId && consultaId) return `/pacientes/${pacienteId}/consultas/${consultaId}`;
  if (pacienteId && (n.resourceType === 'consulta' || n.resourceType === 'paciente')) return `/pacientes/${pacienteId}`;

  const raw = n.resourcePath?.trim();
  const rutaDirecta = rutaDirectaSegura(raw);
  if (rutaDirecta) return rutaDirecta;
  if (raw) {
    const [collection, id, nestedCollection, nestedId] = raw.split('/');
    if (collection === 'pacientes' && id && nestedCollection === 'consultas' && nestedId) {
      return `/pacientes/${id}/consultas/${nestedId}`;
    }
    if (collection === 'pacientes' && id) return `/pacientes/${id}`;
    if (collection === 'citas') return '/agenda';
    if (collection === 'vacunas') return '/vacunas';
    if (collection === 'consultas') return pacienteId ? `/pacientes/${pacienteId}` : '/pacientes';
    if (collection === 'consumos' || collection === 'suscripciones') return '/suscripcion';
    if (collection === 'solicitudesTecnicas') return '/entidad';
  }

  switch (n.resourceType) {
    case 'paciente':
      return n.resourceId ? `/pacientes/${n.resourceId}` : '/pacientes';
    case 'cita':
      return '/agenda';
    case 'vacuna':
      return '/vacunas';
    case 'consulta':
      return pacienteId ? `/pacientes/${pacienteId}` : '/pacientes';
    case 'consumo':
    case 'suscripcion':
      return '/suscripcion';
    case 'solicitud_tecnica':
      return '/entidad';
    default:
      return null;
  }
}

export function etiquetaNotificacion(tipo: string | null | undefined, resourceType?: string | null): string {
  switch (tipo) {
    case 'cita_recordatorio':
      return 'Cita';
    case 'vacunas_pendientes':
      return 'Vacuna';
    case 'consumo_80':
    case 'consumo_100':
      return 'Consumo';
    case 'suscripcion_por_vencer':
    case 'suscripcion_vencida':
    case 'suscripcion_bloqueada':
    case 'cuenta_bloqueada':
      return 'Suscripción';
    case 'invitacion_expirada':
      return 'Invitacion';
    default:
      switch (resourceType) {
        case 'cita':
          return 'Cita';
        case 'vacuna':
          return 'Vacuna';
        case 'consumo':
          return 'Consumo';
        case 'suscripcion':
          return 'Suscripción';
        case 'invitacion':
          return 'Invitacion';
        default:
          return 'Sistema';
      }
  }
}

function cleanId(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean ? clean : null;
}

function rutaDirectaSegura(raw: string | null | undefined): string | null {
  if (!raw?.startsWith('/')) return null;
  const rutas = [
    '/agenda',
    '/vacunas',
    '/suscripcion',
    '/mi-plan',
    '/plan',
    '/pacientes',
    '/entidad',
    '/veterinaria',
    '/admin',
    '/brigadas',
    '/notificaciones',
  ];
  return rutas.some((ruta) => raw === ruta || raw.startsWith(`${ruta}/`)) ? raw : null;
}
