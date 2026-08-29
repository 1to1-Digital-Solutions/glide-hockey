import { afterEach, describe, expect, it } from 'vitest'
import {
  isSceneProbeRequested,
  publishSceneProbe,
  screenPointFromNdc,
  type SceneProbe,
} from './sceneProbe'

/** El canvas de un navegador de 1280×720 con el juego a pantalla completa. */
const CANVAS = { left: 0, top: 0, width: 1280, height: 720 }

/** Una foto cualquiera de la mesa: aquí solo importa que se publique entera. */
const FOTO: SceneProbe = {
  playerMallet: { x: 0, z: 0.72 },
  puck: { x: 0, z: 0 },
  puckScreen: { x: 640, y: 300 },
  playerHits: 2,
}

describe('screenPointFromNdc', () => {
  it('lleva el centro de la escena al centro del canvas', () => {
    expect(screenPointFromNdc(0, 0, CANVAS)).toEqual({ x: 640, y: 360 })
  })

  it('da la vuelta a la Y: arriba en three es arriba en la pantalla', () => {
    // En coordenadas normalizadas la Y crece hacia arriba; en la página, hacia
    // abajo. Sin la inversión, apuntar al fondo de la mesa movería el mazo al
    // borde de acá.
    expect(screenPointFromNdc(0, 1, CANVAS).y).toBe(0)
    expect(screenPointFromNdc(0, -1, CANVAS).y).toBe(720)
  })

  it('lleva las esquinas a las esquinas', () => {
    expect(screenPointFromNdc(-1, 1, CANVAS)).toEqual({ x: 0, y: 0 })
    expect(screenPointFromNdc(1, -1, CANVAS)).toEqual({ x: 1280, y: 720 })
  })

  it('cuenta desde donde empieza el canvas, no desde la página', () => {
    // Montado dentro de otra aplicación el juego no tiene por qué ocupar la
    // pantalla entera: el punto que se publica es el que traería un evento de
    // puntero, y ese va en coordenadas de la página.
    const empotrado = { left: 100, top: 40, width: 800, height: 600 }

    expect(screenPointFromNdc(0, 0, empotrado)).toEqual({ x: 500, y: 340 })
  })
})

describe('publishSceneProbe', () => {
  afterEach(() => {
    delete window.__airHockeyScene
  })

  it('no crea la ranura: sin pedirla, la escena no toca la ventana', () => {
    publishSceneProbe(FOTO)

    expect(isSceneProbeRequested()).toBe(false)
    expect('__airHockeyScene' in window).toBe(false)
  })

  it('publica la foto de la mesa cuando la ranura existe', () => {
    window.__airHockeyScene = null

    publishSceneProbe(FOTO)

    expect(window.__airHockeyScene).toEqual(FOTO)
  })
})
