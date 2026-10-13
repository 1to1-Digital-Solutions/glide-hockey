/**
 * Las cifras de siete segmentos del marcador: el `XRNumber` de la web (`components/xr/XRUi.tsx`)
 * con el reparto de `lib/xrDigits.ts`, que es puro y entra tal cual.
 *
 * **Segmentos y no letra**, aunque el motor sí tiene letra: el marcador de una mesa de aire se lee
 * de reojo y en marcha, y un siete segmentos grande se lee a cualquier ángulo sin que la
 * tipografía decida nada. Es además lo que se ve en la web, así que las dos versiones enseñan lo
 * mismo en el mismo sitio.
 *
 * Un número es **una sola malla** con los triángulos de todos sus segmentos (`figura` del kit): se
 * rehace solo cuando cambia el valor, que en un partido son unas pocas veces.
 */
import { Node3D, type MeshInstance3D } from 'godot'

import type { Point2 } from '@kit/lib/ui/exit'
import { shape } from '@kit/runtime/ui/mesh'

import { DIGIT_ADVANCE, DIGIT_SEGMENTS, SEGMENT_LAYOUT, SEGMENT_THICKNESS, digitsOf } from '@/lib/xrDigits'

/** Un rectángulo centrado en `(cx, cy)`, en dos triángulos. */
function rectangulo(cx: number, cy: number, ancho: number, alto: number): Point2[] {
  const x0 = cx - ancho / 2
  const x1 = cx + ancho / 2
  const y0 = cy - alto / 2
  const y1 = cy + alto / 2
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]
}

/** Los triángulos de un número de `alto` metros, centrado en el origen como `XRNumber`. */
export function triangulosDeCifras(valor: number, alto: number): Point2[] {
  const cifras = digitsOf(valor)
  const avance = alto * DIGIT_ADVANCE
  const ancho = (cifras.length - 1) * avance
  const largo = alto * 0.42
  const grueso = alto * SEGMENT_THICKNESS
  const triangulos: Point2[] = []
  cifras.forEach((cifra, i) => {
    const x = i * avance - ancho / 2
    for (const segmento of DIGIT_SEGMENTS[cifra]) {
      const { x: sx, y: sy, horizontal } = SEGMENT_LAYOUT[segmento]
      triangulos.push(...rectangulo(x + sx * alto, sy * alto, horizontal ? largo : grueso, horizontal ? grueso : largo))
    }
  })
  return triangulos
}

/** Un número de siete segmentos colgado de un nodo, que se rehace al cambiar. */
export class Cifras {
  readonly nodo = new Node3D()
  private malla: MeshInstance3D | null = null
  private pintado: string | null = null

  constructor(
    private readonly alto: number,
    private color: string,
  ) {}

  /** El valor que enseña ahora, o `null` si no enseña nada. */
  get valor(): number | null {
    return this.pintado == null ? null : Number(this.pintado.split('|')[0])
  }

  pintar(valor: number, color: string = this.color): void {
    const clave = `${digitsOf(valor).join('')}|${color}`
    if (clave === this.pintado) return
    this.pintado = clave
    this.color = color
    if (this.malla != null) {
      this.nodo.remove_child(this.malla)
      this.malla.queue_free()
    }
    this.malla = shape(triangulosDeCifras(valor, this.alto), color)
    this.nodo.add_child(this.malla)
  }
}
