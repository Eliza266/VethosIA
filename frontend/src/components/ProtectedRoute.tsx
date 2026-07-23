import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import videoCarga from '../assets/video-carga.mp4';

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

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

  return <Outlet />;
};

export default ProtectedRoute;
export { ProtectedRoute };
