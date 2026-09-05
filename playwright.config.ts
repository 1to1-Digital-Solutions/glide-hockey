import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de extremo a extremo, contra el **build de producción**.
 *
 * Que sea el de producción no es un detalle: en desarrollo React evalúa código
 * con `eval()` y ensucia la consola, y el test que más valor tiene de esta
 * suite es justamente el que exige la consola limpia. Además, las cabeceras de
 * `next.config.ts` —la política de seguridad que imita a la del salón de
 * xrcade— solo se ven sirviendo la aplicación de verdad, y son las que cazan un
 * `wasm` o un CDN colados en el árbol de dependencias.
 *
 * Se sirve en `127.0.0.1` y no en `localhost` a propósito: hay librerías del
 * ecosistema de WebXR que inyectan un emulador cuando el nombre de máquina es
 * exactamente `localhost`, y eso cambiaría el navegador bajo los pies de unos
 * tests que comprueban qué pasa **sin** visor.
 *
 * El puerto sale del entorno porque en esta máquina conviven varios proyectos:
 * el 3000 no es de nadie que pueda ocuparlo por su cuenta.
 */
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3100)
const HOST = '127.0.0.1'
const baseURL = `http://${HOST}:${PORT}`

export default defineConfig({
  // Empaqueta el emulador de WebXR y el anfitrión de prueba (`e2e/support/`).
  globalSetup: './e2e/support/globalSetup.ts',
  testDir: './e2e',
  // La partida va en tiempo real: dos a la vez en la misma máquina se roban
  // fotogramas y falsean lo que tarda el disco en cruzar la mesa.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Holgado a propósito: una partida dura sus segundos y en una máquina cargada
  // —o en integración continua, con WebGL por software— se alarga en tiempo
  // real.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // El Canvas necesita WebGL; sin pantalla lo cubre SwiftShader.
        launchOptions: {
          args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT} --hostname ${HOST}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
  },
})
