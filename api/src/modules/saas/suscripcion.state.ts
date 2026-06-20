// Maquina de estados de la suscripcion (PDF §3.6).
//   trial_activa -> activa | vencida | bloqueada_mora | cancelada
//   activa       -> por_vencer | vencida | bloqueada_mora | cancelada
//   por_vencer   -> activa | vencida | bloqueada_mora | cancelada
//   vencida      -> activa | bloqueada_mora | cancelada     (reactivable por pago)
//   bloqueada_mora -> activa | cancelada                    (desbloqueo por pago)
//   cancelada    -> (terminal)
export type EstadoSuscripcion =
  | 'trial_activa'
  | 'activa'
  | 'por_vencer'
  | 'vencida'
  | 'bloqueada_mora'
  | 'bloqueado_fin_trial'
  | 'desactivado'
  | 'cancelada';

export const ESTADOS_SUSCRIPCION: EstadoSuscripcion[] = [
  'trial_activa',
  'activa',
  'por_vencer',
  'vencida',
  'bloqueada_mora',
  'bloqueado_fin_trial',
  'desactivado',
  'cancelada',
];

const TRANSICIONES: Record<EstadoSuscripcion, EstadoSuscripcion[]> = {
  // trial puede activarse (pago), vencer, bloquearse por mora, bloquearse por fin de trial,
  // desactivarse (admin) o cancelarse.
  trial_activa: ['activa', 'vencida', 'bloqueada_mora', 'bloqueado_fin_trial', 'desactivado', 'cancelada'],
  activa: ['por_vencer', 'vencida', 'bloqueada_mora', 'desactivado', 'cancelada'],
  por_vencer: ['activa', 'vencida', 'bloqueada_mora', 'desactivado', 'cancelada'],
  vencida: ['activa', 'bloqueada_mora', 'desactivado', 'cancelada'],
  bloqueada_mora: ['activa', 'desactivado', 'cancelada'],
  // fin de trial: se reactiva con pago, o se extiende el trial (vuelve a trial_activa), o se cancela/desactiva.
  bloqueado_fin_trial: ['activa', 'trial_activa', 'desactivado', 'cancelada'],
  // desactivado: reactivable por admin.
  desactivado: ['activa', 'cancelada'],
  cancelada: [],
};

export function puedeTransicionarSuscripcion(
  desde: EstadoSuscripcion,
  hacia: EstadoSuscripcion,
): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

export function transicionesSuscripcion(desde: EstadoSuscripcion): EstadoSuscripcion[] {
  return TRANSICIONES[desde] ?? [];
}

// Estados que permiten operar (no bloqueados). En vencida/bloqueada/cancelada se restringe IA.
export function suscripcionPermiteIa(estado: EstadoSuscripcion): boolean {
  return estado === 'trial_activa' || estado === 'activa' || estado === 'por_vencer';
}
