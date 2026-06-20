import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { filtrarComandos, COMANDOS_BASE } from '../lib/commands';
import { Card } from './ui/Primitives';

// Command palette (Cmd/Ctrl+K): navegacion y acciones rapidas, teclado-first (nivel Notion).
const CommandPalette: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resultados = useMemo(() => filtrarComandos(COMANDOS_BASE, q), [q]);
  if (!abierto) return null;

  const ir = (ruta?: string) => {
    setAbierto(false);
    setQ('');
    if (ruta) navigate(ruta);
  };

  return (
    <div
      role="dialog"
      aria-label="Paleta de comandos"
      onClick={() => setAbierto(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 100,
      }}
    >
      <div style={{ width: 'min(560px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <Card>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar o ejecutar una acción..."
            aria-label="Buscar comando"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 16,
              marginBottom: 12,
            }}
          />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {resultados.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => ir(c.ruta)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  {c.titulo}
                </button>
              </li>
            ))}
            {resultados.length === 0 && (
              <li style={{ color: 'var(--muted)', padding: 8 }}>Sin resultados</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default CommandPalette;
export { CommandPalette };
