import { describe, expect, it } from 'vitest'
import { exitProblems, type PanelBox } from './exitCorner'
import { MENU_BOXES, MENU_PANEL } from './xrMenuLayout'

import { DIFFICULTY_ORDER } from './gameConfig'
import { LEVEL_BAR_BOTTOM, LEVEL_BUTTON, levelBarHeight } from './xrMenuLayout'

/**
 * Las barras del nivel caben en su botón.
 *
 * La más alta se salía por arriba: el alto era un número escrito a mano y con cinco niveles
 * pasaba del borde. Dentro del visor eso es una barra flotando por delante del panel, y no
 * se ve en ninguna pantalla.
 */
describe('las barras del nivel', () => {
  const niveles = DIFFICULTY_ORDER.length

  it('ninguna se sale de su botón', () => {
    for (let index = 0; index < niveles; index += 1) {
      expect(LEVEL_BAR_BOTTOM + levelBarHeight(index), `nivel ${index}`).toBeLessThanOrEqual(
        LEVEL_BUTTON[1] / 2,
      )
    }
  })

  it('crecen de una a la siguiente, que es lo que se lee', () => {
    // Sin esto caben todas porque miden lo mismo, y entonces no dicen nada.
    for (let index = 1; index < niveles; index += 1) {
      expect(levelBarHeight(index)).toBeGreaterThan(levelBarHeight(index - 1))
    }
  })

  it('un nivel más encoge el escalón en vez de desbordar', () => {
    expect(LEVEL_BAR_BOTTOM + levelBarHeight(niveles, niveles + 1)).toBeLessThanOrEqual(
      LEVEL_BUTTON[1] / 2,
    )
  })

  it('con un solo nivel la barra ocupa lo que hay', () => {
    expect(LEVEL_BAR_BOTTOM + levelBarHeight(0, 1)).toBeLessThanOrEqual(LEVEL_BUTTON[1] / 2)
  })
})


/**
 * Dónde cae la salida, que hasta ahora dependía del juego.
 *
 * La regla —abajo a la derecha, al final de la fila de las acciones— y el porqué están en
 * `exitCorner.ts`, el mismo fichero en los trece. Aquí solo se le da el reparto de ESTE panel,
 * traducido a lo que la regla sabe leer.
 */
describe('la salida', () => {
  const comoCaja = (nombre: string): PanelBox => {
    const { position, size } = MENU_BOXES[nombre]
    return { x: position[0], y: position[1], width: size[0], height: size[1] }
  }

  it('está en la esquina de abajo a la derecha del panel de ajustes', () => {
    const nombres = Object.keys(MENU_BOXES)

    expect(
      exitProblems(
        comoCaja('salir'),
        nombres.filter((nombre) => nombre !== 'salir').map(comoCaja),
        { width: MENU_PANEL.width, height: MENU_PANEL.height },
      ),
    ).toEqual([])
  })
})
