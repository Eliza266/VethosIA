import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Plus, Users, Menu } from 'lucide-react';
import { useMe } from '../features/tenant/hooks';

interface Props {
  onOpenMore: () => void;
}

const linkClass = (active: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold ${
    active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
  }`;

/** Navegacion inferior para movil: los 4 destinos de uso mas frecuente en jornada clinica,
 * mas "Nueva consulta" destacado al centro y "Mas" para el resto (abre el drawer lateral). */
const BottomNav: React.FC<Props> = ({ onOpenMore }) => {
  const { data: me } = useMe();
  const rol = me?.role ?? me?.rol;
  if (!me || rol === 'superadmin') return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[110] flex items-stretch border-t lg:hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
        <LayoutDashboard className="h-5 w-5" />
        Dashboard
      </NavLink>
      <NavLink to="/agenda" className={({ isActive }) => linkClass(isActive)}>
        <Calendar className="h-5 w-5" />
        Agenda
      </NavLink>

      <div className="flex flex-1 items-center justify-center">
        <NavLink
          to="/consultas/nueva-rapida"
          aria-label="Nueva consulta"
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-accent)' }}
        >
          <Plus className="h-6 w-6" />
        </NavLink>
      </div>

      <NavLink to="/pacientes" className={({ isActive }) => linkClass(isActive)}>
        <Users className="h-5 w-5" />
        Pacientes
      </NavLink>
      <button type="button" onClick={onOpenMore} className={linkClass(false)}>
        <Menu className="h-5 w-5" />
        Más
      </button>
    </nav>
  );
};

export default BottomNav;
