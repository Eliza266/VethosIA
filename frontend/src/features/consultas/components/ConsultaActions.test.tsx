import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Consulta, Paciente } from '../../../types';
import ConsultaActions from './ConsultaActions';

const mockUseMe = vi.fn();

vi.mock('../../tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

const consultaBorrador: Consulta = {
  id: 'c1',
  pacienteId: 'p1',
  veterinarioId: 'vet1',
  estado: 'borrador',
  fechaHora: new Date('2026-06-01T10:00:00.000Z'),
  creadoEn: new Date('2026-06-01T09:00:00.000Z'),
  motivo: 'Control',
  prioridad: 'rutina',
  soap: {
    subjetivo: 'Tos',
    objetivo: 'Normal',
    analisis: 'Rinitis',
    plan: 'Reposo',
    generadoPorIA: true,
  },
};

const paciente: Paciente = {
  id: 'p1',
  nombre: 'Firulais',
  especie: 'perro',
  sexo: 'macho',
  estadoReproductivo: 'entero',
  veterinarioId: 'vet1',
  propietario: { nombre: 'Juan', telefono: '+573001234567' },
  creadoEn: new Date('2026-01-01'),
};

const consultaAprobada: Consulta = {
  ...consultaBorrador,
  estado: 'aprobada',
  numeroHC: 'HC000001',
};

const pacienteConEmail: Paciente = {
  ...paciente,
  propietario: { ...paciente.propietario, email: 'qa@example.com' },
};

const noop = vi.fn();

function renderActions(profile: string | Record<string, unknown>) {
  mockUseMe.mockReturnValue({
    data: typeof profile === 'string' ? { rol: profile } : profile,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConsultaActions
        consulta={consultaBorrador}
        paciente={paciente}
        isDeleting={false}
        isSavingDatos={false}
        isApproving={false}
        isSendingWhatsApp={false}
        isSendingEmail={false}
        onDelete={noop}
        onSaveDatos={noop}
        onApprove={noop}
        onSendWhatsApp={noop}
        onSendEmail={noop}
        onDownloadPDF={noop}
      />
    </QueryClientProvider>,
  );
}

describe('ConsultaActions (RBAC eliminar borrador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vet ve boton eliminar en borrador', () => {
    renderActions('vet');
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('admin veterinaria con scope ve boton eliminar en borrador', () => {
    renderActions({ role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetclin_1' });
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('asistente NO ve acciones de consulta borrador', () => {
    renderActions('asistente');
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
  });

  it('admin entidad y superadmin NO ven eliminar consulta borrador', () => {
    const { unmount } = renderActions('admin');
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    unmount();

    renderActions('superadmin');
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});

describe('ConsultaActions (RBAC aprobar borrador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vet ve boton aprobar cuando hay SOAP', () => {
    renderActions('vet');
    expect(screen.getByRole('button', { name: /aprobar consulta/i })).toBeInTheDocument();
  });

  it('admin veterinaria con scope ve boton aprobar cuando hay SOAP', () => {
    renderActions({ role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetclin_1' });
    expect(screen.getByRole('button', { name: /aprobar consulta/i })).toBeInTheDocument();
  });

  it('superadmin NO ve boton aprobar cuando hay SOAP', () => {
    renderActions('superadmin');
    expect(screen.queryByRole('button', { name: /aprobar consulta/i })).not.toBeInTheDocument();
  });

  it('asistente NO ve aprobar consulta borrador', () => {
    renderActions('asistente');
    expect(screen.queryByRole('button', { name: /aprobar consulta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
  });
});

describe('ConsultaActions (documentos aprobados)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantiene WhatsApp, PDF y email visibles para consulta aprobada con correo', () => {
    mockUseMe.mockReturnValue({ data: { rol: 'vet' } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ConsultaActions
          consulta={consultaAprobada}
          paciente={pacienteConEmail}
          isDeleting={false}
          isSavingDatos={false}
          isApproving={false}
          isSendingWhatsApp={false}
          isSendingEmail={false}
          onDelete={noop}
          onSaveDatos={noop}
          onApprove={noop}
          onSendWhatsApp={noop}
          onSendEmail={noop}
          onDownloadPDF={noop}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar por email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toBeInTheDocument();
  });
});
