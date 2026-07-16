import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import videoCarga from '../assets/video-carga.mp4';

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <video
            src={videoCarga}
            autoPlay
            loop
            muted
            playsInline
            className="h-40 w-40 rounded-2xl object-cover sm:h-48 sm:w-48"
          />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando sesión...</p>
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
