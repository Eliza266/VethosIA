import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { displayUserLabel } from '../lib/displayUser';
import { getNavbarItemsForProfile } from '../lib/roleNavigation';
import { useAdminVetMode } from '../hooks/useAdminVetMode';
import { rolLabel } from '../lib/rbac';
import type { NavIcon } from '../lib/rbac';
import type { MeProfile } from '../features/tenant/api';
import NotificationBell from './NotificationBell';
import ModeToggle from './ModeToggle';
import { VET_NAVIGATION } from '../config/navigation';
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
  Hospital,
  FileClock,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

declare global {
  interface Window {
    __currentPaciente?: { nombre: string; especie: string } | null;
  }
}

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
  configuracion: Settings,
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
  const { mode, setMode, isAdminVet } = useAdminVetMode();
  const sessionMe = me?.uid === firebaseUser?.uid ? me : undefined;
  const profileLoading = !!firebaseUser && !sessionMe && (meLoading || isFetching);
  const meRole = sessionMe?.role ?? sessionMe?.rol;
  const isSuperadmin = meRole === 'superadmin';
  const isVet = meRole === 'vet' || meRole === 'veterinario' || (meRole === 'admin_veterinaria' && mode === 'veterinario');

  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPaciente, setCurrentPaciente] = useState<{ nombre: string; especie: string } | null>(
    () => (typeof window !== 'undefined' ? window.__currentPaciente ?? null : null),
  );

  useEffect(() => {
    const handlePacienteChange = () => {
      setCurrentPaciente(window.__currentPaciente || null);
    };
    window.addEventListener('current-paciente-changed', handlePacienteChange);
    return () => {
      window.removeEventListener('current-paciente-changed', handlePacienteChange);
    };
  }, []);

  const superAdminItems = [
    { id: 'overview', label: 'Dashboard', path: '/admin', icon: ShieldCheck },
    { id: 'entidades', label: 'Entidades', path: '/admin?panel=entidades', icon: Building2 },
    { id: 'veterinarias', label: 'Veterinarias', path: '/admin?panel=veterinarias', icon: Hospital },
    { id: 'usuarios', label: 'Usuarios', path: '/admin?panel=usuarios', icon: Users },
    { id: 'planes', label: 'Planes', path: '/planes', icon: CreditCard },
    { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones', icon: Activity },
    { id: 'pagos', label: 'Pagos', path: '/admin?panel=pagos', icon: CreditCard },
    { id: 'auditoria', label: 'Auditoría', path: '/auditoria', icon: FileClock },
    { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: Settings },
  ];

  const getSuperAdminActiveSection = () => {
    const pathname = location.pathname;
    const search = location.search;
    if (pathname === '/planes') return 'planes';
    if (pathname === '/suscripciones') return 'suscripciones';
    if (pathname === '/auditoria') return 'auditoria';
    if (pathname === '/configuracion') return 'configuracion';
    const panel = new URLSearchParams(search).get('panel');
    if (
      panel === 'entidades' ||
      panel === 'veterinarias' ||
      panel === 'usuarios' ||
      panel === 'pagos'
    ) {
      return panel;
    }
    if (pathname === '/admin' || pathname.startsWith('/admin')) {
      return 'overview';
    }
    return null;
  };
  const activeSection = getSuperAdminActiveSection();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const showSession = !!firebaseUser;

  // Modulos para otros roles
  const navItems = isSuperadmin ? superAdminItems : getNavbarItemsForProfile(sessionMe ?? null, mode);

  // Niveles para veterinario
  const matchPatient = location.pathname.match(/^\/pacientes\/([^/]+)/);
  const isLevel3 = isVet && matchPatient && matchPatient[1] !== 'nuevo';
  const patientId = isLevel3 ? matchPatient[1] : null;

  const activeModule = isVet
    ? VET_NAVIGATION.find((m) => m.path !== '/' && location.pathname.startsWith(m.path))
    : null;
  const isLevel2 = isVet && !isLevel3 && !!activeModule;

  const getSpeciesEmoji = (esp?: string) => {
    switch (esp) {
      case 'perro': return '🐶';
      case 'gato': return '🐱';
      case 'ave': return '🦜';
      case 'reptil': return '🦎';
      default: return '🐾';
    }
  };

  return (
    <nav className="command-nav sticky top-0 z-[150] w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-[1920px] px-3 py-2 sm:px-5 lg:px-7">
        <div className="flex min-h-16 items-center justify-between gap-4">
          
          {/* Left: Logo */}
          <div className="flex shrink-0 items-center">
            <Link to="/" className="group flex items-center gap-3">
              <span className="brand-orb flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-black text-white transition-transform group-hover:scale-[1.03]">
                V
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-base font-black leading-none tracking-tight text-slate-900">
                  Vethos<span className="text-accent"> AI</span>
                </span>
                <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Clinical Command
                </span>
              </span>
            </Link>
          </div>

          {/* Center: Modules (Desktop) */}
          {showSession && (
            <div className="hidden lg:flex flex-1 items-center justify-center gap-4 min-w-0 px-4">
              {isAdminVet && (
                <ModeToggle mode={mode} onChange={setMode} className="shrink-0 mr-4" />
              )}
              {isVet ? (
                isLevel3 ? (
                  /* LEVEL 3 */
                  <div className="flex items-center gap-4">
                    <Link
                      to="/pacientes"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shrink-0"
                    >
                      ← Pacientes
                    </Link>
                    <div className="h-4 w-px bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-xs font-bold shrink-0">
                      <span>{getSpeciesEmoji(currentPaciente?.especie)}</span>
                      <span>{currentPaciente?.nombre || 'Expediente'}</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'Perfil', val: 'perfil' },
                        { label: 'Vacunas', val: 'vacunas' },
                        { label: 'Consultas', val: 'consultas' },
                      ].map((tab) => {
                        const queryParams = new URLSearchParams(location.search);
                        const active = (queryParams.get('tab') || 'perfil') === tab.val;
                        return (
                          <Link
                            key={tab.val}
                            to={`/pacientes/${patientId}?tab=${tab.val}`}
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                              active
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {tab.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : isLevel2 && activeModule ? (
                  /* LEVEL 2 */
                  <div className="flex items-center gap-4">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shrink-0"
                    >
                      ← Inicio
                    </Link>
                    <div className="h-4 w-px bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-1">
                      {activeModule.subModules.map((sub) => {
                        const queryParams = new URLSearchParams(location.search);
                        const active = (queryParams.get('tab') || activeModule.subModules[0].tabValue) === sub.tabValue;
                        return (
                          <Link
                            key={sub.id}
                            to={`${activeModule.path}?tab=${sub.tabValue}`}
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                              active
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {navItems.map((item) => {
                      const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
                      const active = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                            active
                              ? 'bg-accent text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Otros roles */
                <div className="flex items-center gap-1.5">
                  {navItems.map((item) => {
                    const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
                    const active = isSuperadmin
                      ? activeSection === item.id
                      : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Right: Actions (Desktop) */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {showSession ? (
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-100 bg-slate-50/50 px-2.5 py-1.5 shadow-sm lg:gap-3">
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
                className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-accent-strong"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          {/* Mobile triggers */}
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            {showSession && <NotificationBell />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && showSession && (
        <div className="mx-3 mb-3 space-y-4 rounded-3xl border border-slate-200 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-xl lg:hidden">
          {isAdminVet && (
            <div className="flex justify-center border-b border-slate-100 pb-3" data-testid="mobile-mode-toggle-container">
              <ModeToggle mode={mode} onChange={setMode} className="w-full max-w-xs" />
            </div>
          )}
          {isVet ? (
            isLevel3 ? (
              <div className="space-y-1">
                <Link
                  to="/pacientes"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
                >
                  ← Pacientes
                </Link>
                <div className="px-3 py-2 bg-accent/10 text-accent rounded-xl text-sm font-black flex items-center gap-2">
                  <span>{getSpeciesEmoji(currentPaciente?.especie)}</span>
                  <span>{currentPaciente?.nombre || 'Expediente'}</span>
                </div>
                <div className="border-t border-slate-100 my-2" />
                {[
                  { label: 'Perfil', val: 'perfil' },
                  { label: 'Vacunas', val: 'vacunas' },
                  { label: 'Consultas', val: 'consultas' },
                ].map((tab) => {
                  const queryParams = new URLSearchParams(location.search);
                  const active = (queryParams.get('tab') || 'perfil') === tab.val;
                  return (
                    <Link
                      key={tab.val}
                      to={`/pacientes/${patientId}?tab=${tab.val}`}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold ${
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ) : isLevel2 && activeModule ? (
              <div className="space-y-1">
                <Link
                  to="/"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
                >
                  ← Inicio
                </Link>
                <div className="border-t border-slate-100 my-2" />
                {activeModule.subModules.map((sub) => {
                  const queryParams = new URLSearchParams(location.search);
                  const active = (queryParams.get('tab') || activeModule.subModules[0].tabValue) === sub.tabValue;
                  return (
                    <Link
                      key={sub.id}
                      to={`${activeModule.path}?tab=${sub.tabValue}`}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold ${
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
                  const active = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold ${
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )
          ) : (
            navItems.map((item) => {
              const Icon = typeof item.icon === 'string' ? NAV_ICON[item.icon as NavIcon] : item.icon;
              const active = isSuperadmin
                ? activeSection === item.id
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold ${
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })
          )}

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
