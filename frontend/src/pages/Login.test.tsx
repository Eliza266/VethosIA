import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { loginWithEmail, loginWithGoogle, resetPassword } = vi.hoisted(() => ({
  loginWithEmail: vi.fn().mockResolvedValue(undefined),
  loginWithGoogle: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    loginWithGoogle,
    loginWithEmail,
    resetPassword,
    accessDeniedMessage: null,
  }),
}));

vi.mock('../lib/firebase', () => ({
  isFirebaseConfigured: true,
  missingFirebaseConfig: [],
}));

import Login from './Login';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

describe('Login (sin auto-registro)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('NO ofrece crear cuenta (alta solo por invitación)', () => {
    renderLogin();
    expect(screen.queryByText(/crear una cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/crear cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/¿ya tienes cuenta/i)).not.toBeInTheDocument();
  });

  it('el botón de submit siempre es "Iniciar sesión"', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /^iniciar sesión$/i })).toBeInTheDocument();
  });

  it('mantiene login por email y recuperación de contraseña', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'vet@vethosia.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secreto123' } });
    fireEvent.click(screen.getByRole('button', { name: /^iniciar sesión$/i }));

    await waitFor(() =>
      expect(loginWithEmail).toHaveBeenCalledWith('vet@vethosia.com', 'secreto123'),
    );
    expect(screen.getByText(/¿olvidaste tu contraseña\?/i)).toBeInTheDocument();
  });
});
