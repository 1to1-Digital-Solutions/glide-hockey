/**
 * El salón recreativo alrededor de la mesa: `Room.tsx` de la web, con sus medidas y sus colores.
 *
 * La moqueta con sus bandas, las tres paredes que se ven desde el sitio de quien juega (la cuarta
 * queda a su espalda) con su zócalo, el techo que cierra la sala por arriba, los dos neones de la
 * pared del fondo, **diez recreativas apagadas** —una fila al fondo y tres a cada lado— y el halo
 * bajo la mesa. Con el visor puesto, una mesa flotando en negro marea y no deja calcular
 * distancias: lo que da la escala son las cosas conocidas alrededor, el alto de una máquina y dónde
 * acaba el suelo. Por eso está, y por eso va entero y no solo el suelo.
 *
 * **Lo repetido va en mallas múltiples**, como los `instancedMesh` de la web: las bandas, las
 * paredes, los zócalos y los tres trozos de cada máquina son siete llamadas de dibujo y no
 * cuarenta. Nada de esto se mueve, así que las copias se colocan una vez.
 *
 * **Cuelga del espacio de quien juega** (los pies en el origen), y es lo que se sacude con el golpe
 * recibido: la mesa no, que el mazo va en la mano y se despegaría de ella. Con «tu habitación» se
 * esconde entera y el fondo se vuelve transparente (`mostrar`): un fondo opaco taparía la habitación.
 *
 * Da sombra lo que la da en la web (`castShadow`): los muebles de las máquinas. Las piezas del kit
 * salen sin ella.
 */
import { BoxMesh, Color, Node3D, QuadMesh, Vector2, Vector3, type Environment, type Transform3D } from 'godot'

import { cuadro, anillo, conSombra, mate, multimalla, basico, translucido, tumbar } from '@kit/runtime/escena/piezas'
import { deCuaternion, escalar, giroSobre, multiplicar, transformDe, type M3 } from '@kit/runtime/escena/matrices'

import { NEONES_DEL_FONDO } from '@/lib/cartelDelMarcador'
import { TABLE_CENTER_Z } from '@/lib/gameConfig'
import { PALETTE } from '@/lib/palette'

/** La moqueta oscura de un recreativo y las bandas de su dibujo (`Room.tsx`). */
export const CARPET_COLOR = '#141d33'
const CARPET_STRIPE_COLOR = '#1b2748'
const WALL_COLOR = '#0b1220'
const WALL_TRIM_COLOR = '#070d17'
/** El techo, un punto más oscuro que las paredes; es también el fondo de la escena (`ROOM_BACKDROP`). */
export const CEILING_COLOR = '#070b14'
export const ROOM_BACKDROP = CEILING_COLOR
const CABINET_COLOR = '#24304d'
const SCREEN_COLOR = '#0a1424'
const NEON_PINK = '#f43f5e'
const NEON_CYAN = '#38bdf8'

/** Lo que ocupa la sala y lo que mide una recreativa, los de la web. */
export const ROOM = { width: 9, depth: 10, height: 3.4 } as const
export const CABINET = { width: 0.8, height: 1.85, depth: 0.75 } as const

/** Dónde está cada recreativa y hacia dónde mira. */
export interface SitioDeLaMaquina {
  x: number
  z: number
  giro: number
}

/** Las diez recreativas: cuatro al fondo y tres contra cada pared de los lados, de cara a la mesa. */
export function sitiosDeLasMaquinas(centre = TABLE_CENTER_Z): SitioDeLaMaquina[] {
  return [
    ...[-2.6, -1.5, 1.5, 2.6].map((x) => ({ x, z: centre - ROOM.depth / 2 + 0.5, giro: 0 })),
    ...[-1.5, 0, 1.5].map((z) => ({ x: -ROOM.width / 2 + 0.5, z: centre + z, giro: Math.PI / 2 })),
    ...[-1.5, 0, 1.5].map((z) => ({ x: ROOM.width / 2 - 0.5, z: centre + z, giro: -Math.PI / 2 })),
  ]
}

const X = { x: 1, y: 0, z: 0 }
const Y = { x: 0, y: 1, z: 0 }

function giro(eje: typeof X, angulo: number): M3 {
  return deCuaternion(giroSobre(eje, angulo))
}

/**
 * Una copia colocada como las de la web: el `Euler(rx, ry, 0)` de three va en orden XYZ, es decir
 * `Rx · Ry`, y así se compone aquí. Con las pantallas de los lados eso inclina la pantalla hacia un
 * costado y no hacia atrás, igual que en la web.
 */
function copia(x: number, y: number, z: number, rx: number, ry: number, escala: readonly [number, number, number] = [1, 1, 1]): Transform3D {
  const m = multiplicar(giro(X, rx), giro(Y, ry))
  return transformDe(escalar(m, escala[0], escala[1], escala[2]), x, y, z)
}

function plano(ancho: number, alto: number): QuadMesh {
  const mesh = new QuadMesh()
  mesh.size = new Vector2(ancho, alto)
  return mesh
}

export class Sala {
  /** La sala entera: lo que se esconde con «tu habitación» y lo que sacude el golpe recibido. */
  readonly nodo = new Node3D()
  /** Cuántas copias lleva cada malla múltiple, para que un test las cuente contra la web. */
  readonly copias: Record<'bandas' | 'paredes' | 'zocalos' | 'maquinas', number>
  private conSala: boolean | null = null

  constructor(private readonly entorno: Environment) {
    this.nodo.set_name('Sala')
    const centre = TABLE_CENTER_Z
    const n = this.nodo

    // La moqueta, en el origen como en la web, y sus bandas sobre el centro de la mesa.
    n.add_child(tumbar(cuadro(ROOM.width, ROOM.depth, mate(CARPET_COLOR, { rugosidad: 1 })), 0, 0, 0))
    const bandas = [-4, -2, 0, 2, 4].map((x) => copia(x, 0.002, centre, -Math.PI / 2, 0))
    n.add_child(multimalla(plano(0.5, ROOM.depth), mate(CARPET_STRIPE_COLOR, { rugosidad: 1 }), bandas))

    const lados = [
      { x: 0, z: centre - ROOM.depth / 2, giro: 0, ancho: ROOM.width },
      { x: -ROOM.width / 2, z: centre, giro: Math.PI / 2, ancho: ROOM.depth },
      { x: ROOM.width / 2, z: centre, giro: -Math.PI / 2, ancho: ROOM.depth },
    ]
    const paredes = lados.map((l) => copia(l.x, ROOM.height / 2, l.z, 0, l.giro, [l.ancho, ROOM.height, 1]))
    const zocalos = lados.map((l) => copia(l.x, 0.18, l.z, 0, l.giro, [l.ancho, 0.36, 1]))
    n.add_child(multimalla(plano(1, 1), mate(WALL_COLOR, { rugosidad: 1 }), paredes))
    n.add_child(multimalla(plano(1, 1), mate(WALL_TRIM_COLOR, { rugosidad: 1 }), zocalos))

    // El techo mira hacia abajo, o se vería desde fuera y no desde dentro.
    const techo = cuadro(ROOM.width, ROOM.depth, mate(CEILING_COLOR, { rugosidad: 1 }), new Vector3(0, ROOM.height, centre))
    techo.rotation = new Vector3(Math.PI / 2, 0, 0)
    n.add_child(techo)

    // Los neones de la pared del fondo: dos rayas de luz, sin tono (`toneMapped={false}`).
    // A la altura que deja libre el cartel del objetivo (`NEONES_DEL_FONDO`).
    NEONES_DEL_FONDO.tiras.forEach((neon, i) => {
      const color = [NEON_PINK, NEON_CYAN][i]!
      n.add_child(cuadro(neon.ancho, NEONES_DEL_FONDO.grueso, basico(color), new Vector3(0, neon.y, centre - ROOM.depth / 2 + 0.03)))
    })

    // Las máquinas: el mueble, la pantalla apagada algo inclinada y el cartel encendido de arriba.
    const sitios = sitiosDeLasMaquinas(centre)
    const trozo = (s: SitioDeLaMaquina, lx: number, ly: number, lz: number, inclinacion: number) => {
      // La posición del trozo, girada como el mueble y llevada a su sitio.
      const c = Math.cos(s.giro)
      const sn = Math.sin(s.giro)
      return copia(s.x + lx * c + lz * sn, ly, s.z - lx * sn + lz * c, inclinacion, s.giro)
    }
    const cuerpo = new BoxMesh()
    cuerpo.size = new Vector3(CABINET.width, CABINET.height, CABINET.depth)
    n.add_child(conSombra(multimalla(cuerpo, mate(CABINET_COLOR, { rugosidad: 0.85 }), sitios.map((s) => trozo(s, 0, CABINET.height / 2, 0, 0)))))
    n.add_child(multimalla(plano(CABINET.width * 0.78, 0.5), basico(SCREEN_COLOR), sitios.map((s) => trozo(s, 0, 1.35, CABINET.depth / 2 + 0.01, -0.18))))
    n.add_child(multimalla(plano(CABINET.width * 0.86, 0.26), basico(PALETTE.primaryDeep), sitios.map((s) => trozo(s, 0, CABINET.height - 0.18, CABINET.depth / 2 + 0.01, 0))))

    // El halo bajo la mesa: la separa del suelo y da profundidad sin una textura.
    n.add_child(tumbar(anillo(1.15, 1.9, translucido(PALETTE.primaryDeep, 0.12), 64), 0, 0.004, centre))

    this.copias = { bandas: bandas.length, paredes: paredes.length, zocalos: zocalos.length, maquinas: sitios.length }
  }

  /** Enseña la sala o la quita para ver la habitación; sin sala, el fondo no tapa nada. */
  mostrar(conSala: boolean): void {
    if (conSala === this.conSala) return
    this.conSala = conSala
    this.nodo.visible = conSala
    this.entorno.background_color = conSala ? Color.html(ROOM_BACKDROP) : new Color(0, 0, 0, 0)
  }

  get conLaSala(): boolean {
    return this.conSala ?? true
  }
}
