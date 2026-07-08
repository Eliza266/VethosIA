import React, { useCallback, useState } from 'react';
import { ActiveTourContext, type ActiveTourContextValue } from '../hooks/useActiveTour';

type ReplayFn = ActiveTourContextValue['replay'];

// Provee un único "botón de ayuda" (junto a la campanita, en el header) que reproduce
// el tour de la página actualmente montada, sin que cada página flote su propio botón.
export const ActiveTourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [replay, setReplay] = useState<ReplayFn>(null);
  const registerReplay = useCallback((fn: ReplayFn) => setReplay(() => fn), []);

  return (
    <ActiveTourContext.Provider value={{ replay, registerReplay }}>
      {children}
    </ActiveTourContext.Provider>
  );
};

export default ActiveTourProvider;
