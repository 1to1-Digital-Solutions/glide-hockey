'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useGetXRSpaceMatrix,
  useXRInputSourceState,
  type XRControllerState,
} from '@react-three/xr'
import { Box3, Group, Matrix4, Mesh, Object3D, Vector3, type Material, type Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { COMPONENTE_DEL_BOTON, type ControllerButton } from '../../lib/tutorial'
import { NO_RAYCAST } from '../raycast'

/**
 * The real controller, at real size and on top of the one held in the hand.
 *
 * **What problem it solves.** The tutorial asks «mantén el botón de agarre» and draws a controller
 * in strokes on the panel (`drawnController.ts`). That is already better than the sentence alone,
 * but you still have to translate from a flat drawing to what you hold in your hand, which with
 * the headset on cannot be seen: the controller is not drawn (`xrStore.ts`, `model: false`). This
 * removes the translation: **the button lights up where it really is**, on the controller itself,
 * at its size and in its place. Putting the model inside the panel was tried before and it is no
 * use —at a metre and 7 cm tall it is a white blur—; placed in the hand you look at it and that is it.
 *
 * **Only while the step asks for it.** It is mounted during the step that names a button and
 * leaves with it. A controller painted on top of the controller all the time would get in the way
 * of exactly what the game is about: looking at your hands.
 *
 * **And it is an extra, not a requirement.** The `.glb` is only copied for the Quest controllers
 * (`scripts/sync-xr-profiles.mjs`). With any other —or with no network, or if the file fails—
 * nothing happens: it is not mounted and the panel's drawing remains, which is what there was.
 *
 * **Where it hangs does not matter.** The controller's place is given by WebXR in the origin's
 * space, so the group is placed by undoing whatever its parents have done to it —the world's
 * anchoring, the play height—. Hung as is inside the anchoring, the controller would appear turned
 * and displaced relative to the hand, which is the only place where it cannot be.
 *
 * **Or beside the gesture** (`beside`). The visual hints show the ghost object —the ball that
 * has to be picked up— and that says *what* to pick up, but not *with which button*. With `beside`,
 * the controller does not go on the hand but **next to the ghost**, in the parent's coordinates and
 * at the scale that is asked for, with the button throbbing. That way it is not painted on top of
 * the copy the tutorial puts in the hand —two copies of the same `.glb` in the same place overlap—
 * and the hint can show it from the very first time. The model is still that of the controller
 * held in that hand.
 */

/** One for the whole game: the `.glb` is requested once per session at most. */
const loader = new GLTFLoader()

/** Where a button is inside the model and how big it is, in metres. */
interface ButtonPlacement {
  center: Vector3
  radius: number
}

/** The model ready to paint, with the place of the button that has to light up. */
interface ControllerModel {
  /** The whole controller, just as it comes from the `.glb`. */
  root: Object3D
  /** Where the button falls inside the model, or `null` if that controller does not have it. */
  button: ButtonPlacement | null
}

/**
 * What the part that moves when that button is pressed is called in the `.glb`.
 *
 * It is asked through `visualResponses` and **not through `rootNodeName`**, which is what it looks
 * like: on the Quest controllers that name does not exist in the model and the search returns
 * nothing. The node that is there is the one the profile animates between its released position
 * and its pressed position, and it is right where the button is, which is all that is needed here.
 */
export function buttonNode(
  layout: XRControllerState['layout'],
  component: string,
): string | null {
  const part = layout.components[component]
  if (part == null) return null
  const [response] = Object.values(part.visualResponses)
  return response?.valueNodeName ?? null
}

/**
 * Where that part is inside the model, and how bulky it is.
 *
 * **The geometry is measured, not the node.** The node the profile names is the button's
 * *pivot* —the axis it turns about when pressed—, and on the Quest controllers it is two
 * and a half centimetres in front of the button, at the top, next to the joystick: marking there
 * pointed at something else. The box of what hangs from it does fall where the button is, and
 * along the way it says how big the mark has to be to cover it without hiding half the controller.
 */
export function nodePlacement(root: Object3D, name: string): ButtonPlacement | null {
  const part = root.getObjectByName(name)
  if (part == null) return null
  root.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(part)
  if (box.isEmpty()) return null
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  center.applyMatrix4(new Matrix4().copy(root.matrixWorld).invert())
  return { center, radius: Math.max(size.x, size.y, size.z) * 0.6 }
}

/**
 * Disposes from the GPU what the `.glb` brought: every geometry, every material and its textures.
 *
 * **It is needed because nobody else does it.** The model is painted with `<primitive>`, which R3F
 * does not free when removing it, and every mount loads the whole `.glb`, anew —the loader keeps
 * nothing—. Measured on hole-patrol's host (`e2e/memoria.spec.ts`): without disposing of it, every
 * visit to the cabinet left six more geometries, one texture and twenty-three WebGL buffers, with
 * no ceiling. Disposing twice of something already disposed does nothing.
 */
export function disposeModel(root: Object3D): void {
  root.traverse((part) => {
    const mesh = part as Mesh
    if (mesh.isMesh !== true) return
    mesh.geometry.dispose()
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture === true) (value as Texture).dispose()
      }
      material.dispose()
    }
  })
}

/** The last thing that was loaded, and for which controller and which button it was requested. */
interface LoadedModel {
  path: string
  node: string | null
  model: ControllerModel
}

/**
 * Loads the controller's model, or `null` while there is none.
 *
 * **Loaded by hand and not with `useLoadXRControllerModel`** —which also exists— because that one
 * suspends, and a `.glb` that is not there (another controller, another headset) comes out through
 * the error path: what is needed there is to mount nothing, not a failure screen over the tutorial.
 *
 * What was loaded is kept **with the request that brought it**, and is returned only if it is still
 * the one being asked for. That way changing hand or step does not show a frame of the previous
 * model and there is no need to clear it by hand at the start.
 *
 * **And it is disposed of on leaving** (`disposeModel`): on changing controller or button, or on
 * unmounting. By then it is no longer painted —the request is no longer its own and `null` is
 * returned here—. Whatever arrives when it is no longer wanted is disposed of as soon as it arrives.
 */
function useControllerModel(path: string | null, node: string | null): ControllerModel | null {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)

  useEffect(() => {
    if (path == null) return
    let alive = true
    let loadedRoot: Object3D | null = null
    loader
      .loadAsync(path)
      .then((gltf) => {
        const root = gltf.scene
        if (!alive) {
          disposeModel(root)
          return
        }
        loadedRoot = root
        // **Invisible to the ray, entirely.** The pointer is born in this same hand: a mesh that
        // answers the ray here swallows it in the first centimetre and leaves it unable to aim
        // at anything. `raycast` is set part by part because setting it on the root does not go down.
        root.traverse((part) => {
          part.raycast = NO_RAYCAST
        })
        const button = node == null ? null : nodePlacement(root, node)
        setLoaded({ path, node, model: { root, button } })
      })
      // An expected outcome, not a failure: this headset brings a controller whose model was not
      // copied. With nothing to show, the panel's drawing keeps saying which button it is.
      .catch(() => {})
    return () => {
      alive = false
      if (loadedRoot != null) disposeModel(loadedRoot)
    }
  }, [path, node])

  if (loaded == null || loaded.path !== path || loaded.node !== node) return null
  return loaded.model
}

/** They are reused on every frame: a new matrix per frame is garbage to collect. */
const IN_ORIGIN_SPACE = new Matrix4()
const FROM_PARENT = new Matrix4()

/** Where to plant the controller when it goes beside the gesture, in the parent's coordinates. */
export interface BesideGesture {
  readonly position: readonly [number, number, number]
  /** Euler XYZ in radians. What suits best: the button facing whoever looks. */
  readonly rotation?: readonly [number, number, number]
  /** The controller measures about 12 cm; at more than a metre it helps to grow it. */
  readonly scale?: number
}

export function RealController({
  hand,
  button,
  beside,
}: {
  /** Which hand the controller that has to be shown belongs to. */
  hand: XRHandedness
  /** Which button lights up, or `null` to light up none. */
  button: ControllerButton | null
  /** If given, the controller goes here and not on the hand (see above). */
  beside?: BesideGesture
}) {
  const controller = useXRInputSourceState('controller', hand)
  const group = useRef<Group>(null)

  const node = useMemo(() => {
    if (controller == null || button == null) return null
    return buttonNode(controller.layout, COMPONENTE_DEL_BOTON[button])
  }, [controller, button])
  const model = useControllerModel(controller?.layout.assetPath ?? null, node)

  // The grip, not the ray: the model is drawn in the grip's space, which is where the real
  // controller hangs from.
  const locate = useGetXRSpaceMatrix(controller?.inputSource.gripSpace)

  // Before anyone else (negative priority, like the library itself), so that the controller is
  // already in place when the frame is painted. Negative does not take the painting away from
  // R3F: it only orders.
  useFrame((_state, _delta, frame) => {
    const node3d = group.current
    if (node3d == null || beside != null) return
    const placed = locate?.(IN_ORIGIN_SPACE, frame) ?? false
    node3d.visible = placed
    if (!placed) return

    // `IN_ORIGIN_SPACE` is in the space the host sets (its `<XROrigin>`, at the zero of the
    // scene). What this group needs is its **local** matrix, so whatever its parents set is
    // taken off it: that way it works hung anywhere, also inside the world's anchoring.
    const parent = node3d.parent
    if (parent == null) return
    parent.updateWorldMatrix(true, false)
    node3d.matrix.multiplyMatrices(
      FROM_PARENT.copy(parent.matrixWorld).invert(),
      IN_ORIGIN_SPACE,
    )
  }, -100)

  if (model == null) return null

  if (beside != null) {
    return (
      <group
        position={beside.position as [number, number, number]}
        rotation={(beside.rotation ?? [0, 0, 0]) as [number, number, number]}
        scale={beside.scale ?? 1}
      >
        <primitive object={model.root} />
        {model.button != null ? <LitButton button={model.button} /> : null}
      </group>
    )
  }

  return (
    <group ref={group} matrixAutoUpdate={false}>
      <primitive object={model.root} />
      {model.button != null ? <LitButton button={model.button} /> : null}
    </group>
  )
}

/**
 * What colour the button lights up in.
 *
 * Written here and not taken from the game's palette on purpose: what is underneath is not the
 * game's stage, it is a white plastic controller with a black cap, and the mark has to stand
 * out from both. A lit amber does so on both; the game's colour, on half of them, does not.
 */
const MARK_COLOR = '#ffc233'

/** How much and how fast it throbs, so that it is seen to be the mark and not one more part. */
const THROB = { strength: 0.18, speed: 5 }

/**
 * The mark on the button in question.
 *
 * **It is painted in front of everything** (`depthTest={false}`): the point the profile animates is
 * inside the shell, and without this the mark would be buried in the plastic just when
 * it needs to be seen.
 */
function LitButton({ button }: { button: ButtonPlacement }) {
  const halo = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const node = halo.current
    if (node == null) return
    node.scale.setScalar(1 + THROB.strength * Math.sin(clock.elapsedTime * THROB.speed))
  })

  return (
    <group position={button.center}>
      <mesh raycast={NO_RAYCAST} renderOrder={11}>
        <sphereGeometry args={[button.radius * 0.45, 12, 12]} />
        <meshBasicMaterial color={MARK_COLOR} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={halo} raycast={NO_RAYCAST} renderOrder={10}>
        <sphereGeometry args={[button.radius, 16, 16]} />
        <meshBasicMaterial
          color={MARK_COLOR}
          transparent
          opacity={0.35}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
