/**
 * Qué se deja de ver por culpa de un panel del visor.
 *
 * **Lo que mide `panelReading.ts` es si el panel se lee; esto es si el panel estorba.** Son dos
 * preguntas distintas y la segunda no se ve desde una pantalla: en el navegador se mira la
 * escena desde donde uno quiera y el panel parece estar «al lado», pero con el visor puesto se
 * mira desde un solo sitio —los ojos de quien juega— y una placa de metro y pico plantada a un
 * metro tapa lo que haya detrás. El menú de ajustes de este juego estaba justo delante: tapaba
 * media mesa, el marcador entero y la demostración del gesto, y eso solo se supo con las gafas.
 *
 * Como `legibilidad.ts` y `exitCorner.ts`, **devuelve frases y no un `false`**: qué tapa y
 * cuánto, que es lo que hace falta para saber hacia dónde moverlo.
 *
 * Todo en metros y en el espacio de quien juega: los pies en el origen y `−Z` delante.
 */

import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'
import { rotate, type PanelPose, type Point, type Triple } from './panelReading'

/** Lo que mide un panel, en metros. */
export interface PanelSize {
  readonly width: number
  readonly height: number
}

/** Un punto de la escena con su nombre, para poder decir qué se ha tapado. */
export interface Landmark {
  readonly que: string
  readonly puntos: readonly Point[]
}

const vector = (x: number, y: number, z: number): Point => ({ x, y, z })
const menos = (a: Point, b: Point): Point => vector(a.x - b.x, a.y - b.y, a.z - b.z)
const por = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z
const aspa = (a: Point, b: Point): Point =>
  vector(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

/**
 * ¿Se cruza el panel entre los ojos y ese punto?
 *
 * El panel es un rectángulo en su plano, así que basta con dónde corta la recta a ese plano
 * —`t` entre 0 y 1: por detrás de los ojos o más allá del punto no tapa nada— y si el corte cae
 * dentro del rectángulo.
 *
 * Sin guarda para el rayo paralelo al panel: ahí `t` sale infinito o `NaN`, y las dos
 * comparaciones de abajo lo descartan igual. Una rama que ningún test puede distinguir es una
 * rama que miente sobre lo que está probado.
 */
export function hiddenByPanel(pose: PanelPose, size: PanelSize, eyes: Point, target: Point): boolean {
  const centre = vector(pose.position[0], pose.position[1], pose.position[2])
  const right = rotate(vector(1, 0, 0), pose.rotation)
  const up = rotate(vector(0, 1, 0), pose.rotation)
  const normal = aspa(right, up)

  const hacia = menos(target, eyes)
  const t = por(normal, menos(centre, eyes)) / por(normal, hacia)
  if (t <= 0 || t >= 1) return false

  const corte = menos(vector(eyes.x + hacia.x * t, eyes.y + hacia.y * t, eyes.z + hacia.z * t), centre)
  return Math.abs(por(corte, right)) <= size.width / 2 && Math.abs(por(corte, up)) <= size.height / 2
}

/**
 * Lo que este panel tapa, dicho con frases.
 *
 * Se cuenta sobre una rejilla de puntos y se dice la proporción: que tape una esquina de la
 * mesa y que tape media son cosas distintas, y un `false` las contaría igual.
 */
export function whatThePanelHides(
  pose: PanelPose,
  size: PanelSize,
  eyes: Point,
  landmarks: readonly Landmark[],
): string[] {
  return landmarks
    .map(({ que, puntos }) => ({
      que,
      tapados: puntos.filter((punto) => hiddenByPanel(pose, size, eyes, punto)).length,
      total: puntos.length,
    }))
    .filter(({ tapados }) => tapados > 0)
    .map(({ que, tapados, total }) => `el panel tapa ${que} en ${tapados} de ${total} puntos`)
}

/**
 * Una rejilla sobre el tablero, que es por donde va el disco.
 *
 * El disco no tiene un sitio: recorre la mesa entera, así que lo que hay que mirar es si el
 * panel tapa **algún** punto del tablero, no si tapa donde está el disco ahora.
 */
export function tablePoints(steps: number): Point[] {
  const puntos: Point[] = []
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      puntos.push(
        vector(
          -HALF_WIDTH + (2 * HALF_WIDTH * i) / steps,
          TABLE_HEIGHT,
          TABLE_CENTER_Z - HALF_LENGTH + (2 * HALF_LENGTH * j) / steps,
        ),
      )
    }
  }
  return puntos
}

/** Una rejilla sobre la cara de otro panel —el marcador, la demostración— para ver si se pisan. */
export function panelPoints(centre: Triple, size: PanelSize, steps: number): Point[] {
  const puntos: Point[] = []
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      puntos.push(
        vector(
          centre[0] - size.width / 2 + (size.width * i) / steps,
          centre[1] - size.height / 2 + (size.height * j) / steps,
          centre[2],
        ),
      )
    }
  }
  return puntos
}
