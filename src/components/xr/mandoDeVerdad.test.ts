import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BoxGeometry, Group, Mesh, Object3D } from 'three'

import { COMPONENTE_DEL_BOTON, TUTORIAL_BUTTONS } from '../../lib/tutorial'
import { nodoDelBoton, sitioDelNodo } from './MandoDeVerdad'

/**
 * Que el mando que enseña el tutorial se pueda enseñar de verdad.
 *
 * Nada de esto se ve fallar jugando: si el identificador del botón no existe en el perfil, o
 * si el `.glb` no se copió, el tutorial **no avisa** —se queda sin modelo y sigue, que es lo
 * que tiene que hacer con un mando desconocido—. Así que se comprueba aquí, contra los
 * ficheros que de verdad se sirven.
 */

const PERFILES = join(process.cwd(), 'public/webxr-profiles')

/**
 * De qué mandos hay modelo servido.
 *
 * Se mira lo que hay y no se escribe la lista: la decide `scripts/sync-xr-profiles.mjs`, y
 * una copia aquí sería otra lista que mantener —y que se quedaría atrás justo el día que se
 * añada un mando—.
 */
const CON_MODELO = readdirSync(PERFILES).filter((id) =>
  existsSync(join(PERFILES, id, 'right.glb')),
)

function layoutDe(id: string, mano: 'left' | 'right') {
  const perfil = JSON.parse(readFileSync(join(PERFILES, id, 'profile.json'), 'utf8'))
  return perfil.layouts[mano]
}

describe('el modelo del mando servido con el juego', () => {
  it('está el del visor del arcade', () => {
    // Sin esto, el juego pasaría los tests sin haber ejecutado nunca `sync:xr-profiles`, y el
    // tutorial se quedaría sin modelo también en el visor con el que se prueba.
    expect(CON_MODELO).toContain('meta-quest-touch-plus')
  })

  it.each(CON_MODELO)('%s viaja con las dos manos', (id) => {
    expect(existsSync(join(PERFILES, id, 'left.glb'))).toBe(true)
    expect(existsSync(join(PERFILES, id, 'right.glb'))).toBe(true)
  })
})

describe('qué pieza del modelo se enciende', () => {
  it.each(CON_MODELO)('en %s, cada botón de la lección tiene su nodo', (id) => {
    for (const mano of ['left', 'right'] as const) {
      const layout = layoutDe(id, mano)
      for (const boton of Object.values(TUTORIAL_BUTTONS)) {
        if (boton == null) continue
        expect(nodoDelBoton(layout, COMPONENTE_DEL_BOTON[boton])).toBeTruthy()
      }
    }
  })

  it('un mando sin ese botón no da nodo, y el tutorial se queda con el dibujo', () => {
    const layout = layoutDe('generic-trigger', 'right')
    expect(nodoDelBoton(layout, COMPONENTE_DEL_BOTON.gatillo)).toBeTruthy()
    expect(nodoDelBoton(layout, COMPONENTE_DEL_BOTON.agarre)).toBeNull()
  })

  it('no es `rootNodeName`, que es lo que parece y en Quest no está en el modelo', () => {
    // El control del fallo: el primer intento buscó la pieza por ahí y no la encontró nunca.
    const layout = layoutDe('meta-quest-touch-plus', 'right')
    const componente = layout.components[COMPONENTE_DEL_BOTON.agarre]
    expect(nodoDelBoton(layout, COMPONENTE_DEL_BOTON.agarre)).not.toBe(componente.rootNodeName)
  })
})

describe('dónde se pone la marca dentro del modelo', () => {
  /** Un mando de mentira: el pivote lejos del botón, y el botón colgando de él. */
  function modeloDeMentira(): Object3D {
    const raiz = new Group()
    const pivote = new Object3D()
    pivote.name = 'boton_pressed_value'
    pivote.position.set(0, 0.013, -0.025)
    const boton = new Mesh(new BoxGeometry(0.01, 0.02, 0.01))
    boton.position.set(0, -0.013, 0.04)
    pivote.add(boton)
    raiz.add(pivote)
    return raiz
  }

  it('cae en la pieza, no en el pivote que la mueve', () => {
    // El control del fallo: marcando el nodo que nombra el perfil, la marca salía dos
    // centímetros y medio por delante del botón, arriba, al lado del joystick.
    const sitio = sitioDelNodo(modeloDeMentira(), 'boton_pressed_value')
    expect(sitio).not.toBeNull()
    expect(sitio!.centro.y).toBeCloseTo(0, 6)
    expect(sitio!.centro.z).toBeCloseTo(0.015, 6)
  })

  it('el halo se ajusta a lo que abulta la pieza', () => {
    const sitio = sitioDelNodo(modeloDeMentira(), 'boton_pressed_value')
    expect(sitio!.radio).toBeCloseTo(0.02 * 0.6, 6)
  })

  it('un nodo que no está en el modelo no da sitio', () => {
    expect(sitioDelNodo(modeloDeMentira(), 'no_existe')).toBeNull()
  })

  it('un nodo sin geometría debajo tampoco', () => {
    const raiz = new Group()
    const vacio = new Object3D()
    vacio.name = 'boton_pressed_value'
    raiz.add(vacio)
    expect(sitioDelNodo(raiz, 'boton_pressed_value')).toBeNull()
  })
})
