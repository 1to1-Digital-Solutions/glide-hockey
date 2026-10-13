'use client'

import { useFrame, useThree } from '@react-three/fiber'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Group, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector2, Vector3 } from 'three'

import {
  AT_REST,
  HIT,
  layersForHit,
  hitState,
  sideInView,
  hitPulses,
  addHit,
  unitVector,
  type Comfort,
  type Hit,
  type Point3,
} from '../../lib/hitFeedback'
import type { HandPulse } from '../../lib/hapticFeedback'

/**
 * The hit the body takes, painted: the vignette, the shake of the stage, the slow motion, the
 * filter and the haptic, orchestrated from a single place.
 *
 * It is the same file in every game that uses it (`comunes.py` watches over it), so there is
 * nothing of any game here: **what** hits, **when** and **how hard** is said by whoever mounts it
 * by calling `hit`. The curves and the figures are in `lib/hitFeedback.ts`, tested without a
 * browser.
 *
 * **The camera is not touched in any frame.** Moving the view without the head moving is what
 * causes sickness in virtual reality. What is shaken is the group that wraps the children of this
 * component —the stage the game passes it—, and the vignette is a plane that **follows** the
 * head by reading it, never by writing it. An e2e checks it frame by frame.
 *
 * **Every layer is optional except the vignette**, because not every game has everything:
 *
 * - The **shake** moves the children. Without children nothing is shaken.
 * - The **slow motion** is read by the game with `timeScale()` and applied to its game clock,
 *   if it has one. It is read and not pushed because each game has its own loop and its own frame
 *   order; the value comes from wall time, so it is fine to read it at any point of the frame.
 * - The **filter** arrives through `applyFilter(hz)` at the game's bus, only when it changes.
 * - The **haptic** arrives through `vibrate(pulse)`, with the shared recipe of
 *   `hapticFeedback.ts`: the game supplies the controller, this component invents no pulses.
 *
 * **The direction is given in the space where the component is mounted**, which is that of
 * whoever calls it —the game's world, with its anchor already set—: from there it is taken to the
 * head to know which side to darken, and the shake is applied as is to its group, which hangs
 * from that space.
 *
 * **Comfort rules** (off, gentle, normal) and the system's reduced motion is looked at right
 * here; that of the hall, if it ever arrives, comes in through `reducedMotion`.
 *
 * **The skin of the vignette can be supplied by the game** (`material`), which is how a game that
 * already had its own edge —a splatter, a crack— keeps having it without painting two planes
 * in front of the eyes: the plane, its place and its curve belong here; the look, to the game.
 * The material receives `uIntensity` (0–1), `uSide` (the side of the hit in the view) and `uSeed`
 * (different in each hit).
 */

/** What can be asked of it from the game. */
export interface HitFeedbackHandle {
  /**
   * The player has been hit.
   *
   * @param strength from 0 to 1.
   * @param direction where the hit comes from **as seen from** the player, in the space where
   *   this component is mounted; without it, the hit is dull: with no side and downwards.
   */
  hit(strength: number, direction?: Point3 | null): void
  /** At what pace the game's clock has to run now: 1 is the normal one. */
  timeScale(): number
}

export interface HitFeedbackProps {
  comfort: Comfort
  /** The reduced motion of the hall, if it gives it. That of the system is looked at here. */
  reducedMotion?: boolean
  /** The cutoff of the low-pass of the game's bus, in hertz. Without a bus, no filter. */
  applyFilter?: (cutoffHz: number) => void
  /** A pulse in a controller. Without controllers, no haptic. */
  vibrate?: (pulse: HandPulse) => void
  /** The skin of the vignette; without it, a darkening. */
  material?: ShaderMaterial
  /** The stage that is shaken. */
  children?: ReactNode
}

/** How far from the eyes the plane of the vignette goes, and what it measures: plenty for the headset. */
const PLANE = { distance: 0.2, side: 1.1 } as const

/** Wall time, in seconds: the slow motion cannot slow down its own return. */
const wallTime = () => performance.now() / 1000

/** A sample of what happens in one frame, for whoever looks from outside (an e2e). */
interface Sample {
  readonly camera: number[]
  readonly shake: [number, number, number]
  readonly vignette: number
  readonly timeScale: number
  readonly cutoff: number
}

/** What is left on `window` to test it from outside: give a hit, measure it and stop it. */
interface Probe {
  hit(strength: number, direction?: Point3 | null): void
  /** Starts recording one sample per frame, from scratch. */
  measure(): void
  samples(): readonly Sample[]
  /** Leaves the clock of the hits pinned at that age of the last one, or releases it with `null`. */
  pinAge(age: number | null): void
}

declare global {
  interface Window {
    __hitFeedback?: Probe
  }
}

/** What the system asks for: it is listened to, because it can be changed with the game open. */
const QUERY = '(prefers-reduced-motion: reduce)'
function subscribeToSystem(notify: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
function reducedInSystem(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * The default darkening: very dark red on the frame, more on the side of the hit, and the centre clean.
 *
 * Red and not black because most of the stages of the hall are dark, and a black frame over a
 * dimly lit room is not seen: the tint is what sets it apart. It only changes the colour of the
 * edges and is stuck to the head, so it moves nothing the inner ear could contradict.
 */
function darkVignette(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uIntensity: { value: 0 }, uSide: { value: new Vector2() }, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vScreen;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Where it falls on the screen of each eye, from -1 to 1: the edge is measured there and
        // not on the plane, so that it is the edge of what is seen whatever the field of view.
        vScreen = gl_Position.xy / gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vScreen;
      uniform float uIntensity;
      uniform vec2 uSide;
      void main() {
        // The whole frame, not a circle: it reaches 1 at the four edges.
        vec2 p = abs(vScreen);
        float r = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
        // On the side of the hit it comes in more, and on the opposite one less.
        float toward = dot(normalize(vScreen + vec2(1e-5)), uSide);
        // The stronger, the more it comes in; but it never goes past seventy percent of the way
        // to the edge: the centre of the view stays clean.
        float boundary = mix(1.2, 0.7, uIntensity) - 0.2 * toward * uIntensity;
        float shade = smoothstep(boundary, boundary + 0.35, r);
        gl_FragColor = vec4(0.3, 0.0, 0.02, shade * uIntensity);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Reused in every frame. */
const eyes = new Vector3()
const front = new Vector3()
const rotation = new Quaternion()
const parentRotation = new Quaternion()
const towardHit = new Vector3()

export const HitFeedback = forwardRef<HitFeedbackHandle, HitFeedbackProps>(function HitFeedback(
  { comfort, reducedMotion = false, applyFilter, vibrate, material, children },
  ref,
) {
  const camera = useThree((state) => state.camera)
  const root = useRef<Group>(null)
  const shaken = useRef<Group>(null)
  const plane = useRef<Mesh>(null)

  const fromSystem = useSyncExternalStore(subscribeToSystem, reducedInSystem, () => false)
  const reduced = reducedMotion || fromSystem

  /** What the game asks for changes between renders; the loop reads it by reference. */
  const requested = useRef({ comfort, reduced, applyFilter, vibrate })
  useEffect(() => {
    requested.current = { comfort, reduced, applyFilter, vibrate }
  }, [comfort, reduced, applyFilter, vibrate])

  const hits = useRef<readonly Hit[]>([])
  const seed = useRef(0)
  const lastCutoff = useRef<number>(HIT.filter.open)
  const pinnedAge = useRef<number | null>(null)
  const samples = useRef<Sample[] | null>(null)
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>())

  const own = useMemo(darkVignette, [])
  const geometry = useMemo(() => new PlaneGeometry(PLANE.side, PLANE.side), [])
  const skin = material ?? own

  useEffect(
    () => () => {
      own.dispose()
      geometry.dispose()
    },
    [geometry, own],
  )

  /** The clock of the hits: wall time, or the age pinned by a test. */
  const clock = () => {
    const pinned = pinnedAge.current
    const last = hits.current.at(-1)
    return pinned !== null && last !== undefined ? last.start + pinned : wallTime()
  }

  const hit = (strength: number, direction?: Point3 | null) => {
    const { comfort: c, reduced: r, vibrate: v } = requested.current
    const layers = layersForHit(strength, c, r)
    const toward = unitVector(direction)
    // On which side of the view: the direction, from the component's space to the head's.
    let side = { x: 0, y: 0 }
    const group = root.current
    if (direction != null && group !== null) {
      group.updateWorldMatrix(true, false)
      towardHit.set(toward.x, toward.y, toward.z).transformDirection(group.matrixWorld)
      towardHit.applyQuaternion(camera.getWorldQuaternion(rotation).invert())
      side = sideInView(towardHit)
    }
    hits.current = addHit(hits.current, { start: wallTime(), layers, direction: toward, side })
    seed.current = (seed.current + 2.39996) % 6.283
    // The haptic goes out in the same frame as the hit: more than twenty milliseconds ahead of
    // the view and it already feels as if it does not go with it.
    if (v !== undefined) {
      for (const pulse of hitPulses(layers)) {
        if (pulse.delay === 0) {
          v(pulse)
          continue
        }
        const timer = setTimeout(() => {
          pending.current.delete(timer)
          v(pulse)
        }, pulse.delay)
        pending.current.add(timer)
      }
    }
  }

  const timeScale = () => hitState(hits.current, clock()).timeScale

  useImperativeHandle(ref, () => ({ hit, timeScale }))

  // The probe to test it from outside. One per page: the game mounts a single hit.
  useEffect(() => {
    const probe: Probe = {
      hit,
      measure: () => {
        samples.current = []
      },
      samples: () => samples.current ?? [],
      pinAge: (age) => {
        pinnedAge.current = age
      },
    }
    window.__hitFeedback = probe
    const timers = pending.current
    return () => {
      if (window.__hitFeedback === probe) delete window.__hitFeedback
      for (const timer of timers) clearTimeout(timer)
      // On leaving, the game's bus is left open: a filter closed forever is a game that sounds
      // muffled without anyone knowing why.
      if (lastCutoff.current !== HIT.filter.open) requested.current.applyFilter?.(HIT.filter.open)
    }
    // The probe is set once; what changes it reads by reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state) => {
    const current = hitState(hits.current, clock())
    hits.current = current === AT_REST ? [] : current.live

    // The shake: the stage, never the camera.
    shaken.current?.position.set(current.shake.x, current.shake.y, current.shake.z)

    // The filter, only when it changes: the bus does not need the same thing repeated every frame.
    if (current.cutoff !== lastCutoff.current) {
      lastCutoff.current = current.cutoff
      requested.current.applyFilter?.(current.cutoff)
    }

    // The vignette, in front of the eyes and with their rotation, taken to the space of the plane's parent.
    const mesh = plane.current
    if (mesh !== null) {
      skin.uniforms.uIntensity.value = current.vignette
      ;(skin.uniforms.uSide.value as Vector2).set(current.side.x, current.side.y)
      skin.uniforms.uSeed.value = seed.current
      // Without a hit it shrinks to nothing instead of hiding: hidden it would not be compiled with
      // the rest of the scene, and the first hit would recompile its program in the worst possible frame.
      mesh.scale.setScalar(current.vignette > 0 ? 1 : 0)
      if (current.vignette > 0) {
        state.camera.getWorldPosition(eyes)
        state.camera.getWorldQuaternion(rotation)
        front.set(0, 0, -PLANE.distance).applyQuaternion(rotation).add(eyes)
        const parent = mesh.parent
        if (parent !== null) {
          parent.updateWorldMatrix(true, false)
          parent.worldToLocal(front)
          rotation.premultiply(parent.getWorldQuaternion(parentRotation).invert())
        }
        mesh.position.copy(front)
        mesh.quaternion.copy(rotation)
      }
    }

    if (samples.current !== null) {
      const s = shaken.current?.position
      samples.current.push({
        camera: [...state.camera.matrixWorld.elements, ...state.camera.position.toArray(), ...state.camera.quaternion.toArray()],
        shake: s === undefined ? [0, 0, 0] : [s.x, s.y, s.z],
        vignette: current.vignette,
        timeScale: current.timeScale,
        cutoff: current.cutoff,
      })
    }
  })

  return (
    <group ref={root} name="golpe-recibido">
      <group ref={shaken} name="golpe-sacudida">
        {children}
      </group>
      <mesh
        ref={plane}
        geometry={geometry}
        material={skin}
        scale={0}
        frustumCulled={false}
        // Out of the reach of any ray: it is in front of the eyes and would swallow the clicks.
        raycast={() => {}}
        renderOrder={1000}
        name="golpe-vineta"
      />
    </group>
  )
})
