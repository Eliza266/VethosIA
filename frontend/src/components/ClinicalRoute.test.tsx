import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClinicalRoute from './ClinicalRoute';

const mockUseMe = vi.fn();

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderGuard(profile: Record<string, unknown> | null, path = '/pacientes') {
  mockUseMe.mockReturnValue({
    data: profile,
    isLoading: false,
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ClinicalRoute />}>
          <Route path="/pacientes" element={<div>Pacientes Clinicos</div>} />
          <Route path="/agenda" element={<div>Agenda Clinica</div>} />
          <Route path="/brigadas" element={<div>Brigadas Clinicas</div>} />
          <Route path="/pacientes/nuevo" element={<div>Nuevo Paciente</div>} />
          <Route path="/pacientes/:id" element={<div>Detalle Paciente</div>} />
          <Route path="/pacientes/:pacienteId/consultas/nueva" element={<div>Nueva Consulta</div>} />
          <Route path="/pacientes/:pacienteId/consultas/:consultaId" element={<div>Detalle Consulta</div>} />
        </Route>
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/admin" element={<div>Plataforma</div>} />
        <Route path="/entidad" element={<div>Vista Entidad</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ClinicalRoute', () => {
  it('muestra spinner mientras carga permisos', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: true });
    render(
      <MemoryRouter initialEntries={['/pacientes']}>
        <Routes>
          <Route element={<ClinicalRoute />}>
            <Route path="/pacientes" element={<div>Pacientes Clinicos</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Cargando permisos...')).toBeInTheDocument();
  });

  it.each(['/pacientes', '/agenda', '/brigadas'])(
    'superadmin no abre %s por URL directa y vuelve a plataforma',
    (path) => {
      renderGuard({ uid: 'root', rol: 'superadmin' }, path);

      expect(screen.getByText('Plataforma')).toBeInTheDocument();
      expect(screen.queryByText(/Clinica|Clinicos/i)).not.toBeInTheDocument();
    },
  );

  it('admin_entidad no abre rutas clinicas operativas por URL directa', () => {
    renderGuard({ uid: 'admin', rol: 'admin_entidad', orgId: 'ent_1' }, '/pacientes/nuevo');

    expect(screen.getByText('Vista Entidad')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo Paciente')).not.toBeInTheDocument();
  });

  it('asistente legacy no abre rutas clinicas operativas', () => {
    renderGuard({ uid: 'asis', rol: 'asistente', orgId: 'org_1' }, '/pacientes/p1/consultas/c1');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Detalle Consulta')).not.toBeInTheDocument();
  });

  it('veterinario abre flujo clinico', () => {
    renderGuard({ uid: 'vet', rol: 'vet', orgId: 'org_1' }, '/pacientes/p1/consultas/nueva');

    expect(screen.getByText('Nueva Consulta')).toBeInTheDocument();
  });

  it('admin_veterinaria con veterinariaId abre flujo clinico de su sede', () => {
    renderGuard(
      { uid: 'adminVet', role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetclin_1' },
      '/agenda',
    );

    expect(screen.getByText('Agenda Clinica')).toBeInTheDocument();
  });

  it('admin_veterinaria sin veterinariaId queda bloqueado hasta tener scope real', () => {
    renderGuard({ uid: 'adminVet', role: 'admin_veterinaria', rol: 'admin' }, '/pacientes');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Pacientes Clinicos')).not.toBeInTheDocument();
  });
});
