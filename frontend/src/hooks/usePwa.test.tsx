import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwa } from './usePwa';

describe('usePwa', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refleja el estado online/offline', () => {
    const { result } = renderHook(() => usePwa());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.online).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.online).toBe(true);
  });

  it('promptInstall devuelve "unavailable" sin evento de instalacion', async () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.instalable).toBe(false);
    const r = await result.current.promptInstall();
    expect(r).toBe('unavailable');
  });

  it('captura beforeinstallprompt y queda instalable', () => {
    const { result } = renderHook(() => usePwa());
    act(() => {
      const e = new Event('beforeinstallprompt');
      window.dispatchEvent(e);
    });
    expect(result.current.instalable).toBe(true);
  });
});
