import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Tests unitarios de la lógica del juego (`src/lib`), del estado en React y del
 * paquete que se publica (`scripts/`: el ejecutable que copia los ficheros
 * estáticos y lo que declara el `package.json`).
 *
 * Sin `@vitejs/plugin-react`: aquí no hace falta Fast Refresh y el JSX lo
 * transforma esbuild con el runtime automático que ya declara `tsconfig.json`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
  },
})
