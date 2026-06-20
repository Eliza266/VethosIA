import React from 'react';
import { usePwa } from '../hooks/usePwa';

// Indicador de offline + boton de instalacion ("Agregar a inicio"). Parte de la PWA.
const OfflineIndicator: React.FC = () => {
  const { online, instalable, promptInstall } = usePwa();
  if (online && !instalable) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        boxShadow: 'var(--shadow)',
        padding: '8px 16px',
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      {!online && <span style={{ color: 'var(--warn)' }}>Sin conexión — trabajando offline</span>}
      {instalable && (
        <button
          onClick={() => void promptInstall()}
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: 'none',
            borderRadius: 999,
            padding: '4px 12px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Instalar app
        </button>
      )}
    </div>
  );
};

export default OfflineIndicator;
export { OfflineIndicator };
