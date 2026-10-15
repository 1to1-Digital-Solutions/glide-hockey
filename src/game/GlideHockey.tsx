'use client'

import { useEffect } from 'react'
import { GameProvider } from '../components/GameProvider'
import { GameScene } from '../components/game/GameScene'
import { endXrSession } from '../components/xr/xrStore'
import { setAssetsBase } from '../lib/assets'
import type { GameResult, Challenge } from '../lib/seed'
import { ExitProvider } from './exit'

export interface GlideHockeyProps {
  /**
   * Where the game's static files hang from: the WebXR controller profiles,
   * without which the headset is left with no controllers. By default the root
   * of the site, which is where its own website serves them.
   */
  assetsBase?: string
  /** The challenge being played, as in `<GlideHockeyScene>`. */
  challenge?: Challenge
  /** Who to tell about each finished match, as in `<GlideHockeyScene>`. */
  onFinish?: (result: GameResult) => void
}

/**
 * The whole game **with its Canvas and its session**, ready to mount inside
 * any React application that wants a game page.
 *
 * It takes up whatever its container measures —give it a height— and knows
 * nothing about routes, layout or metadata: whoever mounts it decides where it
 * lives and what is around it.
 *
 * To mount it INSIDE a Canvas and a session that already exist —what the
 * immersive hall of xrcade does, and what allows going back without taking the
 * headset off— `<GlideHockeyScene>` has to be used. This one here opens its own
 * session, and a document only has room for one. The full contract is in
 * `docs/mounting-the-game.md`.
 */
export function GlideHockey({ assetsBase, challenge, onFinish }: GlideHockeyProps) {
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  // Removing the game has to give the headset back to whoever mounted it: the
  // session does not close by itself when the tree unmounts (see
  // `xr/xrStore.ts`). Here and not in the scene because it is the edge of the
  // mount, the same thing `unmount()` promises.
  useEffect(() => () => endXrSession(), [])

  return (
    <GameProvider challenge={challenge} onFinish={onFinish}>
      {/* Here exiting is closing the session: this website is the game and there
          is nowhere to go back to. In the hall it means the opposite. */}
      <ExitProvider onExit={endXrSession}>
        <GameScene />
      </ExitProvider>
    </GameProvider>
  )
}
