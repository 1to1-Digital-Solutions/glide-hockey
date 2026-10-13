import { expect, test, type Page } from '@playwright/test'
import { openGame, watchTable } from './helpers'
import { openHost } from './support/host'
import { drawCallBudget } from './support/budget'

/**
 * Lo que cuesta pintar la mesa, medido sobre la escena de verdad.
 *
 * En unas gafas lo que se paga no son los triángulos sino las **llamadas de
 * dibujo**, y esas son las mismas aquí que allí (allí, por ojo). Los fps de un
 * escritorio sin GPU no dirían nada del visor; el número de llamadas sí, y es
 * lo que se vigila al meter el mapa de entorno y el halo del disco: el mapa no
 * añade llamadas y el halo es una malla más, solo en partida.
 *
 * Se mide desde fuera, envolviendo el contexto WebGL, para no meter contadores
 * en el código del juego.
 */

interface DrawFrame {
  calls: number
}

declare global {
  interface Window {
    __drawFrames?: DrawFrame[]
  }
}

/** Envuelve el contexto WebGL para contar llamadas. Antes de `page.goto`. */
async function countDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const frames: DrawFrame[] = []
    window.__drawFrames = frames
    let calls = 0
    const gl = WebGL2RenderingContext.prototype
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        calls++
        return original.apply(this, args)
      }
    }
    const closeFrame = () => {
      frames.push({ calls })
      if (frames.length > 240) frames.shift()
      calls = 0
      requestAnimationFrame(closeFrame)
    }
    requestAnimationFrame(closeFrame)
  })
}

/** La mediana de llamadas por fotograma, con la escena ya asentada. */
async function medianaDeLlamadas(page: Page, count = 30, asiento = 1500): Promise<number> {
  await page.waitForTimeout(asiento)
  await page.evaluate(() => {
    window.__drawFrames!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawFrames!.length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(count)
  const calls = await page.evaluate(() =>
    window.__drawFrames!.map((f) => f.calls).filter((c) => c > 0).sort((a, b) => a - b),
  )
  return calls[Math.floor(calls.length / 2)] ?? 0
}

/**
 * Techo de llamadas por fotograma de la mesa en el menú: el tablero, las bandas,
 * las marcas, las porterías, las patas y la sala; la interfaz de escritorio
 * no cuenta (es DOM).
 */
const TECHO_MESA = drawCallBudget('table').max

test('la mesa cabe en su presupuesto de llamadas de dibujo', async ({ page }) => {
  await countDrawCalls(page)
  await openGame(page)

  const llamadas = await medianaDeLlamadas(page)
  console.log(`[mesa] llamadas de dibujo por fotograma: ${llamadas}`)
  expect(llamadas).toBeGreaterThan(0)
  expect(llamadas).toBeLessThanOrEqual(TECHO_MESA)
})

/**
 * El cartel del objetivo, que cuelga encima del marcador del fondo: **una llamada de dibujo**, y
 * dos como mucho —el fondo, las dos líneas y la barra van en el mismo lienzo—.
 *
 * Se mide montado como lo monta el salón, que es donde se cuelga (en la web del juego, sin visor,
 * el objetivo va en el marcador de DOM): con el reto y los listones que pasa el salón, la escena
 * entra jugando con el cartel puesto. Y se mide contra **la misma escena en el mismo momento**,
 * escondiendo el cartel desde el anfitrión de prueba: comparar con otro modo no vale aquí, porque
 * el marcador de cifras pinta un segmento por llamada y cambia con el modo y con cada gol. Por lo
 * mismo se repite la medida con el cartel a los dos lados de la medida sin él, y solo cuenta si
 * las dos coinciden: un gol entre medias cambia las cifras del marcador.
 *
 * El suelo de una llamada es lo que impide que pase midiendo una escena sin cartel.
 */
const CARTEL = drawCallBudget('goal-sign')

test('el cartel del objetivo añade como mucho dos llamadas de dibujo', async ({ page }) => {
  await countDrawCalls(page)
  await watchTable(page)
  await openHost(page, undefined, {
    reto: 20261005,
    goal: { medals: { bronze: 1500, silver: 8000, gold: 20000 }, better: 'higher', unit: 'points in the challenge', record: null, mode: 'challenge' },
  })
  // Con el disco ya en juego: la cuenta atrás cambia de cifra cada segundo.
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyScene != null), { message: 'el reto no llegó a poner la mesa' })
    .toBe(true)
  await page.waitForTimeout(4_000)
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyHost.verElCartel(true)), { message: 'el cartel del objetivo no está colgado' })
    .toBe(true)

  let medido: { con: number; sin: number } | null = null
  for (let intento = 0; intento < 6 && medido == null; intento++) {
    const antes = await medianaDeLlamadas(page, 20, 300)
    await page.evaluate(() => window.__glideHockeyHost.verElCartel(false))
    const sin = await medianaDeLlamadas(page, 20, 300)
    await page.evaluate(() => window.__glideHockeyHost.verElCartel(true))
    const despues = await medianaDeLlamadas(page, 20, 300)
    if (antes === despues) medido = { con: antes, sin }
  }

  expect(medido, 'la escena no se estuvo quieta entre dos medidas').not.toBeNull()
  console.log(`[mesa] el cartel del objetivo: ${medido!.con - medido!.sin} llamadas (${medido!.sin} sin él, ${medido!.con} con él)`)
  expect(medido!.con - medido!.sin).toBeGreaterThanOrEqual(CARTEL.min)
  expect(medido!.con - medido!.sin).toBeLessThanOrEqual(CARTEL.max)
})
