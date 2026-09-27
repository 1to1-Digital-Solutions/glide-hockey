import { describe, expect, it } from 'vitest'
import { SCENERIES } from './ajustes'
import { GAME_MODE_ORDER } from './gameMode'
import { MENU_BOXES, MENU_BUTTON, MENU_PANEL } from './xrMenuLayout'

/**
 * Los dos menús ofrecen lo mismo: el de la web y el panel de dentro del visor.
 *
 * Hoy es verdad porque los dos recorren **las mismas listas** —modos, dificultades, manos—,
 * así que añadir una opción aparece en los dos sin tocar nada. Donde no lo recorren es en lo
 * que el panel resuelve con un **interruptor de dos estados**: ahí el panel no cuenta las
 * opciones, las supone. Mientras sean dos da igual; a la tercera, la web la ofrecería y
 * dentro del visor no habría forma de elegirla —y dentro del visor es donde nadie prueba—.
 *
 * Esto no arregla eso: avisa el día que pase, que es lo que faltaba.
 */

describe('lo que el panel del visor resuelve con un interruptor', () => {
  it('el del escenario asume que hay dos y solo dos', () => {
    expect(
      SCENERIES.length,
      'hay más escenarios que estados tiene el interruptor: el panel tiene que pasar a recorrer la lista',
    ).toBe(2)
  })
})

describe('los modos, en los dos menús', () => {
  // La web pinta un botón por cada modo de `GAME_MODE_ORDER` (`StartScreen.test.tsx` pulsa el del
  // duelo); el panel del visor, una caja por modo. Un modo sin caja se ofrecería en la web y no
  // dentro del visor, que es donde el duelo se juega pasándose el mando.
  it('cada modo tiene su botón en el panel del visor, el duelo también', () => {
    expect(GAME_MODE_ORDER).toContain('duel')
    for (const mode of GAME_MODE_ORDER) expect(MENU_BOXES[`modo ${mode}`], mode).toBeDefined()
  })

  it('y caben en la fila sin pisarse ni salirse del panel', () => {
    const xs = GAME_MODE_ORDER.map((mode) => MENU_BOXES[`modo ${mode}`].position[0])
    const ancho = MENU_BUTTON.mode[0]
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThan(ancho)
    expect(Math.max(...xs.map(Math.abs)) + ancho / 2).toBeLessThan(MENU_PANEL.width / 2)
  })
})
