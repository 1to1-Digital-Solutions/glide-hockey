import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { GlideHockeyScene, type Goal, type GameResult } from '../../src/game'
import type { HostAnchor } from '../../src/lib/hostAnchor'
import { XRControllerGrip } from '../../src/components/xr/XRControllerGrip'

/**
 * The test host: it mounts `<GlideHockeyScene>` inside a Canvas and a session
 * that are not its own, the way the xrcade hall does. It is the only place in the
 * suite that exercises the mounting contract (`docs/mounting-the-game.md`): the
 * game's web page mounts `<GlideHockey>`, which brings its own Canvas.
 */
const mount = document.getElementById('game')
if (mount == null) {
  throw new Error('The test host has nowhere to mount the game')
}
const assetsBase = mount.dataset.assetsBase ?? '/'

/**
 * Whether the scene waits to be told to come in, **as in the hall**.
 *
 * By default it is mounted with the page, which is what is convenient for the rest of the
 * suite. But the hall does not do that: whoever chooses a cabinet already has the headset on,
 * so the scene is mounted **inside a session that is already open** and without having painted
 * a single frame on screen. It is the difference that matters for the shaders —what is painted
 * on the page gets compiled there, outside the session, and that way no prewarming failure
 * is noticed— and the only way to measure it from here.
 */
const onDemand = mount.dataset.cabinet === 'on-demand'

/**
 * The seed of the challenge, if the hall is passing it (`data-challenge`). What the scene
 * reports at the end of each match is left in `window.__finished`, which is what the hall would
 * take as its own.
 */
const challengeSeed = mount.dataset.challenge
const challenge = challengeSeed === undefined ? undefined : { seed: Number(challengeSeed) }
/** The anchor, if the host lends it (`data-anchor`, as JSON); without it, to the gaze. */
const anchor = mount.dataset.anchor === undefined ? undefined : (JSON.parse(mount.dataset.anchor) as HostAnchor)
/** The medal thresholds, if the hall is passing them (`data-goal`, as JSON). */
const goal = mount.dataset.goal === undefined ? undefined : (JSON.parse(mount.dataset.goal) as Goal)
window.__finished = []
const recordFinished = (result: GameResult) => {
  window.__finished.push(result)
}

const store = createXRStore({
  // What the contract asks to wire to the host: the controller profiles under
  // its own prefix.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  // The hall's controller (`xrcade/src/components/salon/salonStore.ts`): without a model, but
  // with its pose in the fist. With `{ model: false }` there is no `state.object` and the mallet
  // cannot be picked up, so the challenge's serve would be left waiting for it forever.
  controller: XRControllerGrip,
  hand: { model: false },
})

declare global {
  interface Window {
    __finished: GameResult[]
    __glideHockeyHost: {
      enterVR: () => Promise<void>
      enterAR: () => Promise<void>
      /** Mounts the scene, as when choosing a cabinet. It only does something with `data-cabinet`. */
      enterCabinet: () => void
      /**
       * Shows or hides the goal sign, and says whether it was hung. It is for measuring what it
       * costs to paint it: the same scene, on the same frame of the match, with it and without it.
       */
      showSign: (visible: boolean) => boolean
    }
  }
}

let enter = () => {}
let showSign: (visible: boolean) => boolean = () => false

window.__glideHockeyHost = {
  async enterVR() {
    await store.enterVR()
  },
  // The way the hall enters: in augmented reality whenever the headset has it, and the backdrop
  // is decided by the arcade's scenery, not by the type of session.
  async enterAR() {
    await store.enterAR()
  },
  enterCabinet: () => enter(),
  showSign: (visible) => showSign(visible),
}

/** Gives the test host the hand with which to look for the sign in the scene. */
function HandInTheScene() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    showSign = (visible) => {
      const sign = scene.getObjectByName('cartel-de-objetivo')
      if (sign == null) return false
      // This host's camera is nobody's head: it is set looking at the sign, since what falls
      // outside the image is not painted and there would be nothing to measure.
      camera.lookAt(sign.getWorldPosition(new Vector3()))
      sign.visible = visible
      return true
    }
    return () => {
      showSign = () => false
    }
  }, [scene, camera])
  return null
}

/** The cabinet: the scene, mounted when it is time. */
function Cabinet() {
  const [inside, setInside] = useState(!onDemand)
  useEffect(() => {
    enter = () => setInside(true)
    return () => {
      enter = () => {}
    }
  }, [])

  if (!inside) return null
  // Going back is the host's business, and here there is nowhere to go.
  return <GlideHockeyScene assetsBase={assetsBase} anchor={anchor} onExit={() => {}} challenge={challenge} onFinish={recordFinished} goal={goal} />
}

function Host() {
  return (
    <Canvas shadows="percentage" camera={{ position: [0, 1.6, 0.9], fov: 62, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        <Cabinet />
        <HandInTheScene />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
