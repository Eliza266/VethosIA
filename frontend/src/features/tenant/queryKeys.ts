/** Prefijo de cache React Query para /v1/me (invalidar con `{ queryKey: meQueryKeyRoot }`). */
export const meQueryKeyRoot = ['me'] as const;

export const meQueryKey = (uid: string) => [...meQueryKeyRoot, uid] as const;
