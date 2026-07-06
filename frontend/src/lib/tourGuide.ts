const PREFIJO = 'vethos_tour_';

export const haVistoTour = (tourId: string): boolean =>
  typeof window !== 'undefined' && window.localStorage.getItem(`${PREFIJO}${tourId}`) === 'visto';

export const marcarTourVisto = (tourId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${PREFIJO}${tourId}`, 'visto');
};
