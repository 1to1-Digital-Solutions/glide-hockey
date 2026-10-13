import { describe, expect, it } from 'vitest'
import { GOAL_AGAINST_STRENGTH, goalAgainstDirection } from './goalAgainst'
import { HALF_LENGTH } from './puckPhysics'

describe('el gol en contra como golpe recibido', () => {
  it('es un golpe flojo: nadie te ha tocado', () => {
    expect(GOAL_AGAINST_STRENGTH).toBeGreaterThan(0)
    expect(GOAL_AGAINST_STRENGTH).toBeLessThanOrEqual(0.3)
  })

  it('viene de la portería propia: delante y abajo de quien la defiende', () => {
    // De pie detrás de la portería, con los ojos medio metro por encima del tablero.
    const d = goalAgainstDirection({ x: 0.2, y: 0.5, z: HALF_LENGTH + 0.4 })
    expect(d.x).toBeCloseTo(-0.2)
    expect(d.y).toBeCloseTo(-0.5)
    // Hacia la mesa: −Z desde detrás de la portería.
    expect(d.z).toBeCloseTo(-0.4)
  })
})
