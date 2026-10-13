/**
 * The automatic player: where it takes the mallet to play against the machine with nobody there.
 *
 * It serves to check without a headset or a mouse that the scene and the logic are well stitched
 * together, to measure the cost per frame and for a test to play a whole match to the end. It does
 * not aim to play well: it aims for goals on both sides and for the match to end. With the fixed
 * clock (`--fixed-fps`) and the table's seed, it always plays the same match.
 *
 * The rule is that of anyone starting out: with the puck in its half, get **behind** it (between
 * the puck and its own goal) and push it forward; if the mallet has ended up ahead of the puck, go
 * round it on one side instead of pushing it toward its own goal; with the puck in the other half,
 * go back to defend in front of the goal, lined up with it.
 */
import { MALLET_RADIUS, PLAYER_MALLET_SPEED, PUCK_RADIUS } from '@/lib/gameConfig'
import type { TableState } from '@/lib/matchLoop'
import { HALF_LENGTH, constrainMallet, type Vec2 } from '@/lib/puckPhysics'

/** How far the mallet keeps from the puck when going round it, in metres. */
const DETOUR = MALLET_RADIUS + PUCK_RADIUS + 0.04

/** Where the automatic player's mallet wants to go with the table like this. */
export function botTarget({ puck, player }: Pick<TableState, 'puck' | 'player'>): Vec2 {
  const p = puck.position
  const m = player.position
  // The puck in the other half: defend, in front of the goal and lined up with it.
  if (p.z < -0.02) return constrainMallet({ x: p.x * 0.5, z: HALF_LENGTH - 0.28 }, 'player')
  // The mallet has ended up ahead of the puck: go round it on the side it is already on.
  if (m.z < p.z + MALLET_RADIUS * 0.5) {
    const side = m.x >= p.x ? 1 : -1
    return constrainMallet({ x: p.x + side * DETOUR, z: p.z + DETOUR }, 'player')
  }
  // Behind the puck: go through it forward, which is what sends it to the other goal.
  return constrainMallet({ x: p.x, z: p.z - 0.1 }, 'player')
}

/**
 * Takes one point toward another without going over the mallet's speed: it is the hand of the
 * automatic player with a headset, which cannot jump from one side of the table to the other in a
 * frame (the mallet in the hand hits with the speed of the hand).
 */
export function approach(from: Vec2, to: Vec2, delta: number, speed = PLAYER_MALLET_SPEED * 0.8): Vec2 {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  const step = speed * delta
  if (d <= step || d === 0) return to
  return { x: from.x + (dx / d) * step, z: from.z + (dz / d) * step }
}
