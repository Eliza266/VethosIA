import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotificaciones } from '../features/notificaciones/hooks';
import { etiquetaNotificacion, rutaNotificacion } from '../features/notificaciones/routing';
import { Card } from './ui/Primitives';

const PANEL_Z = 9990;
const BACKDROP_Z = 9989;

// Centro de notificaciones in-app: campana con contador de no leídas + panel en portal fijo.
const NotificationBell: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data, noLeidas, marcarLeida, marcarTodas } = useNotificaciones();

  useEffect(() => {
    setAbierto(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!abierto || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 32);
      const left = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left,
        width,
        maxWidth: 'calc(100vw - 2rem)',
        zIndex: PANEL_Z,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const abrirNotificacion = (n: NonNullable<typeof data>[number]) => {
    const ruta = rutaNotificacion(n);
    if (!n.leida) marcarLeida.mutate(n.id);
    if (ruta) {
      setAbierto(false);
      navigate(ruta);
    }
  };

  const panel = abierto
    ? createPortal(
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            data-testid="notification-backdrop"
            onClick={() => setAbierto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: BACKDROP_Z,
              background: 'transparent',
              border: 'none',
              cursor: 'default',
            }}
          />
          <div data-testid="notification-panel" style={panelStyle}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Notificaciones</div>
                {noLeidas > 0 && (
                  <button
                    type="button"
                    onClick={() => marcarTodas.mutate()}
                    disabled={marcarTodas.isPending}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Marcar todas
                  </button>
                )}
              </div>
              {(data ?? []).length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>Sin notificaciones.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 'min(60vh, 360px)', overflowY: 'auto' }}>
                  {(data ?? []).slice(0, 4).map((n) => (
                    <li
                      key={n.id}
                      onClick={() => abrirNotificacion(n)}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: n.leida ? 'transparent' : 'var(--surface-2)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {etiquetaNotificacion(n.tipo, n.resourceType)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{n.titulo}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{n.cuerpo}</div>
                      {!rutaNotificacion(n) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                          Recurso no disponible
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/notificaciones"
                onClick={() => setAbierto(false)}
                style={{
                  display: 'inline-flex',
                  marginTop: 10,
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {(data ?? []).length > 4
                  ? `Ver las ${(data ?? []).length} en el centro de notificaciones`
                  : 'Ver centro de notificaciones'}
              </Link>
            </Card>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        aria-label={`Notificaciones (${noLeidas} sin leer)`}
        title={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <Bell className="h-5 w-5" />
        {noLeidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 10,
              padding: '0 5px',
            }}
          >
            {noLeidas}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
};

export default NotificationBell;
export { NotificationBell };
