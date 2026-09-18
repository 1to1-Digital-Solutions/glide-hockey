import { describe, expect, it } from 'vitest'
import { SCENERIES } from './ajustes'

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
