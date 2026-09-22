import { expect, type Page } from '@playwright/test'
import { TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE } from '../../src/lib/tutorial'
import { XR_EMULATOR_BUNDLE } from './globalSetup'

interface XRTestApi {
  hasSession: () => boolean
  connectControllers: () => void
  /** Cambia a manos desnudas: apaga los mandos y enciende las manos con sus articulaciones. */
  useHands: () => void
  placeHand: (handedness: 'left' | 'right', x: number, y: number, z: number) => void
  /** Junta o separa el pulgar y el índice, que es el «agarrar» de una mano desnuda. */
  pinch: (handedness: 'left' | 'right', pressed: boolean) => void
  placeController: (handedness: 'left' | 'right', x: number, y: number, z: number) => void
  squeeze: (handedness: 'left' | 'right', pressed: boolean) => void
  /** Gira la cabeza, en grados. Hace falta para mirar a donde están las ayudas: al suelo. */
  lookAt: (yaw?: number, pitch?: number) => void
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
  return page.getByRole('button', { name: 'Play in the headset' })
}

/** Solo está con una partida en marcha: es el espejo de DOM del estado. */
export function exitButton(page: Page) {
  return page.getByRole('button', { name: 'Exit', exact: true })
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
  const play = page.getByRole('button', { name: 'Play', exact: true })
  for (let attempt = 0; attempt < attempts; attempt++) {
    await play.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    if ((await play.count()) === 0) return
  }
  throw new Error(`No se pudo arrancar la partida dentro de la sesión en ${attempts} intentos`)
}

/**
 * Deja el juego como si la demostración del gesto ya se hubiera visto.
 *
 * **Hace falta antes de abrir el juego.** Con el visor puesto y sin haberla visto nunca, la
 * demostración corre entre «empezar» y el primer lanzamiento, y la partida la espera: quien
 * no sabe todavía el gesto no juega (ver `lib/gameStore.ts`). Un test que va a hacer el
 * gesto no está probando eso, y esperar seis segundos en cada uno solo alarga la suite.
 *
 * Lo que se escribe es lo mismo que escribe el juego al terminarla (`lib/tutorial.ts`), y por
 * eso **la clave y el valor** se importan de ahí en vez de copiarse. El valor es la versión de
 * la lección: se copiaba a mano como `'1'`, y en cuanto se subió a `'2'` —la demostración pasó
 * a enseñar el botón de agarre en vez del gatillo— los tests dejaron de saltársela y se
 * quedaron esperando seis segundos a una explicación.
 */
export async function skipTutorial(page: Page) {
  await page.addInitScript(([key, value]: readonly string[]) => {
    try {
      window.localStorage.setItem(key!, value!)
    } catch {
      // Almacenamiento capado: la demostración saldrá, y el test que la necesite fuera ya
      // se enterará al no ver el gesto.
    }
  }, [TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE])
}
