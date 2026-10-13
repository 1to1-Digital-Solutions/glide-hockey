/**
 * The hall's menu template: what the game is called in its menu, in what order the rows go and
 * where the menu spawns in the headset.
 *
 * It is the same file in every game, next to `menuWords.ts`, and for the same reason: each game
 * ordered Modo / Contra quién / A dos / Dificultad differently, «Reto» went in four places of the
 * menu, the menu was called «Axe» or «Pins» when the cabinet said «Axe Throwing» or «Bowling», and
 * it spawned 60° away from the gaze in one game and straight ahead in the one next to it. Whoever
 * goes from one cabinet to another has to find the same menu.
 *
 * **How it is used.**
 *
 * - **The name.** The scene receives `name` from the hall (the `name` of the manifest) and sets it
 *   with `setGameName(name)` when it mounts, like `setAssetsBase`; the headset menu, the cover and
 *   the `<title>` of the web say `gameName()`. Without the hall —the game's own web— it is the
 *   `name` of its `package.json` capitalised: `axe-throwing` is «Axe Throwing», which is what the
 *   catalogue calls it. In Godot `main.ts` sets it with the kit's `base.nombre()` (the `game_name`
 *   metadata). It is a proper name: it is not translated.
 * - **The rows.** First «Modo» (`MENU_EN.mode`), with the challenge, the one that gives a medal,
 *   the first of its options (`challengeFirst`); then «Jugadores» (`MENU_EN.players`), solo or
 *   two-player; and the rest behind «Más opciones», folded until it is asked for (`foldRows`). The
 *   challenge is a fixed run, so with it chosen what is folded is not shown even if it is asked
 *   for: there is nothing to choose that counts.
 * - **Where it spawns.** The headset menu spawns at `MENU_DEGREES` or less from the front of
 *   whoever plays and moves aside on start. The menu guard of each game (`xrLayout`/`menuLayout`)
 *   measures it with `degreesFromFront` on the place of the panel in the menu phase.
 *
 * With nothing of the browser or of the engine: it is ported to Godot as is.
 */

import pkg from '../../package.json'

/** The name the hall has passed, or `null` in the game's own web. */
let fromHall: string | null = null

/** The scene calls it when it mounts with the `name` prop (or `main.ts` in Godot with `base.nombre()`). */
export function setGameName(name: string | null | undefined): void {
  fromHall = typeof name === 'string' && name.trim() !== '' ? name.trim() : null
}

/** The name from the id of the package: each word capitalised, without hyphens. */
export function nameFromId(id: string): string {
  return id
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

/** What the game is called in its menu: the name of the hall's cabinet, or that of its package. */
export function gameName(): string {
  return fromHall ?? nameFromId(pkg.name)
}

/** What role a row of the menu has in the template. */
export type RowRole = 'mode' | 'players' | 'other'

/** What is shown of the menu: the rows, already in order, and how many stay behind «Más opciones». */
export interface FoldedRows<F> {
  rows: F[]
  /** The ones that are not shown; with zero, the menu does not carry the «Más opciones» button. */
  folded: number
}

/**
 * The rows of the menu in the order of the template: «Modo», «Jugadores» and the rest, each group in
 * the order it came in. The rest only with `moreOptions` (whoever plays has asked for it) and never
 * with the challenge chosen (`inChallenge`): it is a fixed run.
 */
export function foldRows<F>(
  rows: readonly F[],
  role: (row: F) => RowRole,
  { moreOptions, inChallenge = false }: { moreOptions: boolean; inChallenge?: boolean },
): FoldedRows<F> {
  const withRole = (which: RowRole) => rows.filter((row) => role(row) === which)
  const main = [...withRole('mode'), ...withRole('players')]
  const others = inChallenge ? [] : withRole('other')
  return moreOptions ? { rows: [...main, ...others], folded: 0 } : { rows: main, folded: others.length }
}

/** The options of the «Modo» row with the challenge, the one that gives a medal, first; the rest, as they came. */
export function challengeFirst<O>(options: readonly O[], isChallenge: (option: O) => boolean): O[] {
  return [...options.filter(isChallenge), ...options.filter((option) => !isChallenge(option))]
}

/** The most the headset menu moves away from the front when it spawns, in degrees. */
export const MENU_DEGREES = 30

/**
 * How far a place is from the front of whoever plays, in degrees and horizontally: the angle between
 * −Z (ahead) and the place seen from above, unsigned. The coordinates, from the feet, like those of
 * the panels (`[right, height, depth]`). What is behind is at more than 90°.
 */
export function degreesFromFront([x, , z]: readonly [number, number, number]): number {
  return (Math.atan2(Math.abs(x), -z) * 180) / Math.PI
}
