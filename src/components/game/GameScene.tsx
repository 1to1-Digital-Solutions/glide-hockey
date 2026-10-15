'use client'

import { Suspense, lazy, useSyncExternalStore } from 'react'
import { useGame } from '../../lib/gameStore'
import { GLIDE_HOCKEY_CSS_VARIABLES } from '../../lib/palette'
import { HUD } from '../ui/HUD'
import { StartScreen } from '../ui/StartScreen'
import { useLang } from '../../lib/settingsClient'
import { translator } from '../../lib/textos'

// R3F's Canvas depends on WebGL and on `window`, so it is loaded separately
// and only on the client. With React's `lazy` and not with `next/dynamic`: the
// game is also mounted inside other applications, which need not be Next.
const GameCanvas = lazy(() =>
  import('./GameCanvas').then((mod) => ({ default: mod.GameCanvas })),
)

/**
 * Whether the game is already being rendered in the browser.
 *
 * It is a subscription to something that never changes because what tells the
 * two values apart is *who* asks: in a server render there is no WebGL to mount
 * the Canvas with, and rendering on hydration the same thing that was
 * prerendered is what avoids the mismatch warning.
 */
const NEVER_CHANGES = () => () => {}
const useOnClient = () =>
  useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  )

function SceneLoading() {
  const t = translator(useLang())

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]">
      <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
        {t('Setting up the table…')}
      </p>
    </div>
  )
}

/**
 * The desktop game screen: the Canvas always mounted and, on top, the menu or
 * the scoreboard as appropriate.
 *
 * The Canvas is not unmounted on going back to the menu on purpose: the
 * immersive session is requested from the DOM and needs to find the scene
 * already in the tree, or on putting the headset on nothing is seen.
 */
export function GameScene() {
  const { gameState } = useGame()
  const onClient = useOnClient()

  return (
    <div
      // During the match the cursor carries the mallet: a desktop arrow on top
      // of the table distracts from where it really is.
      className={`glide-hockey relative h-full w-full ${
        gameState === 'playing' ? 'cursor-none' : ''
      }`}
      // The palette, here and not in `styles.css`: that way the CSS, the scene
      // and the headset interface read the same literals with no build step
      // (see `lib/palette.ts`). And on this element, which is the one carrying
      // the `.glide-hockey` class: the variables do not leave the game.
      style={GLIDE_HOCKEY_CSS_VARIABLES}
    >
      {onClient ? (
        <Suspense fallback={<SceneLoading />}>
          <GameCanvas />
        </Suspense>
      ) : (
        <SceneLoading />
      )}
      {gameState === 'menu' ? <StartScreen /> : <HUD />}
    </div>
  )
}
