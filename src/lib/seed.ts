/**
 * The challenge's randomness, seeded: what makes two people play the same run.
 *
 * It is the same file in every game of the hall (`comunes.py` watches over it). The hall passes
 * the scene a `challenge` with a seed —the challenge of the day, or the code of «reta mi
 * puntuación»— and everything the challenge draws comes from here instead of `Math.random`: which
 * clay comes out, where the machine throws, when the mole peeks out. Same seed, same run.
 *
 * Everything is pure: no React, no three, no clock. In Godot, the same algorithm gives the same
 * numbers.
 */

/** What the hall passes the scene to play one specific challenge. */
export type Challenge = {
  /** Unsigned 32-bit integer. */
  readonly seed: number
}

/** What the scene tells the hall when a run with a score ends. */
export type GameResult = {
  /** The mode as the game calls it (`challenge`, `classic`, `match`…). */
  readonly mode: string
  /** The points of this run, even if they are not a record, in the unit of the manifest's record. */
  readonly points: number
  /** Whether the run was the `challenge` the hall passed. */
  readonly challenge: boolean
  /**
   * The feats achieved for the first time in this run, by their Steam API name
   * (`docs/logros-de-steam.md` of the hall). Optional because most runs unlock none and there
   * are games that have none: the hall is the one that filters, stores and announces them.
   */
  readonly feats?: readonly string[]
}

/**
 * A generator of numbers in [0, 1) from a seed (mulberry32).
 *
 * Mulberry32 because it is short, fast and was already the one used by the games that seeded
 * something: it passes the statistical tests that matter for drawing clays and moles, which is
 * not cryptography.
 */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A seed derived from another one and from a few integers (the round, the stick number…).
 *
 * So that each round of the challenge has its own randomness without depending on how many
 * numbers were drawn in the previous one: if one player misses and the other does not, the next
 * round is still the same for both. It mixes with Knuth's constant and one step of mulberry32,
 * which spreads consecutive seeds well.
 */
export function deriveSeed(seed: number, ...parts: readonly number[]): number {
  let h = seed >>> 0
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x9e3779b1) >>> 0
    h = (h ^ (h >>> 16)) >>> 0
  }
  return Math.floor(randomFrom(h)() * 4294967296) >>> 0
}

/** A new seed for when there is no challenge: the normal run is still different every time. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0
}
