import { gameStorage } from './storage'

/**
 * El tutorial que se ve dentro del visor la primera vez.
 *
 * **El problema que resuelve.** Los controles no se entienden mirando la escena: el mazo no
 * está en la mano hasta que se cierra el puño, se lanza con el brazo —no con el puntero— y
 * sale **al soltar**, no al apretar. Quien llega nuevo aprende primero a manejar el menú con
 * el rayo, que es justo lo que no sirve para tirar.
 *
 * **Y cómo se resolvía mal.** Era un pase de diapositivas por reloj, con el juego parado: tres
 * frases con un monigote moviéndose, cada una sus segundos, y al acabar el tiempo se daba por
 * aprendido. Quien lo miraba sin hacer nada salía igual que entró, y quien ya lo sabía tenía
 * que esperar. Reportado con el visor puesto: hace falta un botón de siguiente y otro de
 * saltar, hace falta que enseñe **qué botón** del mando se aprieta, y hace falta que **el
 * juego no se pare**: si el paso es agarrar y se agarra, que el mazo aparezca de verdad en la
 * mano; si el paso es lanzar, que no se pase al siguiente hasta que el mazo se clave.
 *
 * **Cómo se resuelve ahora: por logro.** Cada paso se supera **haciéndolo**. El tutorial no
 * lleva reloj: espera. Y siempre hay salida —siguiente y saltar—, porque un paso que no se
 * consiga dejaría a alguien encerrado en él.
 *
 * Aquí vive solo el guion —qué pasos hay, qué los supera y si ya se ha visto—, sin three ni
 * React, para poder probarlo sin navegador ni visor.
 */

/** Qué enseña cada paso, y qué hay que hacer para superarlo. */
export type TutorialStepKey =
  /** Cerrar la mano sobre el mazo: se supera cuando va en ella. */
  | 'grab'
  /** Darle al disco: se supera con el primer golpe. */
  | 'hit'
  /** Marcar: se supera con el primer gol. */
  | 'goal'

/** Los pasos, en orden. */
export const TUTORIAL_STEPS: readonly TutorialStepKey[] = ['grab', 'hit', 'goal']

/**
 * Qué botón del mando enseña cada paso, para dibujarlo resaltado.
 *
 * **Es la mitad de la lección.** Una frase que dice «el botón de agarre» solo sirve a quien ya
 * sabe cuál es; con el visor puesto, lo que hay en la mano es un mando con cinco botones y
 * ninguno con su nombre escrito. `null` es un paso que no va de apretar nada.
 */
export type BotonDelMando = 'agarre' | 'gatillo'

export const TUTORIAL_BUTTONS: Record<TutorialStepKey, BotonDelMando | null> = {
  grab: 'agarre',
  hit: null,
  goal: null,
}

/**
 * Cómo llama WebXR a cada uno de esos botones.
 *
 * Es el puente entre el nombre de andar por casa —el que se usa al escribir la lección— y el
 * identificador del perfil de mando, que es con el que se encuentra la pieza dentro del
 * modelo 3D cuando el tutorial lo enseña a tamaño real sobre la mano (`MandoDeVerdad.tsx`).
 * Los dos nombres son los del estándar y valen para cualquier mando, no solo para los de
 * Quest.
 */
export const COMPONENTE_DEL_BOTON: Record<BotonDelMando, string> = {
  agarre: 'xr-standard-squeeze',
  gatillo: 'xr-standard-trigger',
}

/**
 * Lo que quien juega ya ha hecho. Se **acumula**: hacer algo no se deshace.
 *
 * Vive en el estado de la partida y no aquí porque lo escriben los mismos sitios que ya
 * apuntan lo que pasa —coger, tirar, clavar—, y así el tutorial no necesita ni pararle el
 * juego a nadie ni escuchar nada: **se deduce**.
 */
export type TutorialHitos = Readonly<Record<TutorialStepKey, boolean>>

/** Nada hecho todavía. */
export const SIN_HITOS: TutorialHitos = { grab: false, hit: false, goal: false }

/** Los hitos de antes más el que se acaba de conseguir. */
export function apuntarHito(hitos: TutorialHitos, hito: TutorialStepKey): TutorialHitos {
  if (hitos[hito]) return hitos
  return { ...hitos, [hito]: true }
}

/**
 * Qué paso toca enseñar, o `null` si ya no queda nada.
 *
 * El primero que no esté hecho, saltándose los que se hayan pasado con el botón. Se **calcula**
 * en vez de guardarse: un tutorial que lleva su propia cuenta acaba discrepando de lo que pasa
 * en la partida, y aquí lo que manda es lo que pasa en la partida.
 *
 * @param saltados Cuántos pasos se ha saltado quien juega con el botón de siguiente.
 */
export function tutorialStep(hitos: TutorialHitos, saltados: number): TutorialStepKey | null {
  for (let i = Math.max(0, saltados); i < TUTORIAL_STEPS.length; i += 1) {
    const paso = TUTORIAL_STEPS[i]
    if (!hitos[paso]) return paso
  }
  return null
}

/**
 * Dónde se recuerda que el tutorial ya se ha visto. Con prefijo, como el récord, para no
 * chocar con nada más del mismo origen.
 */
export const TUTORIAL_SEEN_KEY = 'glide-hockey:tutorial-seen'

/** Lo que se escribe cuando ya se ha visto. */
/**
 * Qué se guarda como «ya visto»: **la versión de la lección**, no un sí.
 *
 * Cualquier otro valor la vuelve a enseñar, así que subir este número es la forma de que
 * quien ya la vio la vuelva a ver cuando lo que enseña ha cambiado. La 2 fue la del agarre —la
 * demostración decía «mantén el gatillo» y lo que se aprieta es el de agarre—; la **3** es
 * esta: el tutorial dejó de ser un pase de diapositivas con el juego parado y pasó a hacerse
 * jugando, paso a paso y enseñando qué botón se aprieta. Quien vio la 2 no ha hecho este.
 */
export const TUTORIAL_SEEN_VALUE = '3'

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
