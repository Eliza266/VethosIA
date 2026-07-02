import React from 'react';

/**
 * Interruptor Administración / Veterinario para el dueño-veterinario (admin_veterinaria).
 * Vive en su propio archivo para poder usarse desde el layout real (Sidebar) y no
 * depender de componentes no montados.
 */
const ModeToggle: React.FC<{
  mode: 'admin' | 'veterinario';
  onChange: (mode: 'admin' | 'veterinario') => void;
  className?: string;
}> = ({ mode, onChange, className = '' }) => {
  return (
    <div
      className={`inline-flex rounded-full bg-slate-100 p-0.5 border border-slate-200/50 ${className}`}
      data-testid="admin-vet-mode-toggle"
      role="group"
      aria-label="Cambiar de panel"
    >
      <button
        type="button"
        onClick={() => onChange('admin')}
        aria-pressed={mode === 'admin'}
        className={`flex-1 rounded-full px-3 py-1 text-xs font-bold transition-all ${
          mode === 'admin'
            ? 'bg-accent text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        data-testid="mode-toggle-admin"
      >
        Administración
      </button>
      <button
        type="button"
        onClick={() => onChange('veterinario')}
        aria-pressed={mode === 'veterinario'}
        className={`flex-1 rounded-full px-3 py-1 text-xs font-bold transition-all ${
          mode === 'veterinario'
            ? 'bg-accent text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        data-testid="mode-toggle-vet"
      >
        Veterinario
      </button>
    </div>
  );
};

export default ModeToggle;
export { ModeToggle };
