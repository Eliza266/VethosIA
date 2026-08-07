import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { miSuscripcion } from '../features/saas/api';
import TrialVencidoOverlay from './TrialVencidoOverlay';
import videoCarga from '../assets/video-carga.mp4';

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const sub = useQuery({
    queryKey: ['suscripcion-me'],
    queryFn: miSuscripcion,
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-slate-950">
        <video
          src={videoCarga}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-10 pt-16 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-sm font-medium text-white/90 animate-pulse">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (sub.data?.suscripcion?.estado === 'bloqueado_fin_trial') {
    return <TrialVencidoOverlay />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
export { ProtectedRoute };
