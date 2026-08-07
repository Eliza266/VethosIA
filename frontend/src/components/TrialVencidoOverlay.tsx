import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PlanesWhatsAppGrid } from '../features/saas/PlanesWhatsApp';

// Pantalla completa e infranqueable que se muestra cuando la suscripcion quedo en
// estado 'bloqueado_fin_trial' (7 dias de prueba vencidos). No hay boton para
// cerrarla: el unico camino es escribir a Vethos por WhatsApp para activar un plan.
export const TrialVencidoOverlay: React.FC = () => (
  <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 px-4 py-10">
    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-black text-white sm:text-3xl">
        Tu prueba gratuita de 7 días terminó
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
        Elige un plan para seguir generando historias clínicas con Vethos AI. Escríbenos por WhatsApp
        indicando el plan que quieres y activamos tu cuenta manualmente.
      </p>
      <PlanesWhatsAppGrid className="mt-8 w-full" />
    </div>
  </div>
);

export default TrialVencidoOverlay;
