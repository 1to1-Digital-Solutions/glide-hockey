'use client'

import { createXRStore } from '@react-three/xr'
import { XRControllerGrip } from './XRControllerGrip'
import { assetUrl } from '../../lib/assets'

/** Where the controller profiles live, served alongside the rest of the files. */
const XR_PROFILES_PATH = 'webxr-profiles/'

/**
 * Absolute path to the profiles.
 *
 * @react-three/xr resolves them with `new URL(path, baseAssetPath)`, which
 * requires an absolute base: a path like `/webxr-profiles/` throws. On the
 * server there is no `window`, but there is no immersive session either, so
 * that value never gets used.
 */
function profilesBasePath(): string {
  const path = assetUrl(XR_PROFILES_PATH)
  if (typeof window === 'undefined') {
    return new URL(path, 'http://localhost').href
  }
  return new URL(path, window.location.origin).href
}

/**
 * WebXR store shared between the enter button (DOM) and the `<XR>` component
 * inside the Canvas. It is created only once, the first time either of them
 * asks for it, so that both sides point at the same session.
 *
 * **Only the game's own website uses it.** Mounted inside the xrcade hall the
 * session belongs to the host and this module is not touched: whoever owns the
 * Canvas owns the session (see `docs/xrcade.md`).
 *
 * It is created on request and not when the module is imported because its
 * `baseAssetPath` depends on where the game's files are, and that is decided by
 * whoever mounts it (see `lib/assets.ts`).
 *
 * Two decisions that come from the hall's security policy:
 *
 * - **The controller profiles are served from the website itself**
 *   (`baseAssetPath`). By default they are downloaded from `cdn.jsdelivr.net`;
 *   the policy blocks it —and so does a headset with no way out to the
 *   internet—, and when the promise fails the library swallows the error and
 *   **never registers the controller**: no ray, and no way to move the mallet.
 *   The files are copied with `npm run sync:xr-profiles`.
 * - **No controller model** (`model: false`). It switches off only the model:
 *   the profile is downloaded all the same, because the button map comes from
 *   it. Self-hosting those models would cost the 97 MB of the package and here
 *   they add nothing: the mallet goes on the table, not in the hand.
 * - **Except in the tutorial**, which does show it: at real size, on top of the
 *   controller held in the hand and with the button in question lit
 *   (`xr/RealController.tsx`). Of the 97 MB of the package the two Quest
 *   controllers are copied —1.7 MB, `scripts/sync-xr-profiles.mjs`— and they
 *   are only requested in that step.
 */
let store: ReturnType<typeof createXRStore> | null = null

export function getXrStore(): ReturnType<typeof createXRStore> {
  store ??= createXRStore({
    baseAssetPath: profilesBasePath(),
    // A controller of our own and not the default options: with `model: false` the library does
    // not mount `XRControllerModel`, which is **the only one that writes `state.object`**, and
    // without that object the game does not know where the hand is — the mallet could not be
    // grabbed. See `XRControllerGrip.tsx`.
    controller: XRControllerGrip,
    hand: {
      model: false,
      rayPointer: {
        rayModel: { maxLength: 6, opacity: 0.35 },
        cursorModel: true,
      },
      grabPointer: false,
      teleportPointer: false,
    },
  })
  return store
}

/**
 * Closes the immersive session, if there is one.
 *
 * It is needed when unmounting the game. The store lives outside the React
 * tree and `<XR>` closes nothing when it unmounts: an application that removed
 * the game with the headset on would leave alive a session tied to a Canvas
 * that no longer exists, and the player would be left staring at a frozen scene
 * unable to go back or start another one (WebXR gives one session per
 * document).
 */
export function endXrSession(): void {
  const session = store?.getState().session
  if (session == null) return
  // The call failing is an expected outcome: the session may already be
  // closing because the player has left on their own.
  void session.end().catch(() => {})
}
