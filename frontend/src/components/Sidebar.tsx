import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, PanelLeftClose, PlusCircle, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { displayUserLabel } from '../lib/displayUser';
import { getNavbarItemsForProfile } from '../lib/roleNavigation';
import { rolLabel } from '../lib/rbac';
import type { NavIcon } from '../lib/rbac';
import { NAV_ICON, SUPERADMIN_ITEMS, getSuperAdminActiveSection, getSpeciesEmoji } from '../lib/navModel';
import { VET_NAVIGATION } from '../config/navigation';
import { SidebarItem } from './ui/SidebarItem';
import NotificationBell from './NotificationBell';

declare global {
  interface Window {
    __currentPaciente?: { nombre: string; especie: string } | null;
  }
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  /** true cuando se renderiza dentro del drawer móvil (nunca colapsado). */
  mobile?: boolean;
}

const PATIENT_TABS = [
  { label: 'Perfil', val: 'perfil' },
  { label: 'Vacunas', val: 'vacunas' },
  { label: 'Consultas', val: 'consultas' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggleCollapse, onNavigate, mobile = false }) => {
  const { firebaseUser, logout } = useAuth();
  const { data: me, isLoading: meLoading, isFetching } = useMe();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionMe = me?.uid === firebaseUser?.uid ? me : undefined;
  const profileLoading = !!firebaseUser && !sessionMe && (meLoading || isFetching);
  const meRole = sessionMe?.role ?? sessionMe?.rol;
  const isSuperadmin = meRole === 'superadmin';
  const isVet = meRole === 'vet' || meRole === 'veterinario';

  const [currentPaciente, setCurrentPaciente] = React.useState<{ nombre: string; especie: string } | null>(
    () => (typeof window !== 'undefined' ? window.__currentPaciente ?? null : null),
  );

  React.useEffect(() => {
    const handler = () => setCurrentPaciente(window.__currentPaciente || null);
    window.addEventListener('current-paciente-changed', handler);
    return () => window.removeEventListener('current-paciente-changed', handler);
  }, []);

  const activeSection = getSuperAdminActiveSection(location.pathname, location.search);

  // Items de nivel 1 (reusa RBAC). Para superadmin, secciones de plataforma.
  const rawItems = isSuperadmin ? null : getNavbarItemsForProfile(sessionMe ?? null);

  // CTA primaria: el item "nuevo" si existe (p. ej. Nuevo paciente para vets).
  const ctaItem = rawItems?.find((i) => i.icon === 'nuevo') ?? null;
  const navItems = rawItems?.filter((i) => i.icon !== 'nuevo') ?? [];

  const matchPatient = location.pathname.match(/^\/pacientes\/([^/]+)/);
  const isLevel3 = isVet && matchPatient && matchPatient[1] !== 'nuevo';
  const patientId = isLevel3 ? matchPatient![1] : null;
  const activeModule = isVet
    ? VET_NAVIGATION.find((m) => m.path !== '/' && location.pathname.startsWith(m.path))
    : null;
  const isLevel2 = isVet && !isLevel3 && !!activeModule && activeModule.subModules.length > 0;

  const handleLogout = async () => {
    try {
      onNavigate?.();
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const showCollapsed = collapsed && !mobile;
  const label = sessionMe ? displayUserLabel({ nombre: sessionMe.nombre, email: sessionMe.email }) : '';
  const rol = sessionMe?.role ?? sessionMe?.rol;
  const orgLine = sessionMe?.organizacionNombre?.trim() || null;

  const isItemActive = (item: { id: string; path: string }): boolean => {
    if (isSuperadmin) return activeSection === item.id;
    if (item.path === '/') return location.pathname === '/';
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{
        width: showCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        borderRight: mobile ? 'none' : '1px solid var(--sidebar-border)',
        transition: 'width var(--transition-base)',
      }}
    >
      {/* Header: marca + colapsar */}
      <div className="flex items-center gap-2 px-3" style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2" aria-label="Vethos AI, inicio">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{ background: 'var(--accent)' }}
          >
            V
          </span>
          {!showCollapsed && (
            <span className="truncate text-base font-black tracking-tight" style={{ color: 'var(--text)' }}>
              Vethos<span style={{ color: 'var(--accent)' }}> AI</span>
            </span>
          )}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {sessionMe && !showCollapsed && <NotificationBell />}
          {!mobile && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className="hidden h-8 w-8 items-center justify-center rounded-lg lg:flex"
              style={{ color: 'var(--muted)' }}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* CTA primaria */}
      {ctaItem && (
        <div className="px-3 pt-3">
          <Link
            to={ctaItem.path}
            onClick={onNavigate}
            title={showCollapsed ? ctaItem.label : undefined}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            {!showCollapsed && <span className="truncate">{ctaItem.label}</span>}
          </Link>
        </div>
      )}

      {/* Navegación principal */}
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {isSuperadmin
            ? SUPERADMIN_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <SidebarItem
                      to={item.path}
                      label={item.label}
                      icon={<Icon className="h-[18px] w-[18px]" />}
                      active={activeSection === item.id}
                      collapsed={showCollapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                );
              })
            : navItems.map((item) => {
                const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
                return (
                  <li key={item.id}>
                    <SidebarItem
                      to={item.path}
                      label={item.label}
                      icon={Icon ? <Icon className="h-[18px] w-[18px]" /> : undefined}
                      active={isItemActive(item)}
                      collapsed={showCollapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                );
              })}
        </ul>

        {/* Navegación contextual del veterinario (niveles 2/3) */}
        {!showCollapsed && isLevel3 && (
          <div className="mt-4 rounded-xl border p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold" style={{ color: 'var(--accent-strong)' }}>
              <span>{getSpeciesEmoji(currentPaciente?.especie)}</span>
              <span className="truncate">{currentPaciente?.nombre || 'Expediente'}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {PATIENT_TABS.map((tab) => {
                const active = (new URLSearchParams(location.search).get('tab') || 'perfil') === tab.val;
                return (
                  <Link
                    key={tab.val}
                    to={`/pacientes/${patientId}?tab=${tab.val}`}
                    onClick={onNavigate}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'veth-sidebar-item-active' : 'veth-sidebar-item'}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {!showCollapsed && isLevel2 && activeModule && (
          <div className="mt-4 rounded-xl border p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              {activeModule.label}
            </div>
            <div className="mt-1 space-y-0.5">
              {activeModule.subModules.map((sub) => {
                const active = (new URLSearchParams(location.search).get('tab') || activeModule.subModules[0].tabValue) === sub.tabValue;
                return (
                  <Link
                    key={sub.id}
                    to={`${activeModule.path}?tab=${sub.tabValue}`}
                    onClick={onNavigate}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'veth-sidebar-item-active' : 'veth-sidebar-item'}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {sub.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: perfil + logout */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        {profileLoading ? (
          <div className="flex items-center gap-2" data-testid="sidebar-user-loading">
            <div className="h-9 w-9 animate-pulse rounded-full" style={{ background: 'var(--neutral-100)' }} />
            {!showCollapsed && <span className="text-sm" style={{ color: 'var(--muted)' }}>Cargando perfil…</span>}
          </div>
        ) : sessionMe ? (
          <div className={showCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2'}>
            <NavLink
              to="/perfil"
              onClick={onNavigate}
              data-testid="sidebar-user-profile"
              title={`${label} · ${rolLabel(rol)}${orgLine ? ` · ${orgLine}` : ''}`}
              aria-label={`Perfil de ${label}`}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-[var(--sidebar-item-hover-bg)]"
            >
              {sessionMe.foto ? (
                <img src={sessionMe.foto} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--neutral-100)', color: 'var(--text-secondary)' }}>
                  <User className="h-4 w-4" />
                </span>
              )}
              {!showCollapsed && (
                <span className="flex min-w-0 flex-col" data-testid="sidebar-user-details">
                  <span className="truncate text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
                  <span className="truncate text-xs" style={{ color: 'var(--muted)' }}>{rolLabel(rol)}</span>
                  {orgLine && <span className="truncate text-xs" style={{ color: 'var(--muted)' }}>{orgLine}</span>}
                </span>
              )}
            </NavLink>
            {showCollapsed && <NotificationBell />}
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {showCollapsed ? <ChevronLeft className="h-4 w-4" /> : 'Iniciar sesión'}
          </Link>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
