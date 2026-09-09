import { expect, test } from '@playwright/test'
import { abrirJuego } from './helpers'
import { enterButton, enterVR, exitButton, exitXR, installXREmulator, startGameInsideSession } from './support/xr'

/**
 * Modo inmersivo, sobre un Quest 3 emulado con IWER.
 *
 * Chromium no trae WebXR, así que sin el emulador estos caminos no se ejecutan
 * nunca: los demás tests entran por el ratón, que es código distinto. Aquí se
 * abre una sesión de verdad y se comprueba en qué estado deja al juego, mirando
 * el DOM que sigue montado detrás de la sesión.
 *
 * **Lo que estos tests NO cubren, y por qué:** llevar el mazo con el mando.
 * IWER registra los mandos —el juego sirve sus perfiles desde
 * `public/webxr-profiles/`— pero no propaga las poses de los punteros hasta la
 * escena, así que mover el mazo con el rayo y pulsar el menú inmersivo solo se
 * validan con el visor puesto (y cómo se lleva el mazo en VR está por decidir).
 * Lo que sí se comprueba es que entrar en sesión monte la escena inmersiva y
 * deje la partida corriendo sin un solo error.
 */
test.describe('Sesión inmersiva', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await abrirJuego(page)
  })

  test('con WebXR disponible aparece la entrada al visor', async ({ page }) => {
    await expect(enterButton(page)).toBeVisible()
  })

  test('entrar en el visor abre la sesión y lleva al menú, no a una partida', async ({ page }) => {
    await enterVR(page)

    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
    // Se entra al menú: la partida la empieza el jugador. (El menú ofrece
    // también «Salir» del visor mientras hay sesión; no es el «Salir» del HUD.)
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })

  test('la escena inmersiva se monta y la partida corre dentro de la sesión', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await enterVR(page)
    await startGameInsideSession(page)

    await expect(exitButton(page)).toBeVisible()
    // Unos fotogramas de partida con la sesión abierta: la mesa, el marcador en
    // geometría y el menú inmersivo se pintan aquí, y un fallo suyo solo lo
    // dice la consola —la escena vive en la raíz de R3F, no en el DOM—.
    await page.waitForTimeout(3_000)
    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
    expect(errors).toEqual([])
  })

  test('salir de la sesión devuelve al menú de escritorio', async ({ page }) => {
    await enterVR(page)
    await startGameInsideSession(page)

    await exitXR(page)

    // Quitarse el visor a media partida vuelve al menú (`XRSessionController`):
    // la partida del visor no continúa en la pantalla, se empieza otra.
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    await expect(enterButton(page)).toBeVisible()
  })
})
