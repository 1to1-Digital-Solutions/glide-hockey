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
    coverage: {
      provider: 'v8',
      // Lo que se mide es **el dominio**: `src/lib` es donde vive lo que decide
      // algo y es lo único que se puede probar sin un navegador con WebGL. Los
      // componentes de la escena se prueban de extremo a extremo, en un
      // navegador de verdad, y contarlos aquí solo bajaría el número sin decir
      // nada de si están probados.
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        // Un hook que construye un mapa de reflejos con `PMREMGenerator`: no
        // decide nada y necesita una GPU de verdad. Lo que se comprueba de él
        // es que la mesa se vea bien, y eso solo se ve mirando.
        'src/lib/useRoomEnvironment.ts',
      ],
      reporter: ['text-summary', 'html'],
      // El dominio está cubierto entero, así que el suelo es el techo: lo que
      // se añada sin probar rompe el build. Las ramas que no puede alcanzar
      // ningún test llevan `v8 ignore` con el motivo escrito al lado.
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
})
