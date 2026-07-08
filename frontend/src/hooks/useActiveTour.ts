import { createContext, useContext } from 'react';

type ReplayFn = (() => void) | null;

export interface ActiveTourContextValue {
  replay: ReplayFn;
  registerReplay: (fn: ReplayFn) => void;
}

// Default sin provider: replay null (el botón de ayuda simplemente no aparece) y
// registerReplay no-op. Evita que renderizar Sidebar/páginas sueltas (tests, storybook)
// sin ActiveTourProvider rompa el render.
const defaultValue: ActiveTourContextValue = {
  replay: null,
  registerReplay: () => {},
};

export const ActiveTourContext = createContext<ActiveTourContextValue>(defaultValue);

export function useActiveTour(): ActiveTourContextValue {
  return useContext(ActiveTourContext);
}
