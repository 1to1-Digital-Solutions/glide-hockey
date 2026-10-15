'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { InstancedMesh, PMREMGenerator, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * An environment map for the reflections of the table and of the puck, **with no file**.
 *
 * The task asked for a cubemap or a small HDRI served from `assetsBase`; this
 * is the same without asking for anything over HTTP —an xrcade game can start
 * on a headset on a local network— and with nothing to copy to the host:
 * `RoomEnvironment` is a room of lights that three ships ready-made, and
 * `PMREMGenerator` converts it once, on mount, into the prefiltered map that
 * standard materials know how to read. Cheap: it is computed once and the
 * reflections are one texture read per pixel of the material that wears it.
 * No planar reflections.
 *
 * It is applied by hand to the materials that want it (`envMap`), not to
 * `scene.environment`: inside xrcade's hall the scene belongs to the host, and
 * a global environment would change the look of the cabinets.
 */
export function useRoomEnvironment(): Texture {
  const gl = useThree((state) => state.gl)
  const target = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04)
    pmrem.dispose()
    room.dispose()
    // `room.dispose()` releases geometries and materials, but not the room's boxes, which are an
    // `InstancedMesh`: its `instanceMatrix` is a WebGL buffer that only goes away by releasing the mesh.
    // Without this one buffer was left per visit (measured in tower-tumble).
    room.traverse((part) => {
      if (part instanceof InstancedMesh) part.dispose()
    })
    return environment
  }, [gl])

  // The map lives on the graphics card inside its render target, and it is the target that is
  // released on unmount: releasing only its texture leaves the buffer alive on every visit. The
  // room of lights is released as soon as it is converted (its geometries and materials): it is
  // no longer needed.
  useEffect(() => () => target.dispose(), [target])

  return target.texture
}
