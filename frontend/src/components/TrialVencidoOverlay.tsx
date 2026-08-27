import React from 'react';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMERO } from '../features/saas/PlanesWhatsApp';

// Fase 1: no mostramos precios ni planes aqui a proposito -- Eliza prefiere que el
// primer contacto post-trial sea siempre por WhatsApp, sin anclar un numero que
// luego pueda cambiar por una promocion.
const LINK_WHATSAPP_RENOVAR = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  'Quiero renovar mi plan con Vethos AI',
)}`;

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
        ¿Quieres renovar con nosotros? Escríbenos, tenemos excelentes promociones para seguir generando
        historias clínicas con Vethos AI.
      </p>
      <a
        href={LINK_WHATSAPP_RENOVAR}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-400"
      >
        <MessageCircle className="h-5 w-5" />
        Escribir por WhatsApp
      </a>
    </div>
  </div>
);

export default TrialVencidoOverlay;
