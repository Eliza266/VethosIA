import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { useAdminVetMode } from '../hooks/useAdminVetMode';
import { normalizarRol, rolLabel } from '../lib/rbac';
import RouteLoadingSpinner from '../components/RouteLoadingSpinner';
import { EmptyState, PageHeader } from '../components/ui/Primitives';
import VeterinarioCommandCenter from './dashboards/VeterinarioCommandCenter';
import AdminVeterinariaCommandCenter from './dashboards/AdminVeterinariaCommandCenter';
import AdminEntidadCommandCenter from './dashboards/AdminEntidadCommandCenter';


const DashboardFallback: React.FC<{ rol?: string | null }> = ({ rol }) => (
  <div className="space-y-6 animate-fade-in" data-testid="dashboard-fallback">
    <PageHeader
      badge={`Centro operativo · ${rolLabel(rol as never)}`}
      title="Rol sin centro operativo habilitado"
      description="Tu sesión está activa, pero este rol no tiene módulos V2 publicados. La navegación queda cerrada para evitar pantallas vacías."
    />
    <EmptyState
      titulo="Sin módulos disponibles"
      mensaje="Solicita a soporte plataforma una membresia V2 valida para continuar."
    />
  </div>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();
  const { mode } = useAdminVetMode();

  if (meLoading) {
    return <RouteLoadingSpinner message="Cargando panel..." />;
  }

  const rolCanonico = normalizarRol(me?.role ?? me?.rol ?? null);

  switch (rolCanonico) {
    case 'veterinario':
      return <VeterinarioCommandCenter me={me ?? undefined} user={user} />;
    case 'admin_veterinaria':
      if (mode === 'veterinario') {
        return <VeterinarioCommandCenter me={me ?? undefined} user={user} />;
      }
      return <AdminVeterinariaCommandCenter me={me ?? undefined} />;
    case 'admin_entidad':
      return <AdminEntidadCommandCenter me={me ?? undefined} />;
    case 'superadmin':
      return <Navigate to="/admin" replace />;
    default:
      return <DashboardFallback rol={me?.role ?? me?.rol ?? null} />;
  }
};

export default Dashboard;
export { Dashboard };
