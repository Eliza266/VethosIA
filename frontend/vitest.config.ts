import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config separada de vite.config.ts a proposito: no cargamos el plugin de tailwind
// aca (no hace falta para tests y solo agrega ruido). jsdom para poder testear
// hooks/componentes de React.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // los e2e de Playwright viven fuera de src y los corre su propio runner
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
    },
  },
});
