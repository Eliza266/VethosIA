import React, { createContext, useContext, useState } from 'react';
import { useMe } from '../features/tenant/hooks';
import { normalizarRol } from '../lib/rbac';

export type AdminVetMode = 'admin' | 'veterinario';

interface AdminVetModeContextType {
  mode: AdminVetMode;
  setMode: (mode: AdminVetMode) => void;
  isAdminVet: boolean;
}

const AdminVetModeContext = createContext<AdminVetModeContextType | undefined>(undefined);

export const AdminVetModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: me } = useMe();
  const isAdminVet = normalizarRol(me?.role ?? me?.rol) === 'admin_veterinaria';

  const [mode, setModeState] = useState<AdminVetMode>(() => {
    const saved = localStorage.getItem('vethos_admin_vet_mode');
    return saved === 'veterinario' ? 'veterinario' : 'admin';
  });

  const setMode = (newMode: AdminVetMode) => {
    setModeState(newMode);
    localStorage.setItem('vethos_admin_vet_mode', newMode);
  };

  return (
    <AdminVetModeContext.Provider value={{ mode: isAdminVet ? mode : 'admin', setMode, isAdminVet }}>
      {children}
    </AdminVetModeContext.Provider>
  );
};

export function useAdminVetMode() {
  const context = useContext(AdminVetModeContext);
  if (!context) {
    return {
      mode: 'admin' as const,
      setMode: () => {},
      isAdminVet: false,
    };
  }
  return context;
}
