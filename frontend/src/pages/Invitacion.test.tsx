import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Invitacion from './Invitacion';

const { mockAceptarInvitacion } = vi.hoisted(() => ({
  mockAceptarInvitacion: vi.fn(),
}));

vi.mock('../features/tenant/api', () => ({
  aceptarInvitacion: mockAceptarInvitacion,
}));

function renderInvitacion() {
  return render(
    <MemoryRouter initialEntries={['/invitacion?token=token_valido_123']}>
      <Routes>
        <Route path="/invitacion" element={<Invitacion />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Invitacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra estado pendiente cuando la vinculacion requiere revision tecnica', async () => {
    mockAceptarInvitacion.mockResolvedValue({
      estado: 'pendiente_revision_tecnica',
      solicitudTecnicaId: 'sol_1',
      mensaje: 'La vinculacion quedo pendiente de revision por Area Tecnica.',
      orgId: 'orgA',
      rol: 'vet',
    });

    renderInvitacion();
    fireEvent.click(screen.getByRole('button', { name: /aceptar invitacion/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/pendiente de revision/i);
    expect(mockAceptarInvitacion).toHaveBeenCalledWith('token_valido_123');
  });
});
