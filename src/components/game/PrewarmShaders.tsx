'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useLayoutEffect } from 'react'
import { recordPrograms } from '../../lib/mountCount'

/**
 * Compiles the scene's shaders **before** they need to be painted.
 *
 * Compiling a shader **blocks the thread**, and three does not do it until it has to paint that
 * material for the first time. On a screen that is one lost frame and it goes unnoticed. At 72
 * per second and per eye, it is a flash — and not one: **one per material**, spread over the
 * first frames as each thing shows up. It is the hitch that gets reported at the start.
 *
 * `compile` does not block: with `KHR_parallel_shader_compile` the driver compiles in parallel. It
 * is called once for the whole scene, so instead of eight stray compilations —each
 * one in its own frame— there is one batch out of the way of drawing.
 *
 * **With `compile` and not with `compileAsync`.** `compileAsync` is `compile` plus a promise that
 * three resolves by polling every ten milliseconds the program of each material. If meanwhile
 * one is unmounted (the menu buttons when Jugar is pressed), the polling reads a program that no
 * longer exists and blows up in a timer: «Cannot read properties of undefined (reading
 * 'isReady')». Nobody awaits that promise here, so the polling is not needed.
 *
 * **It is mounted in the world, not in the Canvas of the game's own web.** That is where it was,
 * and that is why it warmed nothing right where the game is really played: the hall mounts
 * `<GameWorld>` inside its own Canvas, and everything that hung from the game's own Canvas stayed
 * on the web. Worse still, in the hall the cabinet is entered **with the headset already on**: the
 * scene is born inside an open session and without having painted a single frame on screen, so
 * there is nothing compiled from before there and everything is compiled on the go.
 *
 * **And in a layout effect** (`useLayoutEffect`), which React flushes before yielding
 * control to the browser: with a normal effect the batch can land after the first frame
 * of the scene, which is exactly the frame that has to be saved.
 *
 * `compile` walks the scene **whether what is in it is visible or not**, so the stage that is
 * hidden when «tu habitación» is chosen goes in all the same: what does not go in is what is
 * unmounted, and that is why what changes with the scenery is hidden instead of removed.
 *
 * It fixes nothing that is not compilation: if the flicker went on, this component rules it
 * out as the cause, which is half the work of finding it.
 */
export function PrewarmShaders() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const mode = useXR((state) => state.mode)

  // On mount and every time a session is opened or closed: entering the headset brings out the
  // materials that only exist inside —the panels, the drawn controller— and they are exactly the
  // ones nobody has compiled. Repeating it costs nothing: three returns the program it already has.
  useLayoutEffect(() => {
    gl.compile(scene, camera)
  }, [mode, gl, scene, camera])

  // How many programs it has compiled so far, so that a test can tell whether on entering the
  // session there is still any left to compile (`lib/mountCount.ts`).
  useFrame(() => {
    recordPrograms(gl.info.programs?.length ?? 0)
  })

  return null
}
