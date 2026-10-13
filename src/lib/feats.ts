import { HALF_LENGTH, type Scorer } from './puckPhysics'
import type { GameResult } from './seed'
import { createStoredPreference } from './storage'

/**
 * The feats of Glide Hockey: what the game has to know so that the hall can award its skill
 * achievements and the hidden one (`xrcade/docs/logros-de-steam.md`, the ones marked with ➕).
 *
 * The game knows nothing about Steam or achievements: it records the first time someone manages
 * each thing and tells the hall when the match ends, with the API name the hall declares in
 * Steamworks. It is all pure arithmetic on what the table already says (who touches the puck,
 * where and who scores) and on the score, so the Godot port inherits it as is.
 *
 * - `GH_SHUTOUT`: winning a match without conceding a goal.
 * - `GH_LONG_SHOT`: scoring with a single touch from the back of your half.
 * - `GH_OWN_GOAL` (hidden): scoring in your own goal.
 */
export const FEATS = ['GH_SHUTOUT', 'GH_LONG_SHOT', 'GH_OWN_GOAL'] as const

export type Feat = (typeof FEATS)[number]

/** Where the ones already achieved are remembered. With the game's prefix, like the records. */
export const FEATS_KEY = 'glide-hockey:hazanas'

/** The result with its feats, or as is if none was earned for the first time. */
export function withFeats(result: GameResult, newFeats: readonly Feat[]): GameResult {
  return newFeats.length > 0 ? { ...result, feats: [...newFeats] } : result
}

/**
 * The feats of the stored text, in the order of `FEATS` and without repeats. It is external input
 * (it is edited by hand from the browser), so whatever is not a feat of this game is ignored.
 */
export function readFeats(text: string | null): Feat[] {
  const written = new Set((text ?? '').split(','))
  return FEATS.filter((feat) => written.has(feat))
}

/** The stored text, as is: comparable with `Object.is` (see `createStoredPreference`). */
const stored = createStoredPreference<string>({
  key: FEATS_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/** The ones already achieved at some point. */
export function storedFeats(): Feat[] {
  return readFeats(stored.get())
}

/**
 * Records the feats of a match and returns **only the ones earned for the first time**: the ones
 * already there are not told to the hall again. With no new one it writes nothing.
 */
export function earnFeats(achieved: Iterable<Feat>): Feat[] {
  const before = new Set(storedFeats())
  const now = new Set(achieved)
  const newFeats = FEATS.filter((feat) => now.has(feat) && !before.has(feat))
  if (newFeats.length > 0) {
    stored.save(FEATS.filter((feat) => before.has(feat) || now.has(feat)).join(','))
  }
  return newFeats
}

/**
 * What a finished match leaves: winning it without conceding. The endless match does not count
 * —the player closes it whenever they want and an abandoned 1-0 is not a match—, and neither does
 * the duel, which belongs to two.
 */
export function matchFeats({
  won,
  conceded,
  endless,
}: {
  won: boolean
  conceded: number
  endless: boolean
}): Feat[] {
  return won && !endless && conceded === 0 ? ['GH_SHUTOUT'] : []
}

/**
 * The possession under way, counted from the last serve: who touched the puck last and, if it was
 * the player, how many times in a row and from where.
 */
export interface Possession {
  /** Who touched the puck last, or `null` if nobody since the serve. */
  readonly last: Scorer | null
  /** Touches in a row by the player without the machine touching in between. */
  readonly touchesInARow: number
  /** Whether the first of those touches was with the puck at the back of their own half. */
  readonly fromTheBack: boolean
}

/** The possession just served: nobody has touched the puck. */
export const NEW_POSSESSION: Possession = { last: null, touchesInARow: 0, fromTheBack: false }

/**
 * From where a shot counts as a long one: the back half of your own half, closer to your goal
 * than to the centre line. The mallet does not cross that line, so «from your half» is any shot;
 * what takes skill is crossing the whole table with one touch.
 */
export const BACK_OF_OWN_HALF = HALF_LENGTH / 2

/**
 * A touch of a mallet on the puck. `z` is where the puck was, in table coordinates: the player's
 * half is the one of positive `z`.
 */
export function touch(possession: Possession, who: Scorer, z: number): Possession {
  if (who === 'opponent') return { last: 'opponent', touchesInARow: 0, fromTheBack: false }
  const first = possession.last !== 'player'
  return {
    last: 'player',
    touchesInARow: first ? 1 : possession.touchesInARow + 1,
    fromTheBack: first ? z >= BACK_OF_OWN_HALF : possession.fromTheBack,
  }
}

/**
 * The feat a goal leaves, depending on how the possession went: the player's one with a single
 * touch from the back, or the one the player puts into their own goal (the last touch was theirs).
 */
export function goalFeat(possession: Possession, goal: Scorer): Feat | null {
  if (possession.last !== 'player') return null
  if (goal === 'opponent') return 'GH_OWN_GOAL'
  return possession.touchesInARow === 1 && possession.fromTheBack ? 'GH_LONG_SHOT' : null
}
