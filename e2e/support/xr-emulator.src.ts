/**
 * WebXR emulator for the tests, injected into the page before it loads.
 *
 * Chromium ships a `navigator.xr` with no headset behind it, so without this
 * the immersive mode never runs: the other tests go in through the mouse, which
 * is different code. IWER (Immersive Web Emulation Runtime, by Meta) puts in
 * its place a full runtime with a Quest 3 and its two controllers. It comes
 * inside `@react-three/xr`, so it adds no dependency.
 *
 * This file is bundled into an IIFE in `globalSetup` and loaded with
 * `page.addInitScript`. It is test code: it does not go into the game's bundle.
 */
import { XRDevice, metaQuest3 } from 'iwer'
import { Euler, Quaternion } from 'three'

const device = new XRDevice(metaQuest3)
// `forceInstall` because Chromium already ships a `navigator.xr` of its own
// —with no headset behind it— and without this IWER steps aside and leaves that
// one: the menu would ask for the headset, be told there is none, and there
// would be no way in.
device.installRuntime({ forceInstall: true })

const api = {
  /** Is there an immersive session under way? */
  hasSession: () => device.activeSession != null,

  /**
   * Turns the two controllers on and puts them where the hands would be.
   *
   * It is what makes `@pmndrs/xr` register them, and from that registration
   * comes the `gripSpace` the gun hangs from. The registration needs the
   * controller's profile, which the game serves from `public/webxr-profiles/`
   * (see `xr/xrStore.ts`): without turning the controllers on, that path is
   * never taken.
   */
  connectControllers() {
    const { left, right } = device.controllers
    if (left) {
      left.connected = true
      left.position.set(-0.25, 1.1, -0.35)
    }
    if (right) {
      right.connected = true
      right.position.set(0.25, 1.1, -0.35)
    }
  },

  /**
   * Puts a controller where it is told, in metres and in world coordinates.
   *
   * It is what is needed to test what gets picked up by bringing the hand over: without being
   * able to move the controller, the only path exercised is the mouse's, which is different code.
   */
  placeController(handedness: 'left' | 'right', x: number, y: number, z: number) {
    device.controllers[handedness]?.position.set(x, y, z)
  },

  /** Squeezes or releases the side trigger, which is what one grabs with. */
  squeeze(handedness: 'left' | 'right', pressed: boolean) {
    // The emulator names its buttons after its own map (`squeeze`), not the way the standard
    // WebXR profile calls them (`xr-standard-squeeze`), which is how the game reads them.
    device.controllers[handedness]?.setButtonValueImmediate('squeeze', pressed ? 1 : 0)
  },

  /**
   * Switches to bare hands: turns the controllers off and the hands on.
   *
   * It is the headset's other input mode, and the one that leaves out whoever has no
   * controllers at hand or cannot hold them. IWER ships them with their joints, so what is
   * tested with this is exactly what the game does with a real hand.
   */
  useHands(): void {
    for (const controller of [device.controllers.left, device.controllers.right]) {
      if (controller) controller.connected = false
    }
    device.primaryInputMode = 'hand'
    const { left, right } = device.hands
    if (left) {
      left.connected = true
      left.position.set(-0.25, 1.1, -0.5)
    }
    if (right) {
      right.connected = true
      right.position.set(0.25, 1.1, -0.5)
    }
  },

  /** Takes a hand to that point of the headset's space. */
  placeHand(handedness: 'left' | 'right', x: number, y: number, z: number): void {
    device.hands[handedness]?.position.set(x, y, z)
  },

  /** Brings the thumb and the index finger together or apart: it is the «grab» of a bare hand. */
  pinch(handedness: 'left' | 'right', pressed: boolean): void {
    const hand = device.hands[handedness]
    if (hand == null) return
    hand.poseId = pressed ? 'pinch' : 'default'
    hand.updateHandPose()
    hand.updatePinchValue(pressed ? 1 : 0)
  },

  /**
   * Turns the head: `yaw` to the sides and `pitch` up and down, in degrees.
   *
   * The emulator always enters looking straight ahead, and the visual hints are where one looks
   * afterwards: **the footprints, at the feet**. Without this, a screenshot of the hints comes
   * out showing the back wall, and **the two measurements of a comparison have to be taken
   * looking at the same place** — otherwise, what is compared are two views and not two scenes.
   */
  lookAt(yaw = 0, pitch = 0): void {
    const rotation = new Quaternion().setFromEuler(
      new Euler((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0, 'YXZ'),
    )
    device.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  },

  /** Closes the session, as when the player takes the headset off. */
  async endSession() {
    await device.activeSession?.end()
  },
}

;(window as unknown as { __xrTest: typeof api }).__xrTest = api
