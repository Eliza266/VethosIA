import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { authState } = vi.hoisted(() => ({
  authState: { currentUser: null as null | { getIdToken: () => Promise<string> } },
}));
vi.mock('./firebase', () => ({ auth: authState }));

import {
  apiClient,
  setAuthErrorHandler,
  AUTH_ERROR_EVENT,
  type AuthErrorDetail,
} from './apiClient';
import type { InternalAxiosRequestConfig } from 'axios';

// adapter que simula una respuesta de error con un status dado.
const failingAdapter = (status: number) =>
  vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw Object.assign(new Error('request failed'), {
      isAxiosError: true,
      config,
      response: { data: {}, status, statusText: '', headers: {}, config },
    });
  });

describe('apiClient interceptor 401/403', () => {
  beforeEach(() => {
    authState.currentUser = null;
    setAuthErrorHandler(null);
  });
  afterEach(() => setAuthErrorHandler(null));

  it('401 dispara handler y evento global', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    const onEvent = vi.fn();
    window.addEventListener(AUTH_ERROR_EVENT, onEvent as EventListener);

    await expect(apiClient.get('/v1/x', { adapter: failingAdapter(401) })).rejects.toBeTruthy();

    expect(handler).toHaveBeenCalledWith<[AuthErrorDetail]>({ status: 401 });
    expect(onEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_ERROR_EVENT, onEvent as EventListener);
  });

  it('403 tambien notifica', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    await expect(apiClient.get('/v1/y', { adapter: failingAdapter(403) })).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledWith<[AuthErrorDetail]>({ status: 403 });
  });

  it('500 no dispara el handler de auth', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    await expect(apiClient.get('/v1/z', { adapter: failingAdapter(500) })).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});
