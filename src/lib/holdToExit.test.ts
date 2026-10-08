import { describe, expect, it } from 'vitest'

import { EXIT_BUTTONS, HOLD_IDLE, HOLD_TO_EXIT_SECONDS, holdStep, type HoldToExit } from './holdToExit'

/**
 * La pulsación larga que saca del juego: la misma cuenta que el salón
 * (`xrcade/src/lib/salon/holdToExit.test.ts` y `godot/tests/test_hold_to_exit.gd`).
 */

/** Sostiene (o no) durante `seconds` a 72 Hz, y cuenta cuántas veces se disparó. */
function hold(pressed: boolean, seconds: number, from: HoldToExit = HOLD_IDLE) {
  let state = from
  let fired = 0
  let progress = 0
  for (let t = 0; t < seconds; t += 1 / 72) {
    const step = holdStep(state, pressed, 1 / 72)
    state = step.state
    progress = step.progress
    if (step.exit) fired += 1
  }
  return { state, fired, progress }
}

describe('mantener para salir', () => {
  it('un toque corto no saca del juego, y el aro va por la mitad', () => {
    const { fired, progress } = hold(true, HOLD_TO_EXIT_SECONDS * 0.5)
    expect(fired).toBe(0)
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
  })

  it('sostenido el tiempo entero dispara una sola vez, y el aro se va', () => {
    const { fired, progress } = hold(true, HOLD_TO_EXIT_SECONDS * 2)
    expect(fired).toBe(1)
    expect(progress).toBe(0)
  })

  it('soltar pone la cuenta a cero', () => {
    const { state } = hold(true, HOLD_TO_EXIT_SECONDS * 0.8)
    expect(holdStep(state, false, 1 / 72)).toEqual({ state: HOLD_IDLE, progress: 0, exit: false })
    expect(hold(true, HOLD_TO_EXIT_SECONDS * 0.8, HOLD_IDLE).fired).toBe(0)
  })

  it('tras disparar hay que soltar para repetir, y un reloj roto no cuenta', () => {
    const { state } = hold(true, HOLD_TO_EXIT_SECONDS * 1.5)
    expect(holdStep(state, true, 1).exit).toBe(false)
    expect(holdStep(HOLD_IDLE, true, Number.NaN).state.held).toBe(0)
    expect(holdStep(HOLD_IDLE, true, -1).state.held).toBe(0)
  })
})

describe('los botones', () => {
  it('son el B y el Y, como en el salón', () => {
    expect(EXIT_BUTTONS).toEqual(['b-button', 'y-button'])
  })
})
