import { expect, test, type Page } from '@playwright/test'
import { abrirJuego } from './helpers'
import { drawCallBudget } from './support/presupuesto'

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
async function medianaDeLlamadas(page: Page, count = 30): Promise<number> {
  await page.waitForTimeout(1500)
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
const TECHO_MESA = drawCallBudget('mesa').max

test('la mesa cabe en su presupuesto de llamadas de dibujo', async ({ page }) => {
  await countDrawCalls(page)
  await abrirJuego(page)

  const llamadas = await medianaDeLlamadas(page)
  console.log(`[mesa] llamadas de dibujo por fotograma: ${llamadas}`)
  expect(llamadas).toBeGreaterThan(0)
  expect(llamadas).toBeLessThanOrEqual(TECHO_MESA)
})
