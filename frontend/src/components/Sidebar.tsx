import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, PanelLeftClose, PlusCircle, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { useAdminVetMode } from '../hooks/useAdminVetMode';
import { displayUserLabel } from '../lib/displayUser';
import { getNavbarItemsForProfile } from '../lib/roleNavigation';
import { rolLabel } from '../lib/rbac';
import type { NavIcon } from '../lib/rbac';
import { NAV_ICON, SUPERADMIN_ITEMS, getSuperAdminActiveSection, getSpeciesEmoji } from '../lib/navModel';
import { VET_NAVIGATION, ADMIN_NAVIGATION } from '../config/navigation';
import { SidebarItem } from './ui/SidebarItem';
import NotificationBell from './NotificationBell';
import TourHelpButton from './TourHelpButton';
import ModeToggle from './ModeToggle';
import logoVethos from '../assets/logo-vethos.png';
import { useActiveTour } from '../hooks/useActiveTour';

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


export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggleCollapse, onNavigate, mobile = false }) => {
  const { firebaseUser, logout } = useAuth();
  const { data: me, isLoading: meLoading, isFetching } = useMe();
  const { mode, setMode, isAdminVet } = useAdminVetMode();
  const { replay: tourReplay } = useActiveTour();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionMe = me?.uid === firebaseUser?.uid ? me : undefined;
  const profileLoading = !!firebaseUser && !sessionMe && (meLoading || isFetching);
  const meRole = sessionMe?.role ?? sessionMe?.rol;
  const isSuperadmin = meRole === 'superadmin';
  const isVet = meRole === 'vet' || meRole === 'veterinario' || (meRole === 'admin_veterinaria' && mode === 'veterinario');

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
  const rawItems = isSuperadmin ? null : getNavbarItemsForProfile(sessionMe ?? null, mode);

  // CTA primaria: el item "nuevo" si existe (p. ej. Nuevo paciente para vets).
  const ctaItem = rawItems?.find((i) => i.icon === 'nuevo') ?? null;
  const navItems = rawItems?.filter((i) => i.icon !== 'nuevo') ?? [];

  const isAdminMode = meRole === 'admin_veterinaria' && mode === 'admin';

  const matchPatient = location.pathname.match(/^\/pacientes\/([^/]+)/);
  const isLevel3 = isVet && matchPatient && matchPatient[1] !== 'nuevo';
  const patientId = isLevel3 ? matchPatient![1] : null;
  const activeModule = isVet
    ? VET_NAVIGATION.find((m) => m.path !== '/' && location.pathname.startsWith(m.path))
    : isAdminMode
      ? ADMIN_NAVIGATION.find((m) => m.path !== '/' && location.pathname.startsWith(m.path))
      : null;
  const isLevel2 = !isLevel3 && !!activeModule && activeModule.subModules.length > 0;

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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
            <img src={logoVethos} alt="Vethos AI" className="h-8 w-8 object-contain" />
          </span>
          {!showCollapsed && (
            <span className="truncate text-base font-black tracking-tight" style={{ color: 'var(--text)' }}>
              Vethos<span style={{ color: 'var(--accent)' }}> AI</span>
            </span>
          )}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {sessionMe && !showCollapsed && <NotificationBell />}
          {sessionMe && !showCollapsed && tourReplay && <TourHelpButton onReplay={tourReplay} />}
          {!mobile && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className="hidden h-8 w-8 items-center justify-center rounded-lg lg:flex"
              style={{ color: 'var(--muted)' }}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Interruptor Administración / Veterinario (solo dueño-veterinario) */}
      {isAdminVet && !showCollapsed && (
        <div className="px-3 pt-3">
          <ModeToggle mode={mode} onChange={setMode} className="w-full" />
        </div>
      )}

      {/* CTA primaria */}
      {ctaItem && (
        <div className="px-3 pt-3">
          <Link
            to={ctaItem.path}
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
                    />
                  </li>
                );
              })
            : navItems.map((item) => {
                const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
                // Desplegable debajo del item activo (no una caja aparte): el detalle de
                // paciente (nivel 3) cuelga de "Pacientes"; los sub-modulos (nivel 2)
                // cuelgan de su propio modulo (Agenda, Vacunas, Mi veterinaria, etc.).
                const showPatientTabsHere = !showCollapsed && isLevel3 && item.id === 'pacientes';
                const showSubModulesHere = !showCollapsed && isLevel2 && activeModule?.id === item.id;
                return (
                  <li key={item.id}>
                    <SidebarItem
                      to={item.path}
                      label={item.label}
                      icon={Icon ? <Icon className="h-[18px] w-[18px]" /> : undefined}
                      active={isItemActive(item)}
                      collapsed={showCollapsed}
                    />
                    {showPatientTabsHere && (
                      <div className="mt-1 ml-4 border-l pl-2" style={{ borderColor: 'var(--border)' }}>
                        {/* El expediente del paciente ya vive todo en una sola vista (perfil,
                            consultas y vacunas juntos); esto es solo un indicador de contexto,
                            no una pestana, asi que enlaza directo al expediente. */}
                        <Link
                          to={`/pacientes/${patientId}`}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--sidebar-item-hover-bg)]"
                          style={{ color: 'var(--accent-strong)' }}
                        >
                          <span>{getSpeciesEmoji(currentPaciente?.especie)}</span>
                          <span className="truncate">{currentPaciente?.nombre || 'Expediente'}</span>
                        </Link>
                      </div>
                    )}
                    {showSubModulesHere && activeModule && (
                      <div className="mt-1 ml-4 space-y-0.5 border-l pl-2" style={{ borderColor: 'var(--border)' }}>
                        {activeModule.subModules.map((sub) => {
                          if (sub.anchor) {
                            // Admin: misma pagina, hace scroll a la seccion (no cambia de vista).
                            return (
                              <a
                                key={sub.id}
                                href={`${activeModule.path}#${sub.anchor}`}
                                className="block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors veth-sidebar-item"
                              >
                                {sub.label}
                              </a>
                            );
                          }
                          const active = (new URLSearchParams(location.search).get('tab') || activeModule.subModules[0].tabValue) === sub.tabValue;
                          return (
                            <Link
                              key={sub.id}
                              to={`${activeModule.path}?tab=${sub.tabValue}`}
                              className={`block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'veth-sidebar-item-active' : 'veth-sidebar-item'}`}
                              aria-current={active ? 'page' : undefined}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
        </ul>
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
            {showCollapsed && tourReplay && <TourHelpButton onReplay={tourReplay} />}
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
