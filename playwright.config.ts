import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests, against the **production build**.
 *
 * That it is the production one is not a detail: in development React evaluates
 * code with `eval()` and dirties the console, and the most valuable test of
 * this suite is precisely the one that demands a clean console. Besides, the
 * headers of `next.config.ts` —the security policy that imitates the one of the
 * xrcade hall— are only seen by serving the real application, and they are the
 * ones that catch a `wasm` or a CDN slipped into the dependency tree.
 *
 * It is served on `127.0.0.1` and not on `localhost` on purpose: there are
 * libraries of the WebXR ecosystem that inject an emulator when the host name
 * is exactly `localhost`, and that would change the browser under the feet of
 * tests that check what happens **without** a headset.
 *
 * The port comes from the environment because several projects live together
 * on this machine: 3000 belongs to nobody who can take it on their own.
 */
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3100)
const HOST = '127.0.0.1'
const baseURL = `http://${HOST}:${PORT}`

export default defineConfig({
  // Bundles the WebXR emulator and the test host (`e2e/support/`).
  globalSetup: './e2e/support/globalSetup.ts',
  testDir: './e2e',
  // The match runs in real time: two at once on the same machine steal frames
  // from each other and distort how long the puck takes to cross the table.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Roomy on purpose: a match lasts its seconds and on a loaded machine —or in
  // continuous integration, with WebGL in software— it stretches in real
  // time.
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
        // The Canvas needs WebGL; without a screen SwiftShader covers it.
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
