import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificaciones } from '../features/notificaciones/hooks';
import { etiquetaNotificacion, rutaNotificacion } from '../features/notificaciones/routing';
import { Button, Card, EmptyState } from '../components/ui/Primitives';

const Notificaciones: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, noLeidas, marcarLeida, marcarTodas } = useNotificaciones();
  const notificaciones = data ?? [];

  const abrir = (id: string) => {
    const item = notificaciones.find((n) => n.id === id);
    if (!item) return;
    const ruta = rutaNotificacion(item);
    if (!item.leida) marcarLeida.mutate(item.id);
    if (ruta) navigate(ruta);
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0F6E56]">Centro operativo</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Notificaciones</h1>
            <p className="mt-1 text-sm text-slate-500">{noLeidas} sin leer</p>
          </div>
          <Button onClick={() => marcarTodas.mutate()} disabled={noLeidas === 0 || marcarTodas.isPending}>
            <span className="inline-flex items-center gap-2">
              <CheckCheck className="h-4 w-4" />
              Marcar todas
            </span>
          </Button>
        </div>
      </div>

      <Card>
        {isLoading && <p className="text-sm text-slate-500">Cargando notificaciones...</p>}
        {isError && <p role="alert" className="text-sm text-red-600">No se pudieron cargar las notificaciones.</p>}
        {!isLoading && !isError && notificaciones.length === 0 && (
          <EmptyState titulo="Sin notificaciones" mensaje="Cuando haya alertas internas aparecerán aquí." />
        )}
        <ul className="grid gap-2">
          {notificaciones.map((n) => {
            const ruta = rutaNotificacion(n);
            const etiqueta = etiquetaNotificacion(n.tipo, n.resourceType);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrir(n.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-[#0F6E56]/30 ${
                    n.leida ? 'border-slate-200 bg-white' : 'border-[#0F6E56]/20 bg-[#0F6E56]/5'
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-500">
                      {etiqueta}
                    </span>
                    <span className="block text-sm font-bold text-slate-900">{n.titulo}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-500">{n.cuerpo}</span>
                    <span className="mt-2 block text-xs font-semibold text-slate-400">
                      {ruta ? 'Abrir recurso' : 'Recurso no disponible'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};

export default Notificaciones;
export { Notificaciones };
