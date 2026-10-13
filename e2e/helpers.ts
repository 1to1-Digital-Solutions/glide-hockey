import { expect, type Page } from '@playwright/test'
import { type SceneProbe } from '@/lib/sceneProbe'

/**
 * Lo que comparten los tests de navegador: llegar al menú, empezar una partida
 * como lo haría alguien con el ratón y mirar lo que pasa en la mesa.
 *
 * Lo último hace falta porque el disco y los mazos son objetos de three: desde
 * el DOM no se pueden seleccionar ni leer. La escena los publica solo si un
 * test lo pide (ver `src/lib/sceneProbe.ts`).
 */

/** Abre el juego y espera a que la mesa esté montada. */
export async function openGame(page: Page): Promise<void> {
  await page.goto('/')
  // El Canvas se carga aparte y solo en cliente: hasta que aparece, lo que hay
  // es la pantalla de carga.
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
}

/**
 * Empieza una partida de prueba con el nivel y los goles que se pidan. El menú abre en el reto
 * —lo comprueba `partida.spec.ts`—, así que lo primero es elegir la práctica.
 *
 * El nivel importa para lo que tarda un test en resolverse: con el mazo del
 * jugador parado, la máquina marca cada pocos segundos en Imposible y cada
 * quince en Fácil.
 */
export async function playMatch(
  page: Page,
  { goles, nivel, sinFin = false }: { goles: number; nivel: string; sinFin?: boolean },
): Promise<void> {
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  // El nivel y los goles van plegados detrás de «Más opciones» (la plantilla común del menú), si
  // no se ha desplegado ya.
  const masOpciones = page.getByRole('button', { name: 'More options', exact: true })
  if ((await masOpciones.count()) > 0) await masOpciones.click()
  await page.getByRole('button', { name: nivel }).click()
  await page.locator('#goal-target').fill(String(goles))
  // Después de los goles: sin fin apaga el deslizador.
  if (sinFin) await page.getByRole('button', { name: 'Endless', exact: true }).click()
  await page.getByRole('button', { name: 'Play' }).click()

  // La cuenta atrás va antes del saque; el marcador ya está en pantalla.
  await expect(page.getByText('Machine')).toBeVisible()
}

/**
 * Pide al juego que publique lo que pasa en la mesa.
 *
 * Hay que llamarlo **antes** de `abrirJuego`: la escena solo escribe la ranura
 * si ya existe cuando pinta el primer fotograma (ver `src/lib/sceneProbe.ts`).
 */
export async function watchTable(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__glideHockeyScene = null
  })
}

/**
 * Espera al primer fotograma de la partida y devuelve lo que se ve en la mesa.
 *
 * La escena solo publica mientras hay partida: en el menú no hay ni disco ni
 * mazos que mirar (ver `GameWorld`).
 */
export async function waitForTable(page: Page): Promise<SceneProbe> {
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyScene != null), {
      message: 'la escena no llegó a publicar lo que pasa en la mesa',
    })
    .toBe(true)

  return readTable(page)
}

/** Lo que la escena está publicando ahora mismo. */
export async function readTable(page: Page): Promise<SceneProbe> {
  const mesa = await page.evaluate(() => window.__glideHockeyScene)
  if (mesa == null) {
    throw new Error(
      'La mesa no está publicando nada: ¿se llamó a observarLaMesa antes de abrir el juego?',
    )
  }
  return mesa
}

/**
 * Lleva el ratón a donde se ve el disco y dice cuántas veces lo ha golpeado el
 * mazo del jugador hasta ahora.
 *
 * Es el gesto de quien juega: seguir el disco con la mano. Llamarlo en bucle
 * mueve el mazo detrás de él hasta que lo alcanza, sin depender de cuándo lo
 * devuelva la máquina ni de a qué velocidad vaya la partida en esta máquina.
 */
export async function chasePuck(page: Page): Promise<number> {
  const mesa = await readTable(page)
  await page.mouse.move(mesa.puckScreen.x, mesa.puckScreen.y)
  return mesa.playerHits
}
