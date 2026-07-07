import { useCallback, useEffect, useRef } from 'react';
import { driver, type Config, type DriveStep, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import { haVistoTour, marcarTourVisto } from '../lib/tourGuide';
import { seMostraraBienvenida, WELCOME_INSTALL_CLOSED_EVENT } from '../lib/welcomeInstall';
import { useActiveTour } from './useActiveTour';

// Reemplaza el texto "1 of 2" por puntitos de progreso, al estilo de la marca.
const renderizarPuntosProgreso = (popover: PopoverDOM, total: number, activo: number): void => {
  popover.progress.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const punto = document.createElement('span');
    punto.className = i === activo ? 'veth-tour-dot veth-tour-dot-active' : 'veth-tour-dot';
    popover.progress.appendChild(punto);
  }
};

export function useTourGuide(tourId: string, steps: DriveStep[]) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const { registerReplay } = useActiveTour();

  const iniciar = useCallback(() => {
    const config: Config = {
      showProgress: true,
      steps,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Listo',
      onDestroyed: () => marcarTourVisto(tourId),
      onPopoverRender: (popover, { state }) => {
        renderizarPuntosProgreso(popover, steps.length, state.activeIndex ?? 0);
      },
    };
    driverRef.current = driver(config);
    driverRef.current.drive();
  }, [tourId, steps]);

  // Registra el replay de esta página como el activo (para el botón de ayuda del header).
  useEffect(() => {
    registerReplay(iniciar);
    return () => registerReplay(null);
  }, [iniciar, registerReplay]);

  useEffect(() => {
    if (haVistoTour(tourId)) return;

    // Si el popup de bienvenida (PWA) va a mostrarse, espera a que se cierre antes de
    // arrancar el tour: si arrancan los dos a la vez se ven encimados y no se entiende nada.
    if (!seMostraraBienvenida()) {
      const id = window.setTimeout(iniciar, 400);
      return () => window.clearTimeout(id);
    }

    let id: number | undefined;
    const onBienvenidaCerrada = () => {
      id = window.setTimeout(iniciar, 400);
    };
    window.addEventListener(WELCOME_INSTALL_CLOSED_EVENT, onBienvenidaCerrada, { once: true });
    return () => {
      window.removeEventListener(WELCOME_INSTALL_CLOSED_EVENT, onBienvenidaCerrada);
      if (id) window.clearTimeout(id);
    };
  }, [tourId, iniciar]);

  return { replay: iniciar };
}
