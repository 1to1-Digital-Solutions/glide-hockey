import { describe, expect, it } from 'vitest'
import { GOAL_AGAINST_STRENGTH, goalAgainstDirection } from './goalAgainst'
import { HALF_LENGTH } from './puckPhysics'

describe('the goal against as hit feedback', () => {
  it('is a weak hit: nobody has touched you', () => {
    expect(GOAL_AGAINST_STRENGTH).toBeGreaterThan(0)
    expect(GOAL_AGAINST_STRENGTH).toBeLessThanOrEqual(0.3)
  })

  it('comes from the own goal: in front of and below whoever defends it', () => {
    // Standing behind the goal, with the eyes half a metre above the board.
    const d = goalAgainstDirection({ x: 0.2, y: 0.5, z: HALF_LENGTH + 0.4 })
    expect(d.x).toBeCloseTo(-0.2)
    expect(d.y).toBeCloseTo(-0.5)
    // Towards the table: −Z from behind the goal.
    expect(d.z).toBeCloseTo(-0.4)
  })
})
