import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

export interface SidebarItemProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  end?: boolean;
  onNavigate?: () => void;
}

/**
 * Item de navegación de la sidebar. Usa NavLink (control real, no div clicable).
 * Cuando `collapsed`, muestra solo el icono con `title`/`aria-label` para tooltip.
 */
export const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  label,
  icon,
  active,
  collapsed,
  end,
  onNavigate,
}) => {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
        ) + ((active ?? isActive) ? ' veth-sidebar-item-active' : ' veth-sidebar-item')
      }
      aria-current={active ? 'page' : undefined}
    >
      {icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
          {icon}
        </span>
      )}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
};
