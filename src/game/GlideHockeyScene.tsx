'use client'

import { GameProvider } from '../components/GameProvider'
import { GameWorld } from '../components/game/GameWorld'
import { setAssetsBase } from '../lib/assets'
import type { HostAnchor } from '../lib/hostAnchor'
import type { Goal } from '../lib/goal'
import { setGameName } from '../lib/menuTemplate'
import type { GameResult, Challenge } from '../lib/seed'
import { ExitProvider } from './exit'

export interface GlideHockeySceneProps {
  /**
   * Where the game's static files hang from (the WebXR controller profiles,
   * which are copied from `public/`). The host serves them, under its own
   * prefix: two games on the same origin would overwrite each other.
   *
   * The profiles are requested by the WebXR store, which here belongs to the
   * host: it has to be created with `baseAssetPath` pointing at
   * `<assetsBase>/webxr-profiles/` or the player is left with no controllers
   * (see `docs/mounting-the-game.md`).
   */
  assetsBase?: string
  /**
   * Where and with what heading to plant the game's world, if whoever mounts
   * the scene knows it: the xrcade hall lends the anchor with which it has its
   * arc of cabinets planted.
   *
   * **Without it, the world is planted in front of wherever one is looking on
   * entering**, which is the only thing known on the game's own website. Inside
   * the hall that throws things out of place: reading the cabinets on the left
   * forces a turn of the head, and the game came out turned that way.
   */
  anchor?: HostAnchor
  /**
   * Returns the player to where they were. The game calls it from its
   * immersive interface; what going back means is decided by whoever mounts.
   */
  onExit: () => void
  /**
   * The match that is played, if it is a challenge (the daily one, or the code
   * of «reta mi puntuación»).
   *
   * With it the scene comes in **already playing** the challenge (`challenge`,
   * the record's mode), with no tutorial and with the machine's shots drawn
   * from the seed: same seed, same machine in every round. Without it, the game
   * opens its menu and plays as always.
   */
  challenge?: Challenge
  /**
   * Called once when each match ends —not when it is left halfway—, with the
   * mode, the points even if they are not a record, whether it was the match of the `challenge`
   * and, if any was earned for the first time, the feats (`feats`: API names of the Steam
   * achievements).
   */
  onFinish?: (result: GameResult) => void
  /**
   * What has to be beaten: the game's three medal thresholds, the mark of whoever plays and the
   * mode in which they count. With it, the sign above the scoreboard says which threshold is
   * missing and how much is left; without it, the mission and the record stored in this browser.
   */
  goal?: Goal
  /**
   * What the cabinet is called in the hall (the `name` of its manifest): it is what the menu and
   * the cover say (`gameName` of `menuTemplate.ts`). Without it, the one in `package.json` with
   * capitals, which matches the catalogue's.
   */
  name?: string
}

/**
 * Glide Hockey as a SCENE: what is drawn inside someone else's Canvas.
 *
 * It is the contract with which xrcade mounts a game inside its hall. It
 * creates no Canvas, neither opens nor closes the immersive session and draws
 * not a single DOM tag: only three objects. That way, entering the game and
 * going back to the hall are mounting and unmounting a piece of scene, and the
 * session does not even notice — which is what allows going from a game to the
 * hall without taking the headset off.
 *
 * To mount it with its 2D interface and its own session —what a normal web
 * page wants— there is `<GlideHockey>`, which is this scene with a Canvas
 * around it.
 *
 * The full contract, in `docs/mounting-the-game.md`.
 */
export function GlideHockeyScene({ assetsBase, anchor, onExit, challenge, onFinish, goal, name }: GlideHockeySceneProps) {
  // Before the children, for the same reason as the file base: the menu reads it from the first
  // frame, and setting it twice with the same name changes nothing.
  setGameName(name)
  // During render and not in an effect: the WebXR store resolves its file
  // base the first time someone asks for it, which can be before any effect
  // runs. Writing the same base twice changes nothing, so repeating the
  // render is harmless.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  return (
    <GameProvider challenge={challenge} onFinish={onFinish} goal={goal}>
      <ExitProvider onExit={onExit}>
        <GameWorld anchor={anchor} />
      </ExitProvider>
    </GameProvider>
  )
}
