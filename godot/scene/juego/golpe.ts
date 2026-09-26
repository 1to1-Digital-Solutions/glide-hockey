/**
 * El golpe que recibe el cuerpo, en Godot: lo que en la web es `components/xr/GolpeRecibido.tsx`,
 * con las curvas y las cifras de `lib/golpeRecibido.ts`, que es puro y entra tal cual.
 *
 * En Glide Hockey lo dispara **el gol en contra** (`lib/golEnContra.ts`): la mesa es un plano y
 * nada sale volando hacia el cuerpo, así que lo más parecido a «me han dado» es que te metan un
 * gol, y con poca fuerza, porque nadie te ha tocado. Cinco capas, cada una opcional como en la web:
 *
 * - **La viñeta**: un plano delante de los ojos que **sigue** a la cabeza porque cuelga de la
 *   cámara, sin moverla nunca; rojo muy oscuro en el marco, más del lado del golpe, el centro
 *   limpio. El sombreador es el de la web, pasado al lenguaje de Godot.
 * - **La sacudida**: mueve el decorado (la sala), nunca la cámara ni la mesa, que el mazo va en la
 *   mano y se despegaría de ella.
 * - **La cámara lenta**: la escena la lee (`escalaDelReloj`) y frena con ella el reloj de la mesa.
 * - **El filtro**: un paso bajo en el bus del juego, que tapa el oído un instante.
 * - **El háptico**: los pulsos de la receta común, por la vibración del jugador.
 *
 * El confort de quien juega manda (`capasDelGolpe`). El reloj es el de los fotogramas **sin
 * frenar** (lo que en la web es la hora de pared): la cámara lenta no puede frenar su propia vuelta.
 * Y es el del motor y no el del sistema para que, con `--fixed-fps`, una partida automática dure lo
 * mismo en una máquina rápida que en una lenta.
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
  EN_REPOSO,
  GOLPE,
  capasDelGolpe,
  estadoDelGolpe,
  ladoEnLaVista,
  pulsosDelGolpe,
  sumarGolpe,
  unitaria,
  type Confort,
  type Golpe,
  type Punto3,
} from '@/lib/golpeRecibido'
import type { Pulso } from '@/lib/tactos'

/** A qué distancia de los ojos va la viñeta y lo que mide: de sobra para el visor (`PLANO`). */
const PLANO = { distancia: 0.2, lado: 1.1 } as const

/** El oscurecido de la web (`vinetaOscura`), con las mismas cuentas. */
const SOMBREADOR = `
shader_type spatial;
render_mode unshaded, blend_mix, depth_test_disabled, depth_draw_never, cull_disabled;
uniform float intensidad = 0.0;
uniform vec2 lado = vec2(0.0);
varying vec2 pantalla;
void vertex() {
  vec4 clip = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
  pantalla = clip.xy / clip.w;
}
void fragment() {
  vec2 p = abs(pantalla);
  float r = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
  float hacia = dot(normalize(pantalla + vec2(1e-5)), lado);
  float frontera = mix(1.2, 0.7, intensidad) - 0.2 * hacia * intensidad;
  float sombra = smoothstep(frontera, frontera + 0.35, r);
  ALBEDO = vec3(0.3, 0.0, 0.02);
  ALPHA = sombra * intensidad;
}
`

export interface OpcionesDelGolpe {
  /** El reloj, en segundos: lo que llevan los fotogramas, sin la cámara lenta. */
  reloj: () => number
  /** Lo que se sacude: el decorado. */
  sacudido: Node3D | null
  /** La cámara de la que cuelga la viñeta (la del visor o la de plano). */
  camara: Camera3D | null
  /** El confort de ahora, leído a cada golpe. */
  confort: () => Confort
  /** Los pulsos, por la vibración del jugador. Sin visor, nada. */
  vibrar?: (pulsos: readonly Pulso[]) => void
  /** El bus de audio al que se le pone el paso bajo. Sin bus, sin filtro. */
  bus?: string
}

export class GolpeRecibido {
  private golpes: readonly Golpe[] = []
  private readonly vineta: MeshInstance3D | null = null
  private readonly material: ShaderMaterial | null = null
  private readonly filtro: AudioEffectLowPassFilter | null = null
  private ultimoCorte: number = GOLPE.filtro.abierto
  /** Cuántos golpes se han dado: lo que cuenta un test. */
  dados = 0

  constructor(private readonly opciones: OpcionesDelGolpe) {
    const { camara, bus } = opciones
    if (camara != null) {
      const shader = new Shader()
      shader.code = SOMBREADOR
      this.material = new ShaderMaterial()
      this.material.shader = shader
      this.material.render_priority = 127
      const quad = new QuadMesh()
      quad.size = new Vector2(PLANO.lado, PLANO.lado)
      this.vineta = new MeshInstance3D()
      this.vineta.set_name('GolpeVineta')
      this.vineta.mesh = quad
      this.vineta.material_override = this.material
      this.vineta.position = new Vector3(0, 0, -PLANO.distancia)
      this.vineta.visible = false
      camara.add_child(this.vineta)
    }
    if (bus != null) {
      const indice = AudioServer.get_bus_index(bus)
      if (indice >= 0) {
        this.filtro = new AudioEffectLowPassFilter()
        this.filtro.cutoff_hz = GOLPE.filtro.abierto
        AudioServer.add_bus_effect(indice, this.filtro)
      }
    }
  }

  /**
   * Le han dado a quien juega: `fuerza` de 0 a 1 y `direccion` hacia donde viene el golpe desde
   * quien juega, en el espacio global.
   */
  golpe(fuerza: number, direccion: Punto3 | null): void {
    const capas = capasDelGolpe(fuerza, this.opciones.confort())
    const hacia = unitaria(direccion)
    // Por qué lado de la vista: la dirección, llevada al espacio de la cabeza.
    let lado = { x: 0, y: 0 }
    const camara = this.opciones.camara
    if (direccion != null && camara != null) {
      const enLaCabeza = Basis.MULTIPLY(camara.global_basis.inverse(), new Vector3(hacia.x, hacia.y, hacia.z))
      lado = ladoEnLaVista({ x: enLaCabeza.x, y: enLaCabeza.y, z: enLaCabeza.z })
    }
    this.golpes = sumarGolpe(this.golpes, { inicio: this.opciones.reloj(), capas, direccion: hacia, lado })
    this.dados++
    // El háptico sale en el mismo fotograma que el golpe; los retardos los lleva la cola del kit.
    this.opciones.vibrar?.(pulsosDelGolpe(capas))
  }

  /** A qué ritmo tiene que correr ahora el reloj de la mesa: 1 es el normal. */
  escalaDelReloj(): number {
    return estadoDelGolpe(this.golpes, this.opciones.reloj()).escala
  }

  /** Un fotograma: la sacudida, el filtro y la viñeta. */
  actualizar(): void {
    const estado = estadoDelGolpe(this.golpes, this.opciones.reloj())
    this.golpes = estado === EN_REPOSO ? [] : estado.vivos
    const { sacudido } = this.opciones
    if (sacudido != null) sacudido.position = new Vector3(estado.sacudida.x, estado.sacudida.y, estado.sacudida.z)
    if (this.filtro != null && estado.corte !== this.ultimoCorte) {
      this.ultimoCorte = estado.corte
      this.filtro.cutoff_hz = estado.corte
    }
    if (this.vineta != null && this.material != null) {
      this.vineta.visible = estado.vineta > 0
      this.material.set_shader_parameter('intensidad', estado.vineta)
      this.material.set_shader_parameter('lado', new Vector2(estado.lado.x, estado.lado.y))
    }
  }
}
