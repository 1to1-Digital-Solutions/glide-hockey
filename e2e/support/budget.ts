import pkg from '../../package.json'

/**
 * The budget of draw calls per frame that the game declares in its manifest:
 * `xrcade.budget.drawCalls` of its `package.json`, phase by phase.
 *
 * **Why it is not written in the spec.** The ceilings lived as `const TECHO_… = 45` in each e2e,
 * with nobody else able to read them: neither the hall, which had its own separate table, nor
 * whoever wanted to know how much a game paints without opening its tests. Now they are a piece
 * of data of the manifest, next to `xrcade.capabilities`, and the hall checks that they are well
 * written in `npm run catalog:validate` (`xrcade/src/lib/catalog/budget.ts`, which is where the
 * format is). The why of each figure —the breakdown of what is painted— stays in the spec that
 * measures it.
 *
 * Each phase accepts three forms:
 * - a number: the ceiling;
 * - `{ "min", "max" }`: a band, when what is measured depends on the physics or on the pace;
 * - `{ "measured", "margin" }`: the measurement pinned with its margin, which is what warns that
 *   the breakdown of the spec has gone stale.
 *
 * It is the same file in every game (`organizate/scripts/repos/comunes.py`).
 */

/** A limit already resolved: the ceiling, the floor (zero if the phase has none) and the measurement if any. */
export interface DrawCallLimit {
  min: number
  max: number
  measured?: number
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** The limit of a phase, just as the `package.json` declares it. Fails if missing or not valid. */
export function drawCallBudget(phase: string): DrawCallLimit {
  const raw: unknown = pkg
  const phases = (raw as { xrcade?: { budget?: { drawCalls?: Record<string, unknown> } } }).xrcade?.budget?.drawCalls
  const limit = phases?.[phase]
  const where = `xrcade.budget.drawCalls.${phase} of package.json`
  if (isCount(limit) && limit > 0) return { min: 0, max: limit }
  if (typeof limit === 'object' && limit !== null) {
    const { min, max, measured, margin } = limit as Record<string, unknown>
    if (isCount(min) && isCount(max) && min <= max) return { min, max }
    if (isCount(measured) && isCount(margin) && margin <= measured) {
      return { min: measured - margin, max: measured + margin, measured }
    }
  }
  throw new Error(
    limit === undefined
      ? `${where} is missing: the budget of this phase is declared in the game's manifest`
      : `${where} is not a ceiling, { "min", "max" } nor { "measured", "margin" }`,
  )
}
