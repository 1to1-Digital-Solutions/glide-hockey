'use client'

import { GlideHockey } from '@/game'

/**
 * The game's website: a wrapper that gives it the whole screen and little else.
 * The game lives in `src/game` and mounts the same here as inside another
 * application (see `docs/mounting-the-game.md`), so this page is also the way to
 * develop it and to try it with the headset.
 */
export default function Home() {
  // A `div` and not a `main`: the game itself already marks its menu as `main`,
  // and nesting two landmarks leaves the screen reader with the same one twice.
  return (
    <div className="h-dvh w-full">
      <GlideHockey />
    </div>
  )
}
