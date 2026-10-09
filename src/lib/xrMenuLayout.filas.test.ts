import { describe, expect, it } from 'vitest'

import {
  MENU_PANEL,
  MENU_ROW,
  MENU_ROW_HEIGHT,
  MENU_ROW_LABEL_RISE,
  MENU_ROW_LABEL_SIZE,
} from './xrMenuLayout'

/**
 * Que el menú del visor se pueda leer.
 *
 * Es lo que **no se ve en ninguna pantalla**: con el ratón el panel se mira de frente y de
 * cerca, y con el visor puesto se lee a medio metro y a pulso. El fallo que esto vigila se
 * reportó así: «he abierto el menú de la config y todas las letras se ven solapadas, por lo
 * que no me ayuda». El nombre de una fila se pintaba dentro de la fila de arriba.
 */

type Banda = { nombre: string; abajo: number; arriba: number }

/** Cada fila con sus botones, y el nombre de la fila como su propia banda. */
function bandas(): Banda[] {
  const lista: Banda[] = []
  for (const [nombre, y] of Object.entries(MENU_ROW)) {
    const alto = MENU_ROW_HEIGHT[nombre as keyof typeof MENU_ROW]
    lista.push({ nombre, abajo: y - alto / 2, arriba: y + alto / 2 })
    // La banda del récord no lleva nombre: no hay nada que explicar. Y la del confort y la de
    // arriba («Más opciones») lo llevan en su misma línea: esos los mide `menu.legible.test.ts`
    // contra las cajas, que es donde se podrían pisar.
    if (nombre === 'record' || nombre === 'comfort' || nombre === 'title') continue
    const centro = y + MENU_ROW_LABEL_RISE
    lista.push({
      nombre: `nombre de ${nombre}`,
      abajo: centro - MENU_ROW_LABEL_SIZE / 2,
      arriba: centro + MENU_ROW_LABEL_SIZE / 2,
    })
  }
  return lista.sort((a, b) => b.arriba - a.arriba)
}

describe('las filas del menú del visor', () => {
  it('no se pisan unas a otras', () => {
    const lista = bandas()
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i].arriba, `${lista[i].nombre} se mete en ${lista[i - 1].nombre}`)
        .toBeLessThanOrEqual(lista[i - 1].abajo)
    }
  })

  it('caben todas dentro del panel', () => {
    for (const banda of bandas()) {
      expect(Math.abs(banda.arriba), banda.nombre).toBeLessThanOrEqual(MENU_PANEL.height / 2)
      expect(Math.abs(banda.abajo), banda.nombre).toBeLessThanOrEqual(MENU_PANEL.height / 2)
    }
  })
})
