/**
 * Las constantes del juego: la mesa, el disco, los mazos y lo que hace cada
 * dificultad.
 *
 * Vive aparte de la escena porque la física del disco, la máquina rival y sus
 * tests necesitan los mismos números que se pintan: si la mesa se ensancha, el
 * rebote tiene que ensancharse con ella.
 *
 * Todo en metros: la escena está a escala humana y el jugador la ve de pie con
 * el visor. Los colores están en `palette.ts`.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/** Orden de dificultades de menor a mayor para construir selectores. */
export const DIFFICULTY_ORDER: Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'impossible',
]

/** Etiqueta visible, en inglés: es la clave con la que se traduce (ver `textos.ts`). */
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
} as const satisfies Record<Difficulty, string>

/**
 * La mesa, medida como una de verdad pero un poco más estrecha: en el visor se
 * juega apuntando desde el borde, y con los 1,07 m de una de competición el
 * lado lejano queda a un ángulo incómodo.
 *
 * El eje X es el ancho (de banda a banda) y el Z el largo (de portería a
 * portería). El jugador defiende el lado de Z positivo, que es el que tiene
 * delante.
 */
export const TABLE_WIDTH = 1.1
export const TABLE_LENGTH = 2
/** Altura de la superficie de juego sobre el suelo. */
export const TABLE_HEIGHT = 0.9
/**
 * Dónde está el centro de la mesa respecto al jugador, que está en el origen.
 *
 * A 1,2 m de él: el borde cercano le queda a 20 cm, la distancia a la que uno
 * se planta delante de una mesa de verdad.
 */
export const TABLE_CENTER_Z = -1.2

/**
 * Ancho del hueco de cada portería, centrado en la banda del fondo.
 *
 * Medio metro y no cuarenta centímetros. Con el mazo de quince de diámetro, la portería
 * antigua se tapaba sola: el disco entraba por una rendija de doce centímetros y meter gol
 * —o encajarlo— pasaba de raro a improbable. Aquí lo que se busca no es el reglamento de un
 * salón, es que una partida de cinco minutos tenga goles.
 */
export const GOAL_WIDTH = 0.55
/** Alto de las bandas que rodean la mesa, medido desde la superficie. */
export const RAIL_HEIGHT = 0.05

export const PUCK_RADIUS = 0.05
/**
 * Radio del mazo.
 *
 * Algo más pequeño que antes (era 7,5 cm): tapaba media portería él solo, y con la mano
 * puesta encima uno no ve el disco pasar por debajo. Sigue siendo mayor que el disco, que
 * es lo que hace que golpear sea fácil y parar, un poco menos.
 */
export const MALLET_RADIUS = 0.066

/**
 * Rozamiento del disco sobre el colchón de aire, como fracción de velocidad
 * que se pierde por segundo. Bajo a propósito: sobre aire el disco apenas se
 * frena, y un valor alto convierte el juego en empujar en vez de golpear.
 */
export const PUCK_FRICTION = 0.28

/**
 * Tope de velocidad del disco, en m/s.
 *
 * Sin él, dos golpes seguidos en la misma dirección lo dejan yendo tan rápido
 * que atraviesa la banda entre dos fotogramas y se sale de la mesa.
 */
export const MAX_PUCK_SPEED = 6

/** Cuánta velocidad conserva el disco al rebotar en una banda. */
export const WALL_RESTITUTION = 0.9

/**
 * Cuánto devuelve un mazo al golpear: lo de un mazo de verdad contra un disco
 * de verdad, que no llega a devolver todo lo que recibe.
 *
 * Estuvo en 1,15 —por encima de 1— para que un golpe seco saliera más rápido de
 * lo que llegaba. Eso ya lo hace la física sola y sin inventarse energía: el
 * impulso se calcula con la velocidad **relativa**, así que un mazo que avanza
 * a 3 m/s contra un disco que viene a 2 le devuelve casi 7. Lo que hacía el
 * 1,15 era que un mazo QUIETO devolviera el disco más rápido de lo que llegó,
 * que es una mesa que juega sola.
 */
export const MALLET_RESTITUTION = 0.85

/**
 * Velocidad máxima del mazo del jugador, en m/s.
 *
 * El mazo persigue al puntero en vez de aparecer donde él esté: un tirón de
 * ratón lo teletransportaría al otro lado del disco sin tocarlo, y con el rayo
 * del mando cualquier temblor saldría como un golpe. Perseguir con un tope
 * convierte los dos gestos en un movimiento con inercia, que es lo que la
 * física necesita para saber con cuánta fuerza golpea.
 */
export const PLAYER_MALLET_SPEED = 4.5

/** Velocidad a la que sale el disco al sacar de centro, en m/s. */
export const SERVE_SPEED = 1.1

/** Segundos de cuenta atrás entre pulsar «Jugar» y el primer saque. */
export const COUNTDOWN_SECONDS = 3

/** Segundos que se celebra un gol antes de volver a sacar. */
export const GOAL_PAUSE_SECONDS = 1.4

/** Goles a los que se puede jugar una partida de prueba. */
export const MIN_GOALS = 3
export const MAX_GOALS = 15
/** Con cuántos se entra: una partida corta, para probar sin comprometerse. */
export const DEFAULT_GOALS = 7

/** Cómo juega la máquina en cada dificultad. */
export interface OpponentSkill {
  /** Velocidad máxima del mazo rival, en m/s. Es lo que decide a qué llega. */
  maxSpeed: number
  /**
   * Cuánto se adelanta al disco al defender, en segundos: con qué antelación
   * calcula dónde va a estar en vez de perseguir dónde está.
   */
  anticipation: number
  /**
   * A qué distancia de su portería se planta a esperar, en fracción de su
   * mitad de mesa. Cuanto mayor, más adelante presiona y más hueco deja.
   */
  defenseDepth: number
  /**
   * Desde qué distancia sale a golpear el disco, en metros. Corto es esperar
   * atrás; largo es salir a buscarlo hasta media pista.
   */
  attackRange: number
  /**
   * Cada cuántos golpes tira al poste que el jugador **sí** cubre, de 0 a 1.
   *
   * Es el tiro que engaña al que se ha ido al hueco antes de tiempo. A cero, la
   * máquina va siempre al hueco y a la tercera partida se sabe dónde va a tirar.
   */
  cross: number
  /**
   * Y cada cuántos manda el disco a la banda para que llegue por el otro lado,
   * de 0 a 1. Cero por debajo de la dificultad media: un rebote en banda no se
   * lee viniendo, y en Fácil eso no es un rival, es una trampa.
   */
  bank: number
}

/**
 * La dificultad sube por tres sitios a la vez: la máquina se mueve más rápido
 * —llega a discos que antes se le escapaban—, defiende más adelante, lo que
 * cierra el ángulo de tiro, y **mezcla más los tiros**. Los tres hacen falta:
 * solo con velocidad se queda pegada a su portería y el jugador tira desde media
 * pista sin oposición; y sin mezcla, la más rápida de todas sigue tirando siempre
 * al mismo sitio, que es lo que se aprende en tres partidas.
 *
 * Las dos proporciones de tiro se reparten así: `bank` primero, `cross` después y
 * el resto al hueco. En Fácil eso deja el 92 % de los tiros al hueco —previsible
 * a propósito, que es lo que hace que se le pueda ganar mirando—; en Imposible,
 * 30 % al hueco, 40 % cruzado y 30 % a la banda, que ya no se adivina.
 */
export const OPPONENT_SKILLS: Record<Difficulty, OpponentSkill> = {
  easy: { maxSpeed: 0.9, anticipation: 0.05, defenseDepth: 0.18, attackRange: 0.3, cross: 0.08, bank: 0 },
  medium: { maxSpeed: 1.3, anticipation: 0.09, defenseDepth: 0.3, attackRange: 0.45, cross: 0.3, bank: 0.16 },
  hard: { maxSpeed: 1.8, anticipation: 0.13, defenseDepth: 0.42, attackRange: 0.6, cross: 0.34, bank: 0.22 },
  expert: { maxSpeed: 2.4, anticipation: 0.17, defenseDepth: 0.54, attackRange: 0.75, cross: 0.37, bank: 0.26 },
  impossible: { maxSpeed: 3.1, anticipation: 0.22, defenseDepth: 0.66, attackRange: 0.9, cross: 0.4, bank: 0.3 },
}
