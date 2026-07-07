import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WelcomeInstallModal from './WelcomeInstallModal';

const STORAGE_KEY = 'vethos_welcome_install_seen';

describe('WelcomeInstallModal', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('aparece despues de un momento en la primera visita', () => {
    render(<WelcomeInstallModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('dialog', { name: /bienvenido a vethos ai/i })).toBeInTheDocument();
  });

  it('no aparece si ya se marco como visto', () => {
    window.localStorage.setItem(STORAGE_KEY, 'visto');
    render(<WelcomeInstallModal />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Ahora no" cierra el modal y lo marca como visto', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<WelcomeInstallModal />);
    expect(await screen.findByRole('dialog', {}, { timeout: 2000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ahora no/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('visto');
  });

  it('muestra el boton de instalar cuando el navegador dispara beforeinstallprompt', async () => {
    vi.useRealTimers();
    render(<WelcomeInstallModal />);
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    expect(
      await screen.findByRole('button', { name: /instalar vethos ai/i }, { timeout: 2000 }),
    ).toBeInTheDocument();
  });
});
