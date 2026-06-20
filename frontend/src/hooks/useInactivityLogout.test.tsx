import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInactivityLogout } from './useInactivityLogout';

describe('useInactivityLogout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('llama onTimeout tras N horas sin actividad', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout(onTimeout, { hours: 1 }));
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('la actividad reinicia el temporizador', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout(onTimeout, { hours: 1 }));
    vi.advanceTimersByTime(50 * 60 * 1000);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(50 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('no arma temporizador si enabled=false', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout(onTimeout, { hours: 1, enabled: false }));
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
