import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import CommandPalette from './CommandPalette';
import OfflineIndicator from './OfflineIndicator';
import { useAuth } from '../hooks/useAuth';
import { useInactivityLogout } from '../hooks/useInactivityLogout';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  useInactivityLogout(() => void logout(), { enabled: !!user });

  return (
    <div className="flex min-h-screen flex-col veth-page-shell">
      <CommandPalette />
      <OfflineIndicator />
      <Navbar />
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {children || <Outlet />}
      </main>
      <footer className="border-t border-white/70 bg-white/60 py-6 text-center text-xs text-[var(--muted)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <div>
            &copy; {new Date().getFullYear()}{' '}
            <span className="font-semibold text-[var(--text-secondary)]">Vethos AI</span> · Clinical Command Center
          </div>
          <div className="flex gap-4">
            <Link to="/como-funciona" className="transition-colors hover:text-[var(--text-secondary)]">
              Ayuda
            </Link>
            <span className="text-[var(--border-strong)]" aria-hidden="true">
              ·
            </span>
            <Link to="/como-funciona" className="transition-colors hover:text-[var(--text-secondary)]">
              Privacidad y datos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
export { Layout };
