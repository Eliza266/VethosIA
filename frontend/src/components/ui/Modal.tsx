import React, { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlay?: boolean;
  labelledBy?: string;
  ariaLabel?: string;
}

const SIZES: Record<NonNullable<ModalProps['size']>, number> = {
  sm: 420,
  md: 560,
  lg: 760,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  labelledBy,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descId = `modal-desc-${reactId}`;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const nodes = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const node = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      node?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={closeOnOverlay ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9997,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(16, 22, 19, 0.45)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledBy ?? (title ? titleId : undefined)}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cn('animate-slide-up')}
        style={{
          width: '100%',
          maxWidth: SIZES[size],
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <h2 id={titleId} style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} style={{ marginTop: 6, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-xs)',
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div style={{ marginTop: title || description ? 'var(--space-4)' : 0 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-6)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
