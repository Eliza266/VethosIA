import {
  puedeTransicionarSuscripcion,
  transicionesSuscripcion,
  suscripcionPermiteIa,
} from '../../src/modules/saas/suscripcion.state';

describe('suscripcion state machine', () => {
  it('trial_activa puede activarse o bloquearse', () => {
    expect(puedeTransicionarSuscripcion('trial_activa', 'activa')).toBe(true);
    expect(puedeTransicionarSuscripcion('trial_activa', 'vencida')).toBe(true);
  });

  it('activa -> por_vencer -> activa es valido', () => {
    expect(puedeTransicionarSuscripcion('activa', 'por_vencer')).toBe(true);
    expect(puedeTransicionarSuscripcion('por_vencer', 'activa')).toBe(true);
  });

  it('vencida se reactiva con pago; bloqueada_mora tambien', () => {
    expect(puedeTransicionarSuscripcion('vencida', 'activa')).toBe(true);
    expect(puedeTransicionarSuscripcion('bloqueada_mora', 'activa')).toBe(true);
  });

  it('cancelada es terminal', () => {
    expect(transicionesSuscripcion('cancelada')).toEqual([]);
    expect(puedeTransicionarSuscripcion('cancelada', 'activa')).toBe(false);
  });

  it('transicion invalida: bloqueada_mora -> por_vencer', () => {
    expect(puedeTransicionarSuscripcion('bloqueada_mora', 'por_vencer')).toBe(false);
  });

  it('bloqueado_fin_trial -> activa (pago) o trial_activa (extender) validas', () => {
    expect(puedeTransicionarSuscripcion('trial_activa', 'bloqueado_fin_trial')).toBe(true);
    expect(puedeTransicionarSuscripcion('bloqueado_fin_trial', 'activa')).toBe(true);
    expect(puedeTransicionarSuscripcion('bloqueado_fin_trial', 'trial_activa')).toBe(true);
  });

  it('desactivado -> activa (reactivar) o cancelada; no a por_vencer', () => {
    expect(puedeTransicionarSuscripcion('activa', 'desactivado')).toBe(true);
    expect(puedeTransicionarSuscripcion('desactivado', 'activa')).toBe(true);
    expect(puedeTransicionarSuscripcion('desactivado', 'por_vencer')).toBe(false);
  });

  it('los nuevos estados bloqueados no permiten IA', () => {
    expect(suscripcionPermiteIa('bloqueado_fin_trial')).toBe(false);
    expect(suscripcionPermiteIa('desactivado')).toBe(false);
  });

  it('permiteIa solo en trial/activa/por_vencer', () => {
    expect(suscripcionPermiteIa('activa')).toBe(true);
    expect(suscripcionPermiteIa('trial_activa')).toBe(true);
    expect(suscripcionPermiteIa('por_vencer')).toBe(true);
    expect(suscripcionPermiteIa('vencida')).toBe(false);
    expect(suscripcionPermiteIa('bloqueada_mora')).toBe(false);
    expect(suscripcionPermiteIa('cancelada')).toBe(false);
  });
});
