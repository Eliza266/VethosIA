import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import OfflineIndicator from './OfflineIndicator';
import NotificationBell from './NotificationBell';
import TourHelpButton from './TourHelpButton';
import WelcomeInstallModal from './WelcomeInstallModal';
import TrialBanner from './TrialBanner';
import { useAuth } from '../hooks/useAuth';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { ActiveTourProvider } from './ActiveTourProvider';
import { useActiveTour } from '../hooks/useActiveTour';

interface LayoutProps {
  children?: React.ReactNode;
}

const COLLAPSE_KEY = 'veth-sidebar-collapsed';

const Layout: React.FC<LayoutProps> = (props) => (
  <ActiveTourProvider>
    <LayoutContent {...props} />
  </ActiveTourProvider>
);

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { replay: tourReplay } = useActiveTour();
  useInactivityLogout(() => void logout(), { enabled: !!user });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* almacenamiento no disponible */
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="flex min-h-screen flex-col">
      <TrialBanner />
      <div className="flex flex-1 veth-page-shell">
        <CommandPalette />
        <OfflineIndicator />
        <WelcomeInstallModal />

        {/* Sidebar fija (desktop) */}
        <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </aside>

        {/* Drawer móvil */}
        {mobileOpen && (
          <div
            role="presentation"
            onClick={closeMobile}
            className="fixed inset-0 z-[200] lg:hidden"
            style={{ background: 'rgba(16, 22, 19, 0.45)' }}
          >
            <div
              ref={drawerRef}
              id="mobile-sidebar"
              onClick={(e) => e.stopPropagation()}
              className="h-full w-[var(--sidebar-width)] max-w-[82vw] animate-slide-up"
              style={{ boxShadow: 'var(--shadow-lg)' }}
            >
              <Sidebar mobile onNavigate={closeMobile} />
            </div>
          </div>
        )}

        {/* Columna de contenido */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top-bar móvil */}
          <header
            className="sticky top-0 z-[120] flex items-center gap-2 px-3 lg:hidden"
            style={{ height: 'var(--topbar-height)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menú"
              title="Abrir menú"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: 'var(--accent)' }}>
                V
              </span>
              <span className="truncate text-base font-black tracking-tight" style={{ color: 'var(--text)' }}>
                Vethos<span style={{ color: 'var(--accent)' }}> AI</span>
              </span>
            </Link>
            {user && (
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                {tourReplay && <TourHelpButton onReplay={tourReplay} />}
              </div>
            )}
          </header>

          <main className="mx-auto w-full max-w-[1900px] flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {children || <Outlet />}
          </main>

          <footer className="border-t py-5 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
              <div>
                &copy; {new Date().getFullYear()} <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Vethos AI</span>
              </div>
              <div className="flex gap-4">
                <Link to="/como-funciona" className="transition-colors hover:underline">Ayuda</Link>
                <Link to="/como-funciona" className="transition-colors hover:underline">Privacidad y datos</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Layout;
export { Layout };
