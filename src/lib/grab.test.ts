import { describe, expect, it } from 'vitest'

import { grabStep, startGrab, stepGrab } from './agarre'

/**
 * Las dos formas de sujetar lo que se coge.
 *
 * `hold` es el gesto de siempre y no puede cambiar ni un fotograma: es lo que enseña el
 * tutorial y lo que hace todo el mundo. `toggle` existe para quien no puede mantener el
 * gatillo apretado el gesto entero, y lo que hay que probar de él es justo lo que se
 * equivoca al escribirlo: que **soltar el botón no cuente**, porque si contara el mismo
 * toque cogería y soltaría, y no se podría coger nada.
 */

describe('manteniendo el gatillo', () => {
  it('apretar coge y soltar suelta', () => {
    expect(grabStep(true, false, 'hold')).toBe('take')
    expect(grabStep(false, true, 'hold')).toBe('release')
  })

  it('y lo que no viene a cuento no hace nada', () => {
    // Apretar con algo ya en la mano, o soltar con la mano vacía: pasa cuando el botón
    // repite el evento o cuando el juego no dejaba coger todavía.
    expect(grabStep(true, true, 'hold')).toBe('nothing')
    expect(grabStep(false, false, 'hold')).toBe('nothing')
  })
})

describe('con un toque', () => {
  it('un toque coge y el siguiente suelta', () => {
    expect(grabStep(true, false, 'toggle')).toBe('take')
    expect(grabStep(true, true, 'toggle')).toBe('release')
  })

  it('soltar el botón no cuenta', () => {
    // Es todo el asunto: contando el evento de soltar, el primer toque cogería y soltaría
    // en el mismo gesto y no se podría jugar.
    expect(grabStep(false, false, 'toggle')).toBe('nothing')
    expect(grabStep(false, true, 'toggle')).toBe('nothing')
  })

  it('un gesto entero: coger, mover y soltar, sin mantener nada', () => {
    let holding = false
    const pasos: string[] = []
    // Apretar y soltar el botón, dos veces: es lo que hace la mano de verdad.
    for (const pressed of [true, false, true, false]) {
      const paso = grabStep(pressed, holding, 'toggle')
      if (paso === 'take') holding = true
      if (paso === 'release') holding = false
      pasos.push(paso)
    }

    expect(pasos).toEqual(['take', 'nothing', 'release', 'nothing'])
    expect(holding).toBe(false)
  })
})

describe('mirando el botón en cada fotograma', () => {
  /** Corre unos cuantos fotogramas con el botón como se le diga. */
  function fotogramas(botones: boolean[], mode: 'hold' | 'toggle') {
    let state = startGrab()
    const llevado: boolean[] = []
    for (const pressed of botones) {
      state = stepGrab(state, pressed, mode)
      llevado.push(state.holding)
    }
    return llevado
  }

  it('manteniendo, se lleva algo exactamente mientras el botón esté apretado', () => {
    expect(fotogramas([false, true, true, true, false, false], 'hold')).toEqual([
      false, true, true, true, false, false,
    ])
  })

  it('con un toque, lo que cuenta es que el botón pase a estar apretado', () => {
    // Un toque son varios fotogramas con el botón apretado, no uno: sin mirar el flanco,
    // el agarre se encendería y apagaría a noventa por segundo.
    expect(fotogramas([false, true, true, true, false, false], 'toggle')).toEqual([
      false, true, true, true, true, true,
    ])
  })

  it('y el toque siguiente lo suelta', () => {
    expect(fotogramas([true, false, true, false], 'toggle')).toEqual([
      true, true, false, false,
    ])
  })

  it('empieza con la mano vacía', () => {
    expect(startGrab()).toEqual({ holding: false, wasPressed: false })
  })
})
