import { HelpCircle } from 'lucide-react';

interface TourHelpButtonProps {
  onReplay: () => void;
  className?: string;
}

// Botón fijo en el header (junto a la campanita), reproduce el tour guiado de la
// página activa. Ya no flota sobre el contenido: antes se superponía a otros botones.
export default function TourHelpButton({ onReplay, className = '' }: TourHelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onReplay}
      aria-label="Ver guía de esta pantalla"
      title="Ver guía de esta pantalla"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sidebar-item-hover-bg)] ${className}`}
      style={{ color: 'var(--muted)' }}
    >
      <HelpCircle className="h-[18px] w-[18px]" />
    </button>
  );
}
