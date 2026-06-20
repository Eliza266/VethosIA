import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/tenant/hooks';
import { canAccessClinicalRoutes, getDeniedRedirectPath } from '../lib/roleNavigation';
import RouteLoadingSpinner from './RouteLoadingSpinner';

const ClinicalRoute: React.FC = () => {
  const { data, isLoading } = useMe();
  if (isLoading) {
    return <RouteLoadingSpinner />;
  }
  if (!canAccessClinicalRoutes(data ?? null)) {
    return <Navigate to={getDeniedRedirectPath(data ?? null)} replace />;
  }
  return <Outlet />;
};

export default ClinicalRoute;
export { ClinicalRoute };
