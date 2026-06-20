import React from 'react';

/** Spinner compartido para guards de ruta mientras /v1/me resuelve permisos. */
const RouteLoadingSpinner: React.FC<{ message?: string }> = ({
  message = 'Cargando permisos...',
}) => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent" />
      <p className="text-sm font-semibold text-slate-500">{message}</p>
    </div>
  </div>
);

export default RouteLoadingSpinner;
export { RouteLoadingSpinner };
