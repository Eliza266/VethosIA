import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/hooks';
import { obtenerMe, type MeProfile } from './api';
import { meQueryKey, meQueryKeyRoot } from './queryKeys';

export type Me = MeProfile;

// Identidad + claims + perfil veterinario (de /v1/me). Si la API no responde, devolvemos rol null
// (la app sigue funcionando en modo legacy). No reintenta para no bloquear la UI.
export function useMe() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;

  return useQuery<Me>({
    queryKey: uid ? meQueryKey(uid) : meQueryKeyRoot,
    queryFn: obtenerMe,
    enabled: !!uid,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
