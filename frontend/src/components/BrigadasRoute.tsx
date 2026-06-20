import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/tenant/hooks';
import { canAccessBrigadas, getDeniedRedirectPath } from '../lib/roleNavigation';
import RouteLoadingSpinner from './RouteLoadingSpinner';

const BrigadasRoute: React.FC = () => {
  const { data, isLoading } = useMe();
  if (isLoading) return <RouteLoadingSpinner />;
  if (canAccessBrigadas(data ?? null)) {
    return <Outlet />;
  }
  return <Navigate to={getDeniedRedirectPath(data ?? null)} replace />;
};

export default BrigadasRoute;
export { BrigadasRoute };
