import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/tenant/hooks';
import { puedeVerSuscripcion } from '../lib/rbac';

const SubscriptionRoute: React.FC = () => {
  const { data, isLoading } = useMe();
  if (isLoading) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>Cargando permisos...</div>;
  }
  if (!puedeVerSuscripcion(data ?? null)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default SubscriptionRoute;
export { SubscriptionRoute };
