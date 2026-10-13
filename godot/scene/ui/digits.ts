/**
 * The seven-segment digits of the scoreboard: the web's `XRNumber` (`components/xr/XRUi.tsx`)
 * with the layout of `lib/xrDigits.ts`, which is pure and goes in as it is.
 *
 * **Segments and not a font**, even though the engine does have a font: the scoreboard of an air
 * table is read out of the corner of the eye and on the move, and a big seven-segment digit reads
 * at any angle without the typography deciding anything. It is also what is seen on the web, so
 * the two versions show the same thing in the same place.
 *
 * A number is **a single mesh** with the triangles of all its segments (the kit's `shape`): it is
 * rebuilt only when the value changes, which in a match is a few times.
 */
import { Node3D, type MeshInstance3D } from 'godot'

import type { Point2 } from '@kit/lib/ui/exit'
import { shape } from '@kit/runtime/ui/mesh'

import { DIGIT_ADVANCE, DIGIT_SEGMENTS, SEGMENT_LAYOUT, SEGMENT_THICKNESS, digitsOf } from '@/lib/xrDigits'

/** A rectangle centred on `(cx, cy)`, in two triangles. */
function rectangle(cx: number, cy: number, width: number, height: number): Point2[] {
  const x0 = cx - width / 2
  const x1 = cx + width / 2
  const y0 = cy - height / 2
  const y1 = cy + height / 2
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]
}

/** The triangles of a number `height` metres tall, centred on the origin like `XRNumber`. */
export function digitTriangles(value: number, height: number): Point2[] {
  const digits = digitsOf(value)
  const advance = height * DIGIT_ADVANCE
  const width = (digits.length - 1) * advance
  const length = height * 0.42
  const thickness = height * SEGMENT_THICKNESS
  const triangles: Point2[] = []
  digits.forEach((digit, i) => {
    const x = i * advance - width / 2
    for (const segment of DIGIT_SEGMENTS[digit]) {
      const { x: sx, y: sy, horizontal } = SEGMENT_LAYOUT[segment]
      triangles.push(...rectangle(x + sx * height, sy * height, horizontal ? length : thickness, horizontal ? thickness : length))
    }
  })
  return triangles
}

/** A seven-segment number hanging from a node, which is rebuilt when it changes. */
export class Digits {
  readonly node = new Node3D()
  private mesh: MeshInstance3D | null = null
  private painted: string | null = null

  constructor(
    private readonly height: number,
    private color: string,
  ) {}

  /** The value it shows now, or `null` if it shows nothing. */
  get value(): number | null {
    return this.painted == null ? null : Number(this.painted.split('|')[0])
  }

  paint(value: number, color: string = this.color): void {
    const key = `${digitsOf(value).join('')}|${color}`
    if (key === this.painted) return
    this.painted = key
    this.color = color
    if (this.mesh != null) {
      this.node.remove_child(this.mesh)
      this.mesh.queue_free()
    }
    this.mesh = shape(digitTriangles(value, this.height), color)
    this.node.add_child(this.mesh)
  }
}
