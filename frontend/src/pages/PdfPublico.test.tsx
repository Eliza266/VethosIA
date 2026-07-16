import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PdfPublico from './PdfPublico';

const mockGet = vi.fn();

vi.mock('../lib/apiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

function renderPagina(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/pdf/${token}`]}>
      <Routes>
        <Route path="/pdf/:token" element={<PdfPublico />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PdfPublico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el boton de descarga cuando el link sigue vigente', async () => {
    mockGet.mockResolvedValue({ data: { ok: true, downloadUrl: 'https://signed.example/historia.pdf' } });
    renderPagina('tok123');

    const link = await screen.findByRole('link', { name: /descargar pdf/i });
    expect(link).toHaveAttribute('href', 'https://signed.example/historia.pdf');
    expect(mockGet).toHaveBeenCalledWith('/v1/pdf/tok123');
  });

  it('muestra mensaje de enlace vencido cuando el token ya no es valido', async () => {
    mockGet.mockResolvedValue({ data: { ok: false } });
    renderPagina('tok-viejo');

    expect(await screen.findByText(/este enlace venci[oó]/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /descargar pdf/i })).not.toBeInTheDocument();
  });

  it('muestra mensaje de vencido si la API falla', async () => {
    mockGet.mockRejectedValue(new Error('network error'));
    renderPagina('tok-error');

    expect(await screen.findByText(/este enlace venci[oó]/i)).toBeInTheDocument();
  });
});
