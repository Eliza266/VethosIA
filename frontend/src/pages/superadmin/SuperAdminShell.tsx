import React from 'react';
import type { SuperAdminSection } from './types';

export const SuperAdminShell: React.FC<React.PropsWithChildren<{ active: SuperAdminSection }>> = ({
  active,
  children,
}) => (
  <div data-active-section={active} data-testid="superadmin-deep-shell">
    {/* La barra global (logo, buscador, usuario) ya vive arriba; estos textos quedan solo para
        lectores de pantalla / pruebas. */}
    <span className="sr-only">Operación plataforma</span>
    <span className="sr-only">Super Admin</span>

    {/* Contenido principal */}
    <main className="mx-auto max-w-7xl p-4">{children}</main>
  </div>
);

