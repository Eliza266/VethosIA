import { HelpCircle } from 'lucide-react';

interface TourHelpButtonProps {
  onReplay: () => void;
}

export default function TourHelpButton({ onReplay }: TourHelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onReplay}
      aria-label="Ver guía de esta pantalla"
      className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent-strong"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
