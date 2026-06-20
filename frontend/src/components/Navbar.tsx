import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { displayUserLabel } from '../lib/displayUser';
import { getNavbarItemsForProfile } from '../lib/roleNavigation';
import { rolLabel } from '../lib/rbac';
import type { NavIcon } from '../lib/rbac';
import type { MeProfile } from '../features/tenant/api';
import NotificationBell from './NotificationBell';
import {
  LogOut,
  User,
  Menu,
  X,
  PlusCircle,
  LayoutDashboard,
  Users,
  Calendar,
  Syringe,
  Activity,
  Building2,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV_ICON: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  pacientes: Users,
  agenda: Calendar,
  vacunas: Syringe,
  brigadas: Activity,
  nuevo: PlusCircle,
  entidad: Building2,
  veterinaria: Building2,
  suscripcion: CreditCard,
  soporte: ShieldCheck,
};

/** Perfil del header: una sola fuente (/v1/me) para evitar mezclar nombre stale con rol nuevo. */
function NavbarUserProfile({
  me,
  loading,
  onNavigatePerfil,
  avatarClassName = 'h-9 w-9',
  iconClassName = 'h-4 w-4',
  profileClassName = 'min-w-0 max-w-[12rem] lg:max-w-[14rem] xl:max-w-[16rem] 2xl:max-w-[18rem]',
  detailsClassName = 'hidden min-w-0 flex-col lg:flex',
  nameClassName = 'block truncate text-sm font-semibold leading-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]',
  metaClassName = 'mt-0.5 block truncate text-xs text-slate-500',
  orgClassName = 'mt-0.5 hidden truncate text-xs text-slate-400 2xl:block',
}: {
  me: MeProfile | undefined;
  loading: boolean;
  onNavigatePerfil: () => void;
  avatarClassName?: string;
  iconClassName?: string;
  profileClassName?: string;
  detailsClassName?: string;
  nameClassName?: string;
  metaClassName?: string;
  orgClassName?: string;
}) {
  if (loading) {
    return (
      <div className={`flex items-center gap-2 overflow-hidden ${profileClassName}`} data-testid="navbar-user-profile-loading">
        <div className={`flex ${avatarClassName} items-center justify-center rounded-full bg-slate-100 animate-pulse`} />
        <div className={`gap-1 ${detailsClassName}`}>
          <span className={`${nameClassName} text-slate-400`}>Cargando perfil…</span>
        </div>
      </div>
    );
  }

  if (!me) return null;

  const label = displayUserLabel({ nombre: me.nombre, email: me.email });
  const rol = me.role ?? me.rol;
  const orgLine = me.organizacionNombre?.trim() || null;

  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 overflow-hidden ${profileClassName}`}
      onClick={onNavigatePerfil}
      title={`${label} - ${rolLabel(rol)}${orgLine ? ` - ${orgLine}` : ''}`}
      data-testid="navbar-user-profile"
    >
      {me.foto ? (
        <img
          src={me.foto}
          alt={label}
          className={`${avatarClassName} shrink-0 rounded-full object-cover ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-all group-hover:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`flex ${avatarClassName} shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-200`}
        >
          <User className={iconClassName} />
        </div>
      )}
      <div className={detailsClassName} data-testid="navbar-user-details">
        <span className={nameClassName}>{label}</span>
        <span className={metaClassName}>{rolLabel(rol)}</span>
        {orgLine ? <span className={orgClassName}>{orgLine}</span> : null}
      </div>
    </div>
  );
}

const Navbar: React.FC = () => {
  const { firebaseUser, logout } = useAuth();
  const { data: me, isLoading: meLoading, isFetching } = useMe();
  const sessionMe = me?.uid === firebaseUser?.uid ? me : undefined;
  const profileLoading = !!firebaseUser && !sessionMe && (meLoading || isFetching);
  const navItems = getNavbarItemsForProfile(sessionMe ?? null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isNavActive = (path: string) =>
    path === '/' ? isActive('/') : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const showSession = !!firebaseUser;

  return (
    <nav className="command-nav sticky top-0 z-[100]">
      <div className="mx-auto max-w-[1920px] px-3 py-2 sm:px-5 lg:px-7">
        <div className="flex min-h-16 min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6 xl:gap-8">
            <Link to="/" className="group flex shrink-0 items-center gap-3">
              <span className="brand-orb flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-black text-white transition-transform group-hover:scale-[1.03]">
                V
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-lg font-black leading-none tracking-tight text-[var(--ink)]">
                  Vethos<span className="text-[var(--accent)]"> AI</span>
                </span>
                <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Clinical Command
                </span>
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            {showSession && (
              <div className="nav-rail hidden min-w-0 flex-1 items-center gap-1 overflow-hidden lg:flex">
                {navItems.map((item) => {
                  const Icon = NAV_ICON[item.icon];
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      aria-label={item.label}
                      title={item.label}
                      className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-all 2xl:max-w-[10rem] 2xl:px-3.5 ${
                        isNavActive(item.path)
                          ? 'nav-pill-active'
                          : 'text-slate-600 hover:bg-white/80 hover:text-[var(--ink)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="hidden min-w-0 truncate 2xl:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* User profile / actions */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {showSession ? (
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-2.5 py-1.5 shadow-[0_18px_40px_-34px_rgba(7,17,31,0.7)] backdrop-blur-xl lg:gap-3">
                <NotificationBell />
                <NavbarUserProfile
                  me={sessionMe}
                  loading={profileLoading}
                  onNavigatePerfil={() => navigate('/perfil')}
                />
                
                <button
                  onClick={handleLogout}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-accent)] transition-all hover:brightness-95"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          {/* Mobile: notificaciones + menú */}
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            {showSession && <NotificationBell />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-2xl border border-white/80 bg-white/70 p-2 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-700"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && showSession && (
        <div className="mx-3 mb-3 space-y-1 rounded-3xl border border-white/80 bg-white/95 px-4 py-4 shadow-[0_24px_60px_-40px_rgba(7,17,31,0.72)] backdrop-blur-xl lg:hidden">
          {navItems.map((item) => {
            const Icon = NAV_ICON[item.icon];
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold ${
                  isNavActive(item.path)
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-slate-50'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-3 border-t border-slate-100 pt-4">
            <div className="px-3 py-2" onClick={() => { setIsOpen(false); navigate('/perfil'); }}>
              <NavbarUserProfile
                me={sessionMe}
                loading={profileLoading}
                onNavigatePerfil={() => { setIsOpen(false); navigate('/perfil'); }}
                avatarClassName="h-10 w-10"
                iconClassName="h-5 w-5"
                profileClassName="w-full max-w-full"
                detailsClassName="flex min-w-0 flex-col"
                nameClassName="block truncate text-sm font-semibold text-slate-800"
                metaClassName="block truncate text-xs text-slate-500"
                orgClassName="mt-0.5 block truncate text-xs text-slate-400"
              />
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 mt-2 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
export { Navbar };
