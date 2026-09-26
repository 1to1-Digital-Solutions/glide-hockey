import { describe, expect, it } from 'vitest'

import { MAX_PUCK_SPEED } from './gameConfig'
import { STALL_SPEED } from './puckPhysics'
import { SLIDE_MAX_LEVEL, SLIDE_PITCH_MAX, SLIDE_PITCH_MIN, slideLevel, slidePitch } from './slideSound'

// Las mismas cuentas mueven la voz de la web y el bucle de Godot: aquí se fijan sus extremos, que
// es donde el port renderiza su bucle (a la velocidad máxima) y desde donde lo escala.
describe('el roce del disco', () => {
  it('parado no suena y a la velocidad máxima llega a su tope, sin pasarlo', () => {
    expect(slideLevel(STALL_SPEED)).toBe(0)
    expect(slideLevel(MAX_PUCK_SPEED)).toBeCloseTo(SLIDE_MAX_LEVEL, 12)
    expect(slideLevel(MAX_PUCK_SPEED * 2)).toBe(slideLevel(MAX_PUCK_SPEED))
  })

  it('el tono va de un extremo de la banda al otro', () => {
    expect(slidePitch(0)).toBe(SLIDE_PITCH_MIN)
    expect(slidePitch(MAX_PUCK_SPEED)).toBe(SLIDE_PITCH_MAX)
    expect(slidePitch(-1)).toBe(SLIDE_PITCH_MIN)
  })
})
