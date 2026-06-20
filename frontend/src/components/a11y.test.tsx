import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Badge, EmptyState } from './ui/Primitives';
import PdfPreviewModal from './PdfPreviewModal';

// a11y basica: nombres accesibles y roles correctos en componentes clave (nivel AA basico).
describe('a11y de componentes UI', () => {
  it('Button expone role button con nombre accesible', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('Badge muestra el estado como texto', () => {
    render(<Badge estado="aprobada" />);
    expect(screen.getByText('aprobada')).toBeInTheDocument();
  });

  it('EmptyState tiene titulo y accion accesibles', () => {
    render(<EmptyState titulo="Sin datos" mensaje="Nada aun" accion={<Button>Crear</Button>} />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });

  it('PdfPreviewModal es un dialog accesible con descargar/cerrar', () => {
    render(<PdfPreviewModal url="blob:fake" nombreArchivo="hc.pdf" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /vista previa del pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
  });
});
