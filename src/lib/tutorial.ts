import { gameStorage } from './storage'

/**
 * Guion del tutorial que se ve dentro del visor la primera vez.
 *
 * **El problema que resuelve.** El mazo no se maneja apuntando: hay que **llevar la mano
 * hasta él y apretar el gatillo lateral** para cogerlo, y entonces va donde va la mano.
 * Apretar desde lejos no lo trae. Nada de eso se deduce mirando la mesa, y el menú se
 * maneja con el rayo del mando, que es justo lo que no mueve el mazo.
 *
 * **Cómo se resuelve.** Una demostración corta entre pulsar «empezar» y la cuenta atrás:
 * la mano acercándose al mazo, el gatillo marcándose al cogerlo, y el mazo yendo con la
 * mano. Sin una sola letra, como el resto de la interfaz inmersiva
 * —`<Text>` de drei descarga las fuentes de un CDN que la CSP del salón bloquea—, así que
 * cada cosa se dice con la geometría que ya significa eso dentro del juego.
 *
 * **Corto de verdad.** La duración total está acotada entre `TUTORIAL_MIN_SECONDS` y
 * `TUTORIAL_MAX_SECONDS`: por debajo no da tiempo a entender el gesto y por encima estorba
 * a quien solo quiere tirar. Un test lo vigila, así que alargar un paso obliga a acortar
 * otro en vez de ir estirando la demostración sin darse cuenta.
 *
 * Aquí vive solo el guion —qué se enseña, cuánto dura y si ya se ha visto—, sin three ni
 * React, para poder probarlo sin navegador ni visor. Es la misma forma que en los demás juegos,
 * a propósito: aprender un juego tiene que servir para el siguiente.
 */

/** Qué enseña cada tramo de la demostración. */
export type TutorialStepKey =
  /** La mano acercándose al mazo: se coge llegando, no apuntando. */
  | 'hand'
  /** El gatillo marcado y el mazo yendo con la mano. */
  | 'draw'
  /** El gatillo suelto y el mazo quedándose donde estaba. */
  | 'release'

export interface TutorialStep {
  key: TutorialStepKey
  /** Cuánto dura en pantalla, en segundos. */
  seconds: number
}

/**
 * Los tres tramos, en orden.
 *
 * El del gatillo es el más largo porque es el que hay que ver pasar: el mazo tiene que
 * recorrer un trecho con la mano para que se entienda que va cogido. Los otros dos son un
 * instante cada uno.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { key: 'hand', seconds: 1.8 },
  { key: 'draw', seconds: 3.2 },
  { key: 'release', seconds: 1.6 },
]

/** Lo mínimo para que dé tiempo a entender el gesto. */
export const TUTORIAL_MIN_SECONDS = 5
/** Lo máximo antes de que estorbe a quien solo quiere jugar. */
export const TUTORIAL_MAX_SECONDS = 10

/** Lo que dura la demostración entera, en segundos. */
export const TUTORIAL_SECONDS = TUTORIAL_STEPS.reduce((total, step) => total + step.seconds, 0)

export interface TutorialFrame {
  /** Tramo que toca enseñar, o `null` cuando la demostración ya ha acabado. */
  step: TutorialStepKey | null
  /** Cuánto lleva recorrido ese tramo, de 0 a 1. */
  stepProgress: number
  /** Cuánto lleva recorrido el tutorial entero, de 0 a 1. */
  progress: number
  done: boolean
}

/** Estado del tutorial cuando ya no queda nada que enseñar. */
const FINISHED: TutorialFrame = { step: null, stepProgress: 1, progress: 1, done: true }

/**
 * Qué se está enseñando a los `elapsed` segundos de arrancar.
 *
 * El reloj lo lleva quien pinta la escena, fotograma a fotograma, así que esto es una
 * función del tiempo y no una máquina de estados: no hay nada que sincronizar si un
 * fotograma llega tarde o si el visor baja de frecuencia.
 */
export function tutorialFrameAt(elapsed: number): TutorialFrame {
  if (!Number.isFinite(elapsed)) return FINISHED
  const time = Math.max(0, elapsed)

  let start = 0
  for (const step of TUTORIAL_STEPS) {
    const end = start + step.seconds
    if (time < end) {
      return {
        step: step.key,
        stepProgress: (time - start) / step.seconds,
        progress: time / TUTORIAL_SECONDS,
        done: false,
      }
    }
    start = end
  }

  // Pasado el último paso no queda nada que enseñar. Es la única salida del final, así que
  // sumar un paso a la lista no puede dejarlo colgado en el anterior.
  return FINISHED
}

/**
 * Dónde se recuerda que el tutorial ya se ha visto. Con prefijo, como el récord,
 * para no chocar con nada más del mismo origen.
 */
export const TUTORIAL_SEEN_KEY = 'air-hockey:tutorial-seen'

/** Lo que se escribe cuando ya se ha visto. */
/**
 * Qué se guarda como «ya visto»: **la versión de la lección**, no un sí.
 *
 * Cualquier otro valor la vuelve a enseñar, así que subir este número es la forma de que
 * quien ya la vio la vuelva a ver cuando lo que enseña ha cambiado. La 2 es la del agarre:
 * la demostración decía «mantén el gatillo» y ahora lo que se aprieta es el botón de agarre,
 * de modo que quien se quedó con la 1 aprendió un gesto que ya no existe.
 */
export const TUTORIAL_SEEN_VALUE = '2'

/**
 * ¿Ya se ha visto la demostración?
 *
 * Lo leído es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo el valor exacto cuenta como visto: cualquier otra cosa la
 * vuelve a enseñar, que es lo que hacía el juego antes de guardar nada.
 */
export function tutorialSeen(storage: Pick<Storage, 'getItem'> | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) === TUTORIAL_SEEN_VALUE
  } catch {
    // Almacenamiento capado: se enseña otra vez. Ver de más es mejor que no entender.
    return false
  }
}

/**
 * Deja constancia de que ya se ha visto.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la demostración se verá también la próxima vez.
 */
export function markTutorialSeen(storage: Storage | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    return true
  } catch {
    return false
  }
}
