import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactElement } from 'react';

// QA multi-tenant / RBAC en la capa de routing del cliente.
// El aislamiento por organizacion (no leer datos de otra org) se valida en el
// backend (Admin SDK + common/auth/access.ts, 453 tests). Aqui verificamos que
// los guards de ruta del cliente NIEGAN el acceso por rol/capacidad y redirigen
// al home correcto, de modo que un usuario no pueda montar pantallas que no le
// corresponden ni siquiera en el navegador.

interface MeShape {
  rol?: string;
  role?: string;
  orgId?: string | null;
  veterinariaId?: string | null;
  entidadId?: string | null;
  accountType?: string | null;
  planOwnerType?: string | null;
  planOwnerId?: string | null;
}

let meData: MeShape | null = null;
let meLoading = false;

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => ({ data: meData, isLoading: meLoading }),
}));

import RoleRoute from './RoleRoute';
import ClinicalRoute from './ClinicalRoute';
import SubscriptionRoute from './SubscriptionRoute';

const PROTEGIDO = 'CONTENIDO_PROTEGIDO';

function renderGuard(guard: ReactElement, initialPath = '/protegido') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={guard}>
          <Route path="/protegido" element={<div>{PROTEGIDO}</div>} />
          <Route path="/pacientes" element={<div>{PROTEGIDO}</div>} />
        </Route>
        <Route path="/" element={<div>HOME_DASHBOARD</div>} />
        <Route path="/admin" element={<div>SOPORTE_PLATAFORMA</div>} />
        <Route path="/entidad" element={<div>VISTA_ENTIDAD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  meData = null;
  meLoading = false;
});

describe('RoleRoute (guard por capacidad)', () => {
  it('permite a superadmin entrar a una ruta de soporte plataforma', () => {
    meData = { rol: 'superadmin' };
    renderGuard(<RoleRoute min="superadmin" />);
    expect(screen.getByText(PROTEGIDO)).toBeInTheDocument();
  });

  it('niega a un veterinario de un tenant el acceso a soporte plataforma y lo manda a /', () => {
    meData = { rol: 'vet', orgId: 'orgA', veterinariaId: 'vetA' };
    renderGuard(<RoleRoute min="superadmin" />);
    expect(screen.queryByText(PROTEGIDO)).not.toBeInTheDocument();
    expect(screen.getByText('HOME_DASHBOARD')).toBeInTheDocument();
  });

  it('niega a admin_veterinaria la vista de entidad (capacidad de admin_entidad)', () => {
    meData = { rol: 'admin_veterinaria', orgId: 'orgA', veterinariaId: 'vetA' };
    renderGuard(<RoleRoute min="admin_entidad" />);
    expect(screen.queryByText(PROTEGIDO)).not.toBeInTheDocument();
  });
});

describe('ClinicalRoute (rutas clinicas de tenant)', () => {
  it('permite a un veterinario vinculado operar pacientes', () => {
    meData = { rol: 'vet', orgId: 'orgA', veterinariaId: 'vetA' };
    renderGuard(<ClinicalRoute />, '/pacientes');
    expect(screen.getByText(PROTEGIDO)).toBeInTheDocument();
  });

  it('niega a admin_entidad las rutas clinicas y lo redirige a /entidad', () => {
    meData = { rol: 'admin_entidad', orgId: 'orgA', entidadId: 'orgA' };
    renderGuard(<ClinicalRoute />, '/pacientes');
    expect(screen.queryByText(PROTEGIDO)).not.toBeInTheDocument();
    expect(screen.getByText('VISTA_ENTIDAD')).toBeInTheDocument();
  });

  it('niega a superadmin las rutas clinicas y lo redirige a /admin', () => {
    meData = { rol: 'superadmin' };
    renderGuard(<ClinicalRoute />, '/pacientes');
    expect(screen.queryByText(PROTEGIDO)).not.toBeInTheDocument();
    expect(screen.getByText('SOPORTE_PLATAFORMA')).toBeInTheDocument();
  });
});

describe('SubscriptionRoute (gestion de plan)', () => {
  it('permite a admin_entidad ver la suscripcion', () => {
    meData = { rol: 'admin_entidad', orgId: 'orgA', entidadId: 'orgA' };
    renderGuard(<SubscriptionRoute />);
    expect(screen.getByText(PROTEGIDO)).toBeInTheDocument();
  });

  it('permite a un veterinario vinculado (no dueno de plan) ver la suscripcion en modo lectura', () => {
    meData = { rol: 'vet', orgId: 'orgA', veterinariaId: 'vetA' };
    renderGuard(<SubscriptionRoute />);
    expect(screen.getByText(PROTEGIDO)).toBeInTheDocument();
  });
});

describe('Estado de carga de permisos', () => {
  it('no filtra contenido protegido mientras se resuelve el perfil', () => {
    meLoading = true;
    meData = null;
    renderGuard(<ClinicalRoute />, '/pacientes');
    expect(screen.queryByText(PROTEGIDO)).not.toBeInTheDocument();
  });
});
