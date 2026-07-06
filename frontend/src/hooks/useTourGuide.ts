import { useCallback, useEffect, useRef } from 'react';
import { driver, type Config, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { haVistoTour, marcarTourVisto } from '../lib/tourGuide';

export function useTourGuide(tourId: string, steps: DriveStep[]) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const iniciar = useCallback(() => {
    const config: Config = {
      showProgress: true,
      steps,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Listo',
      onDestroyed: () => marcarTourVisto(tourId),
    };
    driverRef.current = driver(config);
    driverRef.current.drive();
  }, [tourId, steps]);

  useEffect(() => {
    if (haVistoTour(tourId)) return;
    const id = window.setTimeout(iniciar, 400);
    return () => window.clearTimeout(id);
  }, [tourId, iniciar]);

  return { replay: iniciar };
}
