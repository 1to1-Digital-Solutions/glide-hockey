import type { Hand } from './settings'
import type { HintScript } from './hints'
import { GOAL_WIDTH, MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from './gameConfig'
import { playerStart } from './opponent'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'

/**
 * Las ayudas visuales de este juego: qué se enseña al entrar, y qué apaga cada cosa.
 *
 * **Lo que no se ve mirando la mesa** son tres cosas. Dónde plantarse —de frente y a un paso,
 * que en air hockey no hay postura de lado—. Que el mazo **se agarra con la mano**, llevándola
 * hasta él y apretando, y no apuntándole con el rayo: es el error que cuesta la primera
 * partida entera, y el que hizo falta arreglar a mano en `lib/malletGrab.ts` («apuntar se
 * siente como manejar un cursor»). Y qué se hace con él: **empujarlo contra el disco**, no
 * esperar a que el disco venga.
 *
 * El motor —cuándo se enciende y cuándo se apaga cada una— está en `lib/ayudas.ts`, el mismo
 * fichero en los dieciséis juegos. Aquí está lo de este: el guion y las cotas de lo que se
 * pinta, que salen de aquí y no de dentro de la escena para que el test pueda medir **los
 * mismos números que se pintan** y no una copia suya.
 *
 * **Lo que hay que coger, resaltado, no está aquí**, y a propósito: el mazo ya se enciende solo
 * mientras la cuenta atrás lo espera (`resaltado` en `components/game/Mallet.tsx`). Nació de
 * una queja distinta —«el countdown se queda parado en el 1 sin ninguna explicación»— y por eso
 * se queda donde está: contesta *por qué no arranca*, que es una pregunta que sigue habiendo
 * pasado el plazo de cualquier ayuda. Añadir aquí un halo ámbar alrededor del mismo mazo sería
 * pintar dos veces la misma frase.
 *
 * Las cotas van en **coordenadas de la mesa** —el eje X de banda a banda, el Z de portería a
 * portería, `y = 0` en la superficie y el jugador defendiendo el `+Z`—, salvo las huellas, que
 * van en el suelo y a los pies de quien entra. Quien las pinta las planta en el sitio que toca
 * (`components/game/Ayudas.tsx`).
 */

/**
 * Lo que una ayuda de este juego puede esperar o dar por hecho.
 *
 * `grab`, `hit` y `goal` son **los mismos hitos que ya usa el tutorial** (`lib/tutorial.ts`), y
 * los apuntan los mismos sitios que ya saben lo que pasa: el mazo al cerrarse la mano sobre él
 * y la mesa al primer golpe y al primer gol. Así una ayuda no escucha nada ni le para el juego
 * a nadie: se deduce.
 *
 * `tanda` es el cuarto y no sale del tutorial: dice que **la partida ha empezado**, que aquí es
 * lo mismo que decir que hay un mazo y un disco sobre la mesa. En el menú el tablero está vacío
 * a propósito —es lo que hace que empezar se note—, y una ayuda que señala un mazo que no está
 * es peor que ninguna ayuda.
 */
export type HintFact = 'round' | 'grab' | 'hit' | 'goal'

/**
 * El guion.
 *
 * - **`suelo`**, las dos huellas de dónde ponerse. Se enseñan **desde que se entra en la
 *   cabina**, porque colocarse es lo único que se puede hacer con la mesa vacía, y son las que
 *   más tarde se apagan: se van con el primer golpe, que es cuando quien juega ya está
 *   colocado de verdad.
 * - **`mando`**, el mando de verdad con el botón de agarre encendido. Espera a que haya
 *   partida, y aquí eso **es una desviación deliberada** de lo que hacen los demás juegos —que
 *   lo enseñan desde que se entra—: en el menú el botón de agarre no hace nada, porque los
 *   paneles se manejan con el rayo. Un botón encendido que no responde enseña una mentira. Sale
 *   **desde la primera partida** (antes esperaba a que se hubiera visto el tutorial) y se apaga
 *   con lo mismo que el mazo fantasma: con `grab` o a los doce segundos. Va **al lado del mazo
 *   fantasma** (`mandoJuntoAlMazo`) y no sobre la mano: la mano la ocupa la copia del tutorial.
 * - **`gesto`**, el mazo fantasma empujando hacia el disco, una y otra vez. Es lo que de verdad
 *   no se adivina, y por eso dura más que el mando.
 * - **`porteria`**, la marca en la portería contraria: adónde va lo que se golpea. **No dice
 *   nada antes de tener el mazo** —sin nada con que golpear, una diana es decorado—, así que
 *   espera a `grab`, y se va con el primer gol.
 *
 * **Las dos que ocupan la mesa se apagan con `grab`**, que es lo que las deja fuera del
 * problema de tapar el juego: el disco no sale hasta que el mazo está en la mano
 * (`HITO_ANTES_DE_QUE_SE_MUEVA_EL_DISCO`), así que cuando algo empieza a correr por la mesa
 * ya no queda ninguna encima. La de la portería se queda, pero va **pintada en el fondo**,
 * donde un calco no puede tapar nada que resbale por encima de él.
 */
export const HINT_SCRIPT = [
  { id: 'floor', until: 'hit', expiresAfter: 15 },
  { id: 'controller', from: 'round', until: 'grab', expiresAfter: 12 },
  { id: 'gesture', from: 'round', until: 'grab', expiresAfter: 12 },
  { id: 'goal', from: 'grab', until: 'goal', expiresAfter: 12 },
] as const satisfies HintScript<HintFact>

/** Cómo se llama cada una, para que la escena no las pinte por un nombre inventado. */
export type MalletHint = (typeof HINT_SCRIPT)[number]['id']

/**
 * Cuáles de ellas ocupan la mesa, en vez de ir pintadas en ella o en el suelo.
 *
 * **Es la lista que decide qué tiene que haberse apagado antes de que el disco salga.** Un
 * calco sobre la superficie no puede tapar nada que resbale por encima; lo que se levanta de
 * ella —el mazo fantasma, el modelo del mando— está en la recta que va de los ojos al disco, y
 * entonces solo vale si desaparece antes de que haya disco que seguir.
 */
export const HINTS_ON_THE_TABLE: readonly MalletHint[] = ['gesture', 'controller']

/**
 * El hito a partir del cual puede moverse el disco.
 *
 * Aquí es gratis y no por suerte: la cuenta atrás **se para en el último segundo** hasta que el
 * mazo va en la mano (ver `malletHeld` en `lib/gameStore.ts`), así que `grab` pasa siempre
 * antes que el saque. Lo comprueba el test, porque es el tipo de cosa que se rompe sola el día
 * que alguien haga que la partida arranque sin esperar a nadie.
 */
export const MILESTONE_BEFORE_PUCK_MOVES = 'grab' satisfies HintFact

/* --- Las cotas de lo que se pinta --- */

/**
 * Las dos huellas, a los pies de quien entra, y lo que mide cada una.
 *
 * **De frente y a la par, no escalonadas**: esa es la postura del air hockey y la mitad del
 * mensaje. En el billar el pie de atrás se retrasa porque el brazo va y viene sobre el eje del
 * taco; aquí las dos manos trabajan por delante del cuerpo y lo que hace falta es poder
 * alcanzar las dos bandas sin mover los pies, que es lo que da una postura cuadrada.
 *
 * Van justo detrás del borde cercano de la mesa, que el juego deja a 20 cm del origen
 * (`TABLE_CENTER_Z`), y separadas el ancho de los hombros.
 */
export const FOOTPRINT = { length: 0.26, width: 0.1 }
export const FOOTPRINTS: readonly { x: number; z: number }[] = [
  { x: -0.11, z: 0.03 },
  { x: 0.11, z: 0.03 },
]

/** A qué altura se pintan las huellas sobre el suelo, antes del sesgo del rasterizado. */
export const FOOTPRINTS_Y = 0.005

/**
 * El empujón que hace el mazo fantasma: por dónde va, cuánto tarda y qué parte es el brazo
 * recogiéndose.
 *
 * **Va despacio hacia atrás y empuja deprisa**, que es lo que distingue un golpe de un vaivén.
 * Con los dos tramos iguales lo que se enseñaba era un limpiaparabrisas.
 *
 * El recorrido sale de dónde nace el mazo (`playerStart()`) y de dónde está el disco al sacar
 * —en el centro—: se recoge un palmo por detrás de su sitio y llega hasta rozar el disco. Que
 * termine **tocándolo** es la mitad de la lección: un fantasma que se para a medio camino
 * enseña a mover el mazo, no a golpear.
 */
export const PUSH = {
  /** Lo que se recoge por detrás de donde nace el mazo, en metros. */
  back: 0.14,
  /** Lo que tarda un empujón entero, en segundos. */
  period: 1.6,
  /** Qué parte de esa vuelta es el brazo recogiéndose. */
  returnAt: 0.62,
} as const

/** Dónde está el disco al sacar: en el centro de la mesa. De ahí sale el final del empujón. */
export const PUCK_AT_SERVE = { x: 0, z: 0 } as const

/**
 * Por dónde pasa el mazo fantasma: de más retrasado que su sitio a tocando el disco.
 *
 * Los dos extremos se calculan y no se escriben: así el fantasma sigue enseñando el gesto
 * bueno el día que el mazo nazca en otro sitio o el disco cambie de tamaño.
 */
export function pushTravel(): { from: number; to: number } {
  const salida = playerStart().z
  return { from: salida + PUSH.back, to: PUCK_AT_SERVE.z + PUCK_RADIUS + MALLET_RADIUS }
}

/**
 * Cuánto está recogido el mazo en este momento del empujón: de 0 —tocando el disco— a 1
 * —atrás del todo—.
 */
export function pushReturn(avance: number): number {
  const paso = Math.min(1, Math.max(0, avance))
  if (paso < PUSH.returnAt) return paso / PUSH.returnAt
  return 1 - (paso - PUSH.returnAt) / (1 - PUSH.returnAt)
}

/** Dónde está el mazo fantasma en ese momento del empujón, en coordenadas de la mesa. */
export function ghostMalletAt(avance: number): { x: number; z: number } {
  const { from: desde, to: hasta } = pushTravel()
  const recogido = pushReturn(avance)
  return { x: PUCK_AT_SERVE.x, z: hasta + (desde - hasta) * recogido }
}

/**
 * La marca de la portería contraria: adónde va lo que se golpea.
 *
 * Va **pegada al fondo y pintada en la superficie**, no levantada como una diana: por ahí pasa
 * el disco, y lo único que puede quedarse mientras se juega es un calco. Ocupa el hueco entero
 * de la portería porque eso es lo que se puede aprovechar —quien apunta al centro exacto está
 * tirando a lo más fácil de parar—, y se mete hacia dentro lo justo para no confundirse con la
 * banda del fondo.
 */
export const GOAL_MARK = {
  /** Lo ancho de la marca: el hueco entero de la portería. */
  width: GOAL_WIDTH,
  /**
   * Lo que ocupa hacia dentro de la mesa.
   *
   * **Catorce centímetros y no ocho.** Se mira desde el otro extremo de una mesa de dos metros
   * y casi a ras de ella, así que lo que se ve de una banda tumbada no es lo que mide: es lo
   * que queda de ella en escorzo. Con ocho se leía como una raya más de las que ya tiene la
   * mesa pintadas, y encima el mazo de la máquina, que defiende justo delante, se comía la
   * mitad.
   */
  depth: 0.14,
  /** Y a cuánto del fondo se planta su centro, dejándola entera dentro de la mesa. */
  z: -HALF_LENGTH + 0.085,
} as const

/**
 * El mando de verdad junto al mazo fantasma: a un palmo de su lado, a la altura de la mano sobre
 * el tablero y crecido lo justo para que el botón se lea desde los ojos.
 *
 * El mazo se coge con la mano que se tenga libre (`MalletHand`), pero la ayuda enseña una: **la
 * mano buena del salón** (`xrcade:hand`), que es la que se echa primero. A la derecha del mazo
 * para un diestro; para un zurdo, el izquierdo y a su izquierda, en espejo.
 *
 * Se planta junto a **donde nace el mazo** (`playerStart()`), que es donde el fantasma empieza su
 * empujón y donde se va a echar la mano. A CALIBRAR CON EL VISOR: las tres cifras.
 */
export const CONTROLLER_BESIDE_MALLET = {
  /** Cuánto se aparta del centro del mazo hacia el lado de la mano, en metros: un palmo de aire entre la punta del mando y el aro. */
  separation: 0.26,
  /** A qué altura sobre el tablero, en metros: donde va la mano al coger el mazo. */
  height: 0.1,
  /** El mando mide unos 12 cm: a casi un metro de los ojos se agradece crecerlo. */
  scale: 1.5,
} as const

/**
 * Dónde va el mando, en coordenadas de la mesa, y cuánto se gira sobre la vertical (el
 * `rotation.y` de three): lo que deja **el costado del agarre de cara a los ojos**.
 *
 * El modelo se dibuja como un mando en la mano, apuntando a −Z; el agarre del derecho está en su
 * costado izquierdo (−X). Sin girar, visto desde los ojos se vería de punta; girado así se ve de
 * lado, con el botón hacia quien juega y la punta hacia el fantasma. Los ojos están sobre el
 * origen del espacio de quien juega, y la mesa a `TABLE_CENTER_Z` de él. El izquierdo lleva el
 * agarre en su +X, y el giro que lo pone de cara es el espejo del derecho.
 */
export function controllerBesideMallet(mano: Hand = 'right'): { position: { x: number; y: number; z: number }; rotation: number } {
  const lado = mano === 'left' ? -1 : 1
  const mazo = playerStart()
  const position = { x: mazo.x + lado * CONTROLLER_BESIDE_MALLET.separation, y: CONTROLLER_BESIDE_MALLET.height, z: mazo.z }
  const delante = -(position.z + TABLE_CENTER_Z)
  return { position: position, rotation: Math.atan2(lado * delante, lado * position.x) }
}

/** A qué altura se pinta lo que va calcado sobre la superficie de la mesa. */
export const DECAL_Y = 0.002

/**
 * Si un punto de la mesa cae dentro de ella, con el margen que se le quiera dar.
 *
 * Sirve para lo único que se puede medir sin gafas de lo que se pinta encima: que no se salga.
 * Una ayuda medio fuera de la mesa no se lee como una ayuda, se lee como un fallo.
 */
export function onTheTable(punto: { x: number; z: number }, margen = 0): boolean {
  return Math.abs(punto.x) <= HALF_WIDTH + margen && Math.abs(punto.z) <= HALF_LENGTH + margen
}

/** Y si cae en la mitad del jugador, que es por donde el mazo puede andar. */
export function inPlayerHalf(punto: { x: number; z: number }): boolean {
  return onTheTable(punto) && punto.z >= 0
}
