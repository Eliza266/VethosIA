import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/tenant/hooks';
import { normalizarRol } from '../lib/rbac';
import type { Rol, RolCanonico } from '../lib/rbac';
import { canAccessRoleRoute, getRoleHomePath, type RoleRouteCapability } from '../lib/roleNavigation';
import RouteLoadingSpinner from './RouteLoadingSpinner';

// Guard de ruta por rol. Superadmin es soporte/plataforma explicito, no
// fallback tenant. Legacy: admin => admin_entidad, vet => veterinario.
const NIVEL: Record<RolCanonico, number> = {
  superadmin: 4,
  admin_entidad: 3,
  admin_veterinaria: 2,
  veterinario: 1,
};

const REQUIRED_CAPABILITY_BY_MIN_ROLE: Partial<Record<RolCanonico, RoleRouteCapability>> = {
  superadmin: 'soporte',
  admin_entidad: 'entidad',
  admin_veterinaria: 'veterinarias',
};

const RoleRoute: React.FC<{ min: Rol }> = ({ min }) => {
  const { data, isLoading } = useMe();
  if (isLoading) {
    return <RouteLoadingSpinner />;
  }
  const rol = normalizarRol(data?.role ?? data?.rol ?? null);
  const minimo = normalizarRol(min);
  const requiredCapability = minimo ? REQUIRED_CAPABILITY_BY_MIN_ROLE[minimo] : undefined;
  if (!rol || !minimo) {
    return <Navigate to="/" replace />;
  }
  if (requiredCapability && !canAccessRoleRoute(data ?? null, requiredCapability)) {
    return <Navigate to={getRoleHomePath(data ?? null)} replace />;
  }
  if (!requiredCapability && NIVEL[rol] < NIVEL[minimo]) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default RoleRoute;
export { RoleRoute };
