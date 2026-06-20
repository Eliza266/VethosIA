import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listarNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas } from './api';

// Centro de notificaciones in-app (canal Fase 1 junto al email). Usa TanStack Query.
export function useNotificaciones() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => listarNotificaciones(false),
  });

  const marcarLeida = useMutation({
    mutationFn: (id: string) => marcarNotificacionLeida(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const marcarTodas = useMutation({
    mutationFn: marcarTodasNotificacionesLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const noLeidas = (query.data ?? []).filter((n) => !n.leida).length;
  return { ...query, noLeidas, marcarLeida, marcarTodas };
}
