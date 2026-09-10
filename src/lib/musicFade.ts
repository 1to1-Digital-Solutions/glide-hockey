/**
 * El fundido de la música: cómo entra y cómo se va.
 *
 * Entraba y salía **de golpe**. Con los auriculares del visor pegados a la oreja, un corte
 * seco se oye como un chasquido y delata la costura: entrar en una cabina, salir de ella o
 * apagar la música en los ajustes eran tres cortes en seco. Medio segundo largo de rampa lo
 * convierte en algo que no se nota, que es lo que tiene que hacer un fondo.
 *
 * Aquí solo está la cuenta, que es lo que se puede comprobar sin oír nada. Quién la mueve y
 * cuándo es cosa de `components/game/useGameMusic.ts`.
 */

/** Lo que dura el fundido, en milisegundos. */
export const MUSIC_FADE_MS = 700

/**
 * El volumen a mitad de un fundido de `from` a `to`, con `progress` de 0 a 1.
 *
 * La curva no es recta: arranca y termina suave (una `smoothstep`). Una rampa recta sobre el
 * volumen sí se nota en los extremos —el oído responde a los decibelios, no a la amplitud—,
 * y lo que se busca es justo que no se note.
 *
 * Fuera de rango se recorta en vez de extrapolar: un reloj que da un salto no puede subir la
 * música por encima de lo que se pidió.
 */
export function fadeVolume(from: number, to: number, progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return from
  if (progress >= 1) return to
  const suave = progress * progress * (3 - 2 * progress)
  return from + (to - from) * suave
}
