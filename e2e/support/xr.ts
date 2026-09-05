import { expect, type Page } from '@playwright/test'
import { XR_EMULATOR_BUNDLE } from './globalSetup'

interface XRTestApi {
  hasSession: () => boolean
  connectControllers: () => void
  endSession: () => Promise<void>
}

declare global {
  interface Window {
    __xrTest: XRTestApi
  }
}

/** Instala el Quest 3 emulado antes de que cargue la página. */
export async function installXREmulator(page: Page) {
  await page.addInitScript({ path: XR_EMULATOR_BUNDLE })
}

export function enterButton(page: Page) {
  return page.getByRole('button', { name: 'Jugar con el visor' })
}

/** Solo está con una partida en marcha: es el espejo de DOM del estado. */
export function exitButton(page: Page) {
  return page.getByRole('button', { name: 'Salir', exact: true })
}

export async function enterVR(page: Page) {
  await enterButton(page).click()
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'no arrancó la sesión inmersiva',
    })
    .toBe(true)
  await page.evaluate(() => window.__xrTest.connectControllers())
}

export async function exitXR(page: Page) {
  await page.evaluate(() => window.__xrTest.endSession())
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'la sesión inmersiva no se cerró',
    })
    .toBe(false)
}

/**
 * Arranca la partida con el menú de escritorio, que sigue montado detrás de la
 * sesión. Dentro del visor se arrancaría con el rayo, pero el emulador no
 * propaga las poses de los punteros hasta la escena.
 */
export async function startGameInsideSession(page: Page, attempts = 8) {
  const play = page.getByRole('button', { name: 'Jugar', exact: true })
  for (let attempt = 0; attempt < attempts; attempt++) {
    await play.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    if ((await play.count()) === 0) return
  }
  throw new Error(`No se pudo arrancar la partida dentro de la sesión en ${attempts} intentos`)
}
