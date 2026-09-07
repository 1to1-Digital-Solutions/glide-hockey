import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SCENERY,
  SCENERY_HINTS,
  SCENERY_IDS,
  SCENERY_KEY,
  SCENERY_LABELS,
  getScenery,
  getServerScenery,
  parseScenery,
  saveScenery,
  showsPlace,
  subscribeScenery,
} from './scenery'

/**
 * Qué se pinta alrededor.
 *
 * Lo importante es que se pueda cambiar **sin salir de la sesión**: con el
 * visor puesto, salir y volver a entrar para ver la habitación es justo lo que
 * hace que nadie lo use. Y que se recuerde, para no tener que volver a
 * elegirlo cada vez que uno se pone las gafas.
 */

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('cuándo se pinta la sala', () => {
  it('en el navegador, siempre: no hay habitación que enseñar', () => {
    for (const scenery of SCENERY_IDS) {
      expect(showsPlace(null, scenery), scenery).toBe(true)
      expect(showsPlace(undefined, scenery), scenery).toBe(true)
    }
  })

  it('en realidad virtual, también: el visor no da el passthrough ahí', () => {
    // Quitar la sala en una sesión de realidad virtual dejaría los platos
    // volando en el vacío, que no es lo que pide quien elige «tu habitación».
    for (const scenery of SCENERY_IDS) {
      expect(showsPlace('immersive-vr', scenery), scenery).toBe(true)
    }
  })

  it('en realidad aumentada manda lo elegido', () => {
    expect(showsPlace('immersive-ar', 'place')).toBe(true)
    expect(showsPlace('immersive-ar', 'room')).toBe(false)
  })
})

describe('lo que se recuerda', () => {
  it('se entra con la sala, que es lo que se ve en cualquier pantalla', () => {
    expect(DEFAULT_SCENERY).toBe('place')
    expect(getScenery()).toBe('place')
    expect(getServerScenery()).toBe('place')
  })

  it('lo elegido sobrevive a la visita', () => {
    // Es lo que evita tener que quitar la sala cada vez que uno se pone las
    // gafas, deshaciendo algo que ya había decidido.
    saveScenery('room')

    expect(getScenery()).toBe('room')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')
  })

  it('avisa a quien lo mira cuando cambia', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeScenery(listener)

    saveScenery('room')
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })

  it('lo guardado es entrada externa: solo el valor exacto cuenta', () => {
    for (const raw of [null, '', 'prado', 'Room', 'passthrough']) {
      expect(parseScenery(raw), String(raw)).toBe('place')
    }
    expect(parseScenery('room')).toBe('room')
  })
})

describe('cómo se ofrece', () => {
  it('los dos sitios tienen nombre y explicación', () => {
    for (const scenery of SCENERY_IDS) {
      expect(SCENERY_LABELS[scenery]).not.toBe('')
      expect(SCENERY_HINTS[scenery]).not.toBe('')
    }
  })

  it('avisa de que la habitación solo se ve con el visor', () => {
    // En el navegador la opción está y no hace nada: sin decirlo, se lee como
    // que el juego está roto.
    expect(SCENERY_HINTS.room).toMatch(/visor/)
  })
})
