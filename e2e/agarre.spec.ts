import { expect, test } from '@playwright/test'
import { abrirJuego, observarLaMesa } from './helpers'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * Coger el mazo con la mano, dentro de una sesión de verdad.
 *
 * **Es el test que faltaba.** El mazo se agarra llevando la mano hasta él y apretando el
 * gatillo lateral, y para saber dónde está la mano el juego lee `state.object` del mando.
 * Ese objeto lo escribe **solo** `XRControllerModel`, que con `model: false` no se monta —así
 * que el mazo no se podía agarrar ni aquí ni en el salón, y desde fuera parecía que el botón
 * no funcionaba—. Nada lo cazaba: los demás tests entran por el ratón, que es otro camino.
 *
 * Ahora el mando se coloca y se aprieta desde el emulador (`support/xr-emulator.src.ts`), así
 * que esto se juega como se juega de verdad.
 */
test('el mazo va con la mano cuando se aprieta el gatillo', async ({ page }) => {
  await installXREmulator(page)
  // La demostración del gesto para la partida hasta que termina, y aquí lo que se prueba
  // es el gesto: se entra como quien ya la ha visto.
  await skipTutorial(page)
  await observarLaMesa(page)
  await abrirJuego(page)
  await enterVR(page)
  await startGameInsideSession(page)

  const mazo = async () =>
    page.evaluate(() => window.__airHockeyScene?.playerMallet ?? null)

  await expect.poll(mazo, { timeout: 20_000 }).not.toBeNull()
  const antes = await mazo()

  // La mano llega hasta el mazo y aprieta: es el gesto entero, y ninguna de las dos cosas
  // por separado tiene que bastar.
  await page.evaluate(() => {
    window.__xrTest.placeController('right', 0, 0.95, -0.48)
    window.__xrTest.squeeze('right', true)
  })
  await page.waitForTimeout(600)

  // Cogido, el mazo va donde va la mano: se mueve la mano y el mazo la sigue.
  await page.evaluate(() => window.__xrTest.placeController('right', 0.25, 0.95, -0.62))
  await expect
    .poll(async () => {
      const ahora = await mazo()
      if (ahora == null || antes == null) return 0
      return Math.hypot(ahora.x - antes.x, ahora.z - antes.z)
    }, { timeout: 15_000, message: 'el mazo no siguió a la mano' })
    .toBeGreaterThan(0.05)
})
