/**
 * The hit the body takes, in Godot: what on the web is `components/xr/HitFeedback.tsx`, with the
 * curves and the figures of `lib/hitFeedback.ts`, which is pure and goes in as it is.
 *
 * In Glide Hockey it is triggered by **the goal against** (`lib/goalAgainst.ts`): the table is a
 * plane and nothing flies out toward the body, so the closest thing to «I got hit» is conceding a
 * goal, and with little strength, because nobody has touched you. Five layers, each optional as on
 * the web:
 *
 * - **The vignette**: a plane in front of the eyes that **follows** the head because it hangs from
 *   the camera, without ever moving it; very dark red on the frame, more on the side of the hit,
 *   the centre clean. The shader is the web's, ported to Godot's language.
 * - **The shake**: it moves the scenery (the room), never the camera or the table, since the
 *   mallet goes in the hand and would come unstuck from it.
 * - **The slow motion**: the scene reads it (`timeScale`) and slows the table's clock with it.
 * - **The filter**: a low-pass on the game's bus, which muffles the ear for an instant.
 * - **The haptic**: the pulses of the shared recipe, through the player's vibration.
 *
 * The comfort of whoever plays rules (`layersForHit`). The clock is that of the frames **without
 * slowing** (what on the web is wall-clock time): the slow motion cannot slow its own way back.
 * And it is the engine's and not the system's so that, with `--fixed-fps`, an automatic match
 * lasts the same on a fast machine as on a slow one.
 */
import {
  AudioEffectLowPassFilter,
  AudioServer,
  Basis,
  Camera3D,
  MeshInstance3D,
  Node3D,
  QuadMesh,
  Shader,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'godot'

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
} from '@/lib/hitFeedback'
import type { HandPulse } from '@/lib/hapticFeedback'

/**
 * How far from the eyes the vignette goes and its size: more than enough for the headset (`PLANE`).
 */
const PLANE = { distance: 0.2, side: 1.1 } as const

/** The web's darkening (`darkVignette`), with the same sums. */
const VIGNETTE_SHADER = `
shader_type spatial;
render_mode unshaded, blend_mix, depth_test_disabled, depth_draw_never, cull_disabled;
uniform float intensity = 0.0;
uniform vec2 side = vec2(0.0);
varying vec2 screen;
void vertex() {
  vec4 clip = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
  screen = clip.xy / clip.w;
}
void fragment() {
  vec2 p = abs(screen);
  float r = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
  float toward = dot(normalize(screen + vec2(1e-5)), side);
  float boundary = mix(1.2, 0.7, intensity) - 0.2 * toward * intensity;
  float shade = smoothstep(boundary, boundary + 0.35, r);
  ALBEDO = vec3(0.3, 0.0, 0.02);
  ALPHA = shade * intensity;
}
`

export interface HitFeedbackOptions {
  /** The clock, in seconds: what the frames add up to, without the slow motion. */
  clock: () => number
  /** What is shaken: the scenery. */
  shaken: Node3D | null
  /** The camera the vignette hangs from (the headset's or the flat-screen one). */
  camera: Camera3D | null
  /** The comfort of the moment, read at every hit. */
  comfort: () => Comfort
  /** The pulses, through the player's vibration. With no headset, nothing. */
  vibrate?: (pulses: readonly HandPulse[]) => void
  /** The audio bus the low-pass is put on. With no bus, no filter. */
  bus?: string
}

export class HitFeedback {
  private hits: readonly Hit[] = []
  private readonly vignette: MeshInstance3D | null = null
  private readonly material: ShaderMaterial | null = null
  private readonly filter: AudioEffectLowPassFilter | null = null
  private lastCutoff: number = HIT.filter.open
  /** How many hits have been dealt: what a test counts. */
  dealt = 0

  constructor(private readonly options: HitFeedbackOptions) {
    const { camera, bus } = options
    if (camera != null) {
      const shader = new Shader()
      shader.code = VIGNETTE_SHADER
      this.material = new ShaderMaterial()
      this.material.shader = shader
      this.material.render_priority = 127
      const quad = new QuadMesh()
      quad.size = new Vector2(PLANE.side, PLANE.side)
      this.vignette = new MeshInstance3D()
      this.vignette.set_name('HitVignette')
      this.vignette.mesh = quad
      this.vignette.material_override = this.material
      this.vignette.position = new Vector3(0, 0, -PLANE.distance)
      this.vignette.visible = false
      camera.add_child(this.vignette)
    }
    if (bus != null) {
      const index = AudioServer.get_bus_index(bus)
      if (index >= 0) {
        this.filter = new AudioEffectLowPassFilter()
        this.filter.cutoff_hz = HIT.filter.open
        AudioServer.add_bus_effect(index, this.filter)
      }
    }
  }

  /**
   * Whoever plays has been hit: `strength` from 0 to 1 and `direction` toward where the hit comes
   * from as seen by whoever plays, in global space.
   */
  hit(strength: number, direction: Point3 | null): void {
    const layers = layersForHit(strength, this.options.comfort())
    const toward = unitVector(direction)
    // On which side of the view: the direction, taken to the head's space.
    let side = { x: 0, y: 0 }
    const camera = this.options.camera
    if (direction != null && camera != null) {
      const inHeadSpace = Basis.MULTIPLY(camera.global_basis.inverse(), new Vector3(toward.x, toward.y, toward.z))
      side = sideInView({ x: inHeadSpace.x, y: inHeadSpace.y, z: inHeadSpace.z })
    }
    this.hits = addHit(this.hits, { start: this.options.clock(), layers, direction: toward, side })
    this.dealt++
    // The haptic goes out in the same frame as the hit; the delays are handled by the kit's queue.
    this.options.vibrate?.(hitPulses(layers))
  }

  /** At what rate the table's clock has to run now: 1 is the normal one. */
  timeScale(): number {
    return hitState(this.hits, this.options.clock()).timeScale
  }

  /** One frame: the shake, the filter and the vignette. */
  update(): void {
    const state = hitState(this.hits, this.options.clock())
    this.hits = state === AT_REST ? [] : state.live
    const { shaken } = this.options
    if (shaken != null) shaken.position = new Vector3(state.shake.x, state.shake.y, state.shake.z)
    if (this.filter != null && state.cutoff !== this.lastCutoff) {
      this.lastCutoff = state.cutoff
      this.filter.cutoff_hz = state.cutoff
    }
    if (this.vignette != null && this.material != null) {
      this.vignette.visible = state.vignette > 0
      this.material.set_shader_parameter('intensity', state.vignette)
      this.material.set_shader_parameter('side', new Vector2(state.side.x, state.side.y))
    }
  }
}
