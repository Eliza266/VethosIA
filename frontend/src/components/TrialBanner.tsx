import { Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getTrialBannerMessage, isInternalTestAccount } from '../lib/trialBanner';

const TrialBanner: React.FC = () => {
  const { user } = useAuth();

  if (!user || isInternalTestAccount(user.email)) return null;

  const mensaje = getTrialBannerMessage();
  if (!mensaje) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-2 text-center text-xs font-semibold text-white sm:text-sm"
      style={{ background: 'var(--accent-strong, #173b73)' }}
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>{mensaje}</span>
    </div>
  );
};

export default TrialBanner;
