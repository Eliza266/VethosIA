// Movido a features/auth/hooks.tsx durante la refactor de capas (fail-closed).
// Shim de compatibilidad: muchas pages importan desde '../hooks/useAuth'.
export { AuthProvider, useAuth } from '../features/auth/hooks';
