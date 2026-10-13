import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests of the game's logic (`src/lib`), of the state in React and of the
 * package that gets published (`scripts/`: the executable that copies the
 * static files and what `package.json` declares).
 *
 * Without `@vitejs/plugin-react`: Fast Refresh is not needed here and the JSX
 * is transformed by esbuild with the automatic runtime that `tsconfig.json`
 * already declares.
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
      // What is measured is **the domain**: `src/lib` is where whatever decides
      // something lives and it is the only thing that can be tested without a
      // browser with WebGL. The components of the scene are tested end to end,
      // in a real browser, and counting them here would only lower the number
      // without saying anything about whether they are tested.
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        // A hook that builds a reflection map with `PMREMGenerator`: it decides
        // nothing and needs a real GPU. What is checked about it is that the
        // table looks right, and that is only seen by looking.
        'src/lib/useRoomEnvironment.ts',
      ],
      reporter: ['text-summary', 'html'],
      // The domain is covered in full, so the floor is the ceiling: whatever is
      // added untested breaks the build. The branches no test can reach carry
      // `v8 ignore` with the reason written next to it.
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
})
