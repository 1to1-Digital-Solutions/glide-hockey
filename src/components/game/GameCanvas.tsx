'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { ExitRing } from '../xr/ExitRing'
import { getXrStore } from '../xr/xrStore'
import { GameWorld } from './GameWorld'

/**
 * The Canvas of the game's website: one of its hosts, not the game.
 *
 * The game itself is `<GameWorld>`, which is three objects and nothing else.
 * What is put around it —the Canvas, the WebXR session, the desktop camera—
 * belongs to whoever hosts it, and this website is a host like the xrcade
 * hall. That its own website mounts the same way as the hall is not gratuitous
 * symmetry: it is how the game is tried with the headset without bringing up
 * the whole hub, and what makes a failure of the contract show up here and not
 * there.
 */

/**
 * Orbit of the desktop camera. It switches off as soon as the match starts:
 * turning the camera by dragging competes with moving the mallet, which is
 * done with the same mouse.
 */
function DesktopControls() {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()

  return (
    <OrbitControls
      enabled={
        mode == null && (gameState === 'menu' || gameState === 'finished')
      }
      enablePan={false}
      minDistance={1}
      maxDistance={5}
      // One cannot look from under the table: there is nothing on the other side.
      maxPolarAngle={Math.PI / 2.1}
      target={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}
    />
  )
}

export function GameCanvas() {
  return (
    <Canvas
      // "percentage" = PCFShadowMap. R3F's default value is
      // PCFSoftShadowMap, deprecated in three 0.185 (it warns on the console).
      shadows="percentage"
      // Leaning over the table from its edge: higher than standing and a little
      // back, which is where both goals are seen at once. At eye height the
      // goal at the back is almost edge-on and the puck gets lost against the
      // rail.
      camera={{ position: [0, 2.65, 1.5], fov: 46, near: 0.05, far: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <XR store={getXrStore()}>
        {/* The player, standing at zero. The world is drawn around them, not
            the other way round: it is the same thing the hall does, so the game
            mounts identically in both places. */}
        <XROrigin position={[0, 0, 0]} />
        <GameWorld hasDomUi />
        <DesktopControls />
        {/* The common exit, holding B or Y: in the hall the hall provides it. */}
        <ExitRing />
      </XR>
    </Canvas>
  )
}
