/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { estadoBadgeVariant, type BadgeVariant } from '../../shared/status';

// Primitivas UI Vethosia Clinical Command Center — tokens CSS, sin colores hardcodeados.

const VAR_COLOR: Record<BadgeVariant, string> = {
  info: 'var(--info)',
  success: 'var(--success)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  neutral: 'var(--muted)',
};

type ButtonVariant = 'primary' | 'ghost' | 'secondary' | 'danger' | 'success' | 'whatsapp';

const BUTTON_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-contrast)',
    border: 'none',
    boxShadow: 'var(--shadow-accent)',
  },
  secondary: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    border: '1px solid color-mix(in srgb, var(--danger) 24%, transparent)',
  },
  success: {
    background: 'var(--success-soft)',
    color: 'var(--success)',
    border: '1px solid color-mix(in srgb, var(--success) 24%, transparent)',
  },
  whatsapp: {
    background: 'var(--whatsapp-soft)',
    color: 'var(--whatsapp)',
    border: '1px solid color-mix(in srgb, var(--whatsapp) 24%, transparent)',
  },
};

export const Card: React.FC<
  React.PropsWithChildren<
    React.HTMLAttributes<HTMLDivElement> & { className?: string; elevated?: boolean; padding?: 'sm' | 'md' | 'lg' }
  >
> = ({ children, className = '', elevated = true, padding = 'md', ...props }) => {
  const pad = padding === 'sm' ? 'var(--space-4)' : padding === 'lg' ? 'var(--space-8)' : 'var(--space-6)';
  return (
    <div
      {...props}
      className={className}
      style={{
        ...props.style,
        background: elevated ? 'var(--surface-elevated)' : 'var(--surface)',
        border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
        borderRadius: 'var(--radius)',
        boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        padding: pad,
      }}
    >
      {children}
    </div>
  );
};

export const Badge: React.FC<{ estado?: string; children?: React.ReactNode; size?: 'sm' | 'md' }> = ({
  estado,
  children,
  size = 'md',
}) => {
  const variant = estadoBadgeVariant(estado);
  const color = VAR_COLOR[variant];
  return (
    <span
      data-variant={variant}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: size === 'sm' ? 10 : 12,
        fontWeight: 700,
        letterSpacing: size === 'sm' ? '0.04em' : undefined,
        textTransform: size === 'sm' ? 'uppercase' : undefined,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        borderRadius: 999,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
      }}
    >
      {children ?? estado ?? ''}
    </span>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
  }
> = ({ variant = 'primary', size = 'md', fullWidth, style, children, className = '', ...rest }) => {
  const sizeStyle: React.CSSProperties =
    size === 'sm'
      ? { padding: '6px 12px', fontSize: 12 }
      : size === 'lg'
        ? { padding: '12px 22px', fontSize: 15 }
        : { padding: '9px 16px', fontSize: 14 };

  return (
    <button
      {...rest}
      className={`${className} transition-all duration-200 hover:brightness-[0.97] active:scale-[0.98] disabled:pointer-events-none`}
      style={{
        ...BUTTON_STYLES[variant],
        borderRadius: 'var(--radius-sm)',
        fontWeight: 700,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.55 : 1,
        width: fullWidth ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        ...sizeStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Skeleton: React.FC<{ height?: number; width?: number | string; className?: string }> = ({
  height = 16,
  width = '100%',
  className = '',
}) => (
  <div
    aria-hidden
    className={`animate-pulse ${className}`}
    style={{
      height,
      width,
      borderRadius: 'var(--radius-sm)',
      background: 'color-mix(in srgb, var(--muted) 16%, transparent)',
    }}
  />
);

export const EmptyState: React.FC<{
  titulo: string;
  mensaje?: string;
  accion?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'controlled' | 'compact';
}> = ({ titulo, mensaje, accion, icon, variant = 'default' }) => (
  <div
    style={{
      textAlign: variant === 'compact' ? 'left' : 'center',
      padding: variant === 'compact' ? 'var(--space-5)' : 'var(--space-10) var(--space-6)',
      color: 'var(--muted)',
      border:
        variant === 'controlled'
          ? '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))'
          : '1px dashed color-mix(in srgb, var(--border) 90%, transparent)',
      borderRadius: 'var(--radius)',
      background:
        variant === 'controlled'
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-soft) 70%, var(--surface)), var(--surface))'
          : 'color-mix(in srgb, var(--surface-2) 60%, var(--surface))',
    }}
  >
    {icon && (
      <div
        style={{
          margin: '0 auto var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
        }}
      >
        {icon}
      </div>
    )}
    <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 8, fontSize: 15 }}>{titulo}</div>
    {mensaje && <div style={{ fontSize: 14, marginBottom: accion ? 20 : 0, maxWidth: 360, marginInline: 'auto' }}>{mensaje}</div>}
    {accion}
  </div>
);

export const InfoTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: BadgeVariant;
}> = ({ label, value, hint, icon, tone = 'info' }) => {
  const color = VAR_COLOR[tone];
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 18%, var(--border))`,
        background: `linear-gradient(180deg, color-mix(in srgb, ${color} 6%, var(--surface)), var(--surface))`,
      }}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
          <div className="mt-1 text-lg font-black text-[var(--text)]">{value}</div>
          {hint ? <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
};

export const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: 'default' | 'info' | 'success' | 'warn' | 'danger';
  className?: string;
}> = ({ label, value, hint, icon, accent = 'default', className = '' }) => {
  const accentBg =
    accent === 'info'
      ? 'var(--info-soft)'
      : accent === 'success'
        ? 'var(--success-soft)'
        : accent === 'warn'
          ? 'var(--warn-soft)'
          : accent === 'danger'
            ? 'var(--danger-soft)'
            : 'var(--accent-soft)';
  const accentColor =
    accent === 'info'
      ? 'var(--info)'
      : accent === 'success'
        ? 'var(--success)'
        : accent === 'warn'
          ? 'var(--warn)'
          : accent === 'danger'
            ? 'var(--danger)'
            : 'var(--accent)';

  return (
    <div className={`veth-card ${className}`} style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        {icon && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-sm)',
              background: accentBg,
              color: accentColor,
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <p className="veth-section-label">{label}</p>
          <div className="veth-kpi-value" style={{ marginTop: 4 }}>
            {value}
          </div>
          {hint && <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>{hint}</p>}
        </div>
      </div>
    </div>
  );
};

export const SectionHeader: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h2>
      {description && <p style={{ marginTop: 4, fontSize: 14, color: 'var(--muted)' }}>{description}</p>}
    </div>
    {action}
  </div>
);

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export const PageHeader: React.FC<{
  badge?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  tabs?: React.ReactNode;
  className?: string;
}> = ({ badge, title, description, action, breadcrumbs, tabs, className = '' }) => (
  <div
    className={`animate-fade-in ${className}`}
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-xs)',
      padding: 'var(--space-6)',
    }}
  >
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Ruta" style={{ marginBottom: 10 }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', margin: 0, padding: 0, fontSize: 12, color: 'var(--muted)' }}>
          {breadcrumbs.map((bc, i) => (
            <li key={`${bc.label}-${i}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {bc.to ? (
                <RouterLink to={bc.to} style={{ color: 'var(--muted)' }}>{bc.label}</RouterLink>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <span aria-hidden>/</span>}
            </li>
          ))}
        </ol>
      </nav>
    )}
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div style={{ minWidth: 0 }}>
        {badge && (
          <span
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            }}
          >
            {badge}
          </span>
        )}
        <h1
          style={{
            marginTop: badge ? 12 : 0,
            fontSize: 'clamp(1.35rem, 2.5vw, 1.65rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          {title}
        </h1>
        {description && (
          <p style={{ marginTop: 8, maxWidth: 640, fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
    {tabs && <div style={{ marginTop: 'var(--space-4)' }}>{tabs}</div>}
  </div>
);

export const ActionBar: React.FC<{
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
}> = ({ children, sticky = false, className = '' }) => (
  <div
    className={`${sticky ? 'veth-sticky-actions' : ''} ${className}`}
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      padding: sticky ? 'var(--space-3) 0' : undefined,
    }}
    role="toolbar"
    aria-label="Acciones"
  >
    {children}
  </div>
);

// ── Toast ────────────────────────────────────────────────────────────

type ToastVariant = 'info' | 'success' | 'warn' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICON: Record<ToastVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warn: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
};

const TOAST_COLOR: Record<ToastVariant, { bg: string; fg: string; border: string }> = {
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', border: 'color-mix(in srgb, var(--info) 24%, transparent)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', border: 'color-mix(in srgb, var(--success) 24%, transparent)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', border: 'color-mix(in srgb, var(--warn) 24%, transparent)' },
  error: { bg: 'var(--danger-soft)', fg: 'var(--danger)', border: 'color-mix(in srgb, var(--danger) 24%, transparent)' },
};

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 'min(420px, calc(100vw - 32px))',
          pointerEvents: 'none',
        }}
      >
        {items.map((item) => {
          const colors = TOAST_COLOR[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: colors.bg,
                color: colors.fg,
                border: `1px solid ${colors.border}`,
                boxShadow: 'var(--shadow-md)',
                animation: 'toastIn 0.28s ease-out forwards',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>{TOAST_ICON[item.variant]}</span>
              <span style={{ flex: 1 }}>{item.message}</span>
              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
                style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  opacity: 0.7,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
};

// ── Confirm dialog ───────────────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && options && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(11, 18, 32, 0.45)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              padding: 'var(--space-6)',
              animation: 'slideUp 0.25s ease-out forwards',
            }}
          >
            <h2 id="confirm-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              {options.title}
            </h2>
            <p id="confirm-message" style={{ marginTop: 10, fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {options.message}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <Button variant="ghost" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant={options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextValue => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx;
};

export const UIProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ToastProvider>
    <ConfirmProvider>{children}</ConfirmProvider>
  </ToastProvider>
);
