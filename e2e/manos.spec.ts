import { expect, test } from '@playwright/test'

import { abrirJuego, observarLaMesa } from './helpers'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * Jugar con las manos desnudas, sin mandos.
 *
 * **Es el modo de entrada que dejaba fuera a gente.** El juego leía solo los mandos, así que
 * sin ellos el mazo no se podía coger —y dentro del visor no se puede pintar texto, así que
 * tampoco había forma de explicar por qué—. Aquí se apagan los mandos, se encienden las
 * manos con sus articulaciones y se hace el gesto entero: llevar la palma al mazo y juntar
 * el pulgar con el índice.
 */
test('con las manos desnudas el mazo también se coge', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  // La demostración del gesto para la partida hasta que termina, y aquí lo que se prueba es
  // el gesto: se entra como quien ya la ha visto.
  await skipTutorial(page)
  await observarLaMesa(page)
  await abrirJuego(page)
  await enterVR(page)
  await page.evaluate(() => window.__xrTest.useHands())
  await startGameInsideSession(page)

  const mazo = async () => page.evaluate(() => window.__airHockeyScene?.playerMallet ?? null)
  await expect.poll(mazo, { timeout: 20_000 }).not.toBeNull()
  const antes = await mazo()

  // La palma llega hasta el mazo y pellizca: es el gesto entero. Las coordenadas son las
  // mismas que las del mando en `agarre.spec.ts`, que es donde está el mazo al empezar.
  await page.evaluate(() => {
    window.__xrTest.placeHand('right', 0, 0.95, -0.48)
    window.__xrTest.pinch('right', true)
  })
  await page.waitForTimeout(600)

  // Cogido, el mazo va donde va la mano.
  await page.evaluate(() => window.__xrTest.placeHand('right', 0.25, 0.95, -0.62))
  await expect
    .poll(
      async () => {
        const ahora = await mazo()
        if (ahora == null || antes == null) return 0
        return Math.hypot(ahora.x - antes.x, ahora.z - antes.z)
      },
      { timeout: 15_000, message: 'el mazo no siguió a la mano desnuda' },
    )
    .toBeGreaterThan(0.05)

  expect(errors).toEqual([])
})
