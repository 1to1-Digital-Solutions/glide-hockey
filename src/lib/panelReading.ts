/**
 * Lo que ocupa en el ojo lo que se escribe en un panel del visor, **tal como queda el panel**:
 * dónde está respecto de los ojos, cómo gira y en qué fila va cada texto.
 *
 * **El instrumento común mide contra una distancia, y una distancia no basta.**
 * `components/xr/legibilidad.ts` dice si una letra llega a tantos metros, pero no a cuántos
 * metros está. Medir hasta el centro del panel y sin escorzo da por buena la letra que con el
 * visor puesto no se lee: un panel que solo gira alrededor de la vertical y queda por debajo o
 * por encima de los ojos se ve inclinado, y su fila más lejana ocupa menos de lo que diría su
 * centro. En bateo, «Exit» salía a 0,85° mientras el test daba 1,416°.
 *
 * Así que aquí se mide **cada texto en su fila y con el escorzo**, con el tamaño que el lienzo
 * apunta que se escribió —encogido incluido—, contra `MIN_READING_DEGREES`. Y los dos fallos
 * que ninguna distancia ve: un tamaño pintado que no está en la lista del panel (una letra
 * escrita a mano, o encogida para caber) y un texto que se mete en un botón, que es un
 * rectángulo y no un texto.
 *
 * Es el mismo fichero en los juegos que lo usan. Todo en metros y en el espacio de quien juega:
 * los pies en el origen y `−Z` delante. Sin three ni React; la escena coloca lo que sale de aquí.
 */

/** Tres números: una posición o tres ángulos, como los de three. */
export type Triple = readonly [number, number, number]

/** El orden en que se aplican los tres giros, como el de un `Euler` de three. */
export type EulerOrder = 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX'

/** Un punto del espacio de quien juega. */
export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Dónde está un panel y cómo gira, en el espacio de quien juega. */
export interface PanelPose {
  /** Su centro. */
  readonly position: Triple
  /** Como el `rotation` de three: tres ángulos y, si no es `'XYZ'`, el orden. Sin él, de frente a `+Z`. */
  readonly rotation?: Triple | readonly [number, number, number, EulerOrder]
}

/**
 * Lo menos que ocupa en el ojo una letra que se lee de un vistazo, en grados.
 *
 * **Un grado se queda corto**: con todas las letras por encima, el reporte con el visor puesto
 * seguía siendo «para poder verlo bien tendría que dar 2 pasos». Un grado es lo que hace falta
 * para *distinguir* una palabra, no para leer un menú de corrido. Los tres cuartos de grado de
 * `legibilidad.ts` son el suelo del instrumento común; esto es lo que se pide para leer.
 */
export const MIN_READING_DEGREES = 1.4

/**
 * A qué alturas de ojos se mide: alguien sentado o bajo, la de referencia y alguien alto.
 *
 * La interfaz sube y baja con los ojos (`uiRise` en cada juego), así que respecto de ellos debería
 * quedar donde está; medirlo a las tres es lo que demuestra que es así, y lo que cantaría un panel
 * que no los siguiera.
 */
export const EYE_HEIGHTS = [1.2, 1.6, 1.9] as const

/** Los ojos de quien juega, de pie en el origen, a esa altura. */
export function eyesAt(height: number): Point {
  return { x: 0, y: height, z: 0 }
}

/** Un punto girado alrededor de un eje. */
function rotateAbout(axis: 'X' | 'Y' | 'Z', angle: number, p: Point): Point {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (axis === 'X') return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
  if (axis === 'Y') return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }
}

/**
 * Un punto girado como lo gira three con ese `rotation`.
 *
 * three compone la matriz en el orden escrito —`'XYZ'` es `Rx · Ry · Rz`—, así que al punto se le
 * aplica primero el último giro.
 */
export function rotate(point: Point, rotation?: PanelPose['rotation']): Point {
  if (rotation == null) return point
  const [x, y, z] = rotation
  const order: EulerOrder = rotation[3] ?? 'XYZ'
  const angles = { X: x, Y: y, Z: z }
  return [...order].reverse().reduce((p, axis) => rotateAbout(axis as 'X' | 'Y' | 'Z', angles[axis as 'X' | 'Y' | 'Z'], p), point)
}

/** Dónde cae un punto del panel, en su plano y desde su centro, en el espacio de quien juega. */
export function pointOnPanel(pose: PanelPose, localX: number, localY: number): Point {
  const offset = rotate({ x: localX, y: localY, z: 0 }, pose.rotation)
  return { x: pose.position[0] + offset.x, y: pose.position[1] + offset.y, z: pose.position[2] + offset.z }
}

/** El giro alrededor de la vertical que deja la cara de un panel (`+Z`) mirando hacia los ojos. */
export function facingEyes(position: Triple, eyes: Point): number {
  return Math.atan2(eyes.x - position[0], eyes.z - position[2])
}

/**
 * Cuánto se inclina un panel para mirar a los ojos, como el `rotation.x` de three.
 *
 * **Un panel vertical por debajo o por encima de la vista se lee escorzado**: de canto, sus
 * letras ocupan en el ojo menos de lo que ocuparían de frente. Inclinado hacia los ojos, se lee
 * de frente.
 */
export function tiltTowardEyes(position: Triple, eyes: Point): number {
  return -Math.atan2(eyes.y - position[1], Math.hypot(eyes.x - position[0], eyes.z - position[2]))
}

/**
 * El giro entero de un panel que mira a los ojos, en el orden en que se aplica: primero de cara y
 * luego inclinado. Es lo que recibe `rotation` en la escena, y lo heredan las cajas de pulsación
 * que cuelgan del mismo grupo.
 */
export function panelRotation(position: Triple, eyes: Point): [number, number, number, 'YXZ'] {
  return [tiltTowardEyes(position, eyes), facingEyes(position, eyes), 0, 'YXZ']
}

/** A cuántos metros de los ojos queda el centro de un panel, contando la altura. */
export function distanceFromEyes(position: Triple, eyes: Point): number {
  return Math.hypot(position[0] - eyes.x, position[1] - eyes.y, position[2] - eyes.z)
}

/**
 * Cuántos grados ocupa en el ojo algo de ese alto escrito en ese punto del panel.
 *
 * Contando el escorzo: una fila lejos del centro de un panel grande, o un panel que no mira a los
 * ojos, ya no se ve de frente.
 */
export function letterAngle(pose: PanelPose, eyes: Point, localX: number, localY: number, height: number): number {
  const low = pointOnPanel(pose, localX, localY - height / 2)
  const high = pointOnPanel(pose, localX, localY + height / 2)
  const a = { x: low.x - eyes.x, y: low.y - eyes.y, z: low.z - eyes.z }
  const b = { x: high.x - eyes.x, y: high.y - eyes.y, z: high.z - eyes.z }
  const cosine = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))
  return (Math.acos(Math.min(1, cosine)) * 180) / Math.PI
}

/**
 * A qué distancia tendría que estar de frente algo de ese alto para ocupar lo mismo que ocupa ahí:
 * la distancia con la que se le pasa el texto a `problemasDeLegibilidad`.
 */
export function readingDistance(pose: PanelPose, eyes: Point, localX: number, localY: number, height: number): number {
  const radians = (letterAngle(pose, eyes, localX, localY, height) * Math.PI) / 180
  return height / (2 * Math.tan(radians / 2))
}

/**
 * Un texto escrito en un panel, como lo apunta el lienzo que mide (`Escrito`): centro y caja, en
 * metros y en coordenadas del panel.
 */
export interface WrittenText {
  readonly texto: string
  readonly x: number
  readonly y: number
  readonly ancho: number
  /** El alto de su caja: el de la letra por el alto de línea (`ALTO_DE_LINEA`). */
  readonly alto: number
}

/** Lo que ocupa en el ojo un texto apuntado, con la letra con que se escribió. */
function textAngle(text: WrittenText, pose: PanelPose, eyes: Point, lineHeight: number): number {
  return letterAngle(pose, eyes, text.x, text.y, text.alto / lineHeight)
}

/** El alto de letra de un texto apuntado, en milímetros y con un decimal, para decirlo. */
function millimetres(text: WrittenText, lineHeight: number): string {
  return ((text.alto / lineHeight) * 1000).toFixed(1)
}

/**
 * Los textos que no se leen de un vistazo desde esos ojos, **tal como los apunta el lienzo**: con
 * el tamaño con que se escribieron, en la fila donde se escribieron y con el escorzo.
 *
 * @param lineHeight Cuánto alto de caja ocupa la letra (`ALTO_DE_LINEA`).
 */
export function unreadableTexts(
  texts: readonly WrittenText[],
  pose: PanelPose,
  eyes: Point,
  lineHeight: number,
  minimum = MIN_READING_DEGREES,
): string[] {
  return texts
    .map((text) => ({ text, degrees: textAngle(text, pose, eyes, lineHeight) }))
    .filter(({ degrees }) => degrees < minimum)
    .map(({ text, degrees }) => `«${text.texto}» a ${millimetres(text, lineHeight)} mm ocupa ${degrees.toFixed(2)}°`)
}

/** El texto que peor se lee desde esos ojos y cuántos grados ocupa, o `null` si no hay ninguno. */
export function worstText(
  texts: readonly WrittenText[],
  pose: PanelPose,
  eyes: Point,
  lineHeight: number,
): { texto: string; degrees: number } | null {
  let worst: { texto: string; degrees: number } | null = null
  for (const text of texts) {
    const degrees = textAngle(text, pose, eyes, lineHeight)
    if (worst == null || degrees < worst.degrees) worst = { texto: text.texto, degrees }
  }
  return worst
}

/** La distancia de lectura del texto que peor se lee: con la que hay que medir el panel entero. */
export function worstReadingDistance(texts: readonly WrittenText[], pose: PanelPose, eyes: Point, lineHeight: number): number {
  return Math.max(...texts.map((text) => readingDistance(pose, eyes, text.x, text.y, text.alto / lineHeight)))
}

/** Los textos escritos a un tamaño que no está en la lista: escritos a mano, o encogidos para caber. */
export function sizesOffList(texts: readonly WrittenText[], lineHeight: number, sizes: readonly number[]): string[] {
  return texts
    .filter((text) => !sizes.some((size) => Math.abs(text.alto / lineHeight - size) < 1e-6))
    .map((text) => `«${text.texto}» a ${millimetres(text, lineHeight)} mm`)
}

/** Un botón del panel: centro y medidas, en metros. */
export interface PanelButton {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Si el centro de un texto cae dentro de un botón: es su etiqueta. */
export function centreInside(text: WrittenText, button: PanelButton): boolean {
  return Math.abs(text.x - button.x) <= button.width / 2 && Math.abs(text.y - button.y) <= button.height / 2
}

/** Ningún texto es de ningún botón: el panel escribe rótulos y los botones llevan iconos. */
export function noTextOwnsAButton(): boolean {
  return false
}

/**
 * Los textos que se meten en un botón que no es el suyo.
 *
 * El instrumento de legibilidad mira que los textos no se pisen entre ellos, pero un botón es un
 * rectángulo, no un texto: un rótulo que crece al agrandar la letra se mete en la fila de botones
 * sin que nada lo cante.
 *
 * @param ownsButton Qué texto es el de un botón, y puede ir dentro. Por defecto, el que tiene el
 *   centro dentro de él; en un panel de rótulos sin letras en los botones no lo es ninguno, y así
 *   un rótulo que se meta más de la mitad en un botón tampoco pasa.
 */
export function textsOnButtons(
  texts: readonly WrittenText[],
  buttons: readonly PanelButton[],
  ownsButton: (text: WrittenText, button: PanelButton) => boolean = centreInside,
): string[] {
  const problems: string[] = []
  for (const text of texts) {
    for (const button of buttons) {
      if (ownsButton(text, button)) continue
      const overlaps =
        Math.abs(text.x - button.x) * 2 < text.ancho + button.width &&
        Math.abs(text.y - button.y) * 2 < text.alto + button.height
      if (overlaps) problems.push(`«${text.texto}» se mete en el botón de (${button.x.toFixed(2)}, ${button.y.toFixed(2)})`)
    }
  }
  return problems
}
