'use client'

import { GoalSign, signAspect } from '../xr/GoalSign'
import { signPlacement } from '../../lib/scoreboardSign'
import { useGame } from '../../lib/gameStore'
import type { Medal } from '../../lib/goal'

/**
 * Where the sign hangs, with the measurements of the real sign: above the back scoreboard
 * (`signPlacement`). Outside the component so that the tests measure it where it ends up.
 */
export const SIGN_PLACEMENT = signPlacement(signAspect())

/**
 * The goal sign, hung above the back scoreboard.
 *
 * Here only what comes from each side is put together: what it says comes from the store
 * (`sign`), where it goes is decided by `signPlacement` and it is drawn by the component common
 * to all the games of the hall.
 *
 * It hangs from the interface, next to the scoreboard: it goes up and down with the eyes of
 * whoever plays just as the scoreboard does (`XRUiHeight`), so it still ends up right above it
 * and at eye level.
 *
 * @param onCelebrate What the game does on crossing a threshold: the hit in the mallet hand. The
 *   sound is provided by the scene, which is also heard by whoever plays without a headset.
 */
export function ScoreboardSign({ onCelebrate }: { onCelebrate?: (medal: Medal) => void }) {
  const { sign, medal } = useGame()

  if (sign == null) return null

  return (
    <GoalSign
      view={sign}
      position={SIGN_PLACEMENT.position}
      rotation={SIGN_PLACEMENT.rotation}
      distance={SIGN_PLACEMENT.distance}
      celebrate={medal}
      onCelebrate={onCelebrate}
    />
  )
}
