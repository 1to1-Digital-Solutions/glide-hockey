import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  PUCK_RADIUS,
  type OpponentSkill,
} from './gameConfig'
import {
  HALF_LENGTH,
  HALF_WIDTH,
  constrainMallet,
  type Body,
  type Vec2,
} from './puckPhysics'
import { deriveSeed } from './seed'

/**
 * Cómo juega la máquina.
 *
 * Dos intenciones y nada más: **defender**, plantándose entre el disco y su
 * portería, y **atacar**, poniéndose detrás del disco para empujarlo hacia la
 * del jugador. Lo que separa a Fácil de Imposible no es cuál elige, sino a qué
 * velocidad se mueve, cuánto se adelanta a donde va a estar el disco, desde cuán
 * lejos sale a buscarlo y **cuánto mezcla los tiros** (ver `OPPONENT_SKILLS` en
 * `gameConfig.ts`).
 *
 * **No hace trampas y no las va a hacer**: nunca se mueve más rápido que el
 * jugador ni cruza la línea de medio campo. Pierde porque no llega a tiempo, que
 * es una razón que se entiende viéndola.
 *
 * **Pero lo que elige no se puede adivinar.** Atacando siempre al mismo poste,
 * a la tercera partida se sabe dónde va a tirar y el juego se acaba ahí. Así que
 * hay tres planes —al hueco, cruzado y a la banda— y el de cada golpe sale de un
 * **hash de la partida, la jugada y el golpe** (`unitHash`): ni un `Math.random`,
 * ni un contador. Lo mismo hace la máquina de table-tennis con su colocación, y
 * por lo mismo: con azar de verdad la misma partida no se repite dos veces, no se
 * puede probar y no cruza a Godot con sus tests; con el hash, dos partidas con la
 * misma semilla son la misma partida y de cara al jugador se ve como lo que es,
 * un rival que no se deja leer.
 *
 * Es una función pura del estado de la mesa: quien la llama mueve el mazo y le
 * pasa el resultado a la física, igual que hace con el del jugador.
 */

export interface OpponentInput {
  puck: Body
  /** Dónde está ahora su mazo. */
  mallet: Vec2
  /** Dónde tiene el jugador el suyo: es a quien hay que buscarle el hueco. */
  playerMallet: Vec2
  skill: OpponentSkill
  /** Segundos transcurridos desde el paso anterior. */
  dt: number
}

/**
 * De qué golpe se está hablando. Es lo que hace que el tiro sea imprevisible sin
 * ser aleatorio: los mismos tres números dan siempre el mismo plan.
 */
export interface AimSeed {
  /** La partida. Dos partidas con distinta semilla no eligen los mismos tiros. */
  match: number
  /** La jugada dentro de la partida: sube con cada saque. */
  rally: number
  /** El golpe dentro de la jugada: sube cada vez que la máquina toca el disco. */
  hit: number
}

/**
 * Un valor entre 0 y 1 a partir de tres enteros: siempre el mismo para los mismos.
 *
 * Es el `unitHash` de la máquina de table-tennis con un número más —la partida—,
 * y mezclado con `Math.imul` en vez de sumando: `imul` es exacto a 32 bits, y con
 * la suma una semilla grande se salía de los enteros que un `double` representa
 * sin perder nada, que es donde un hash deja de repetirse.
 */
export function unitHash(a: number, b: number, c: number): number {
  let x =
    (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b) ^ Math.imul(c, 0xc2b2ae35) ^ 0x1b873593) >>>
    0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  return ((x ^ (x >>> 15)) >>> 0) / 0x100000000
}

/**
 * La semilla de la mesa: la `match` de `AimSeed` con la que la máquina elige sus tiros.
 *
 * Fuera del reto es el número de partida (`runId`), que no repite los tiros de la partida
 * anterior. **En el reto sale de su semilla y de la ronda**, con `semillaDe`: dos personas con el
 * mismo reto ven los mismos tiros en cada ronda, y perder goles en la ronda 2 no cambia los de la
 * 3, que no dependen de cuántas partidas se hayan empezado antes.
 */
export function tableSeed(semillaDelReto: number | null, runId: number, ronda: number): number {
  return semillaDelReto === null ? runId : deriveSeed(semillaDelReto, ronda)
}

/** Hasta dónde llega el disco dentro de la portería sin rozar el poste. */
const GOAL_REACH = GOAL_WIDTH / 2 - PUCK_RADIUS
/** Y hasta dónde llega su centro antes de tocar una banda. */
const PUCK_SIDE_LIMIT = HALF_WIDTH - PUCK_RADIUS

/** Qué plan tiene la máquina para este golpe. */
export type OpponentPlan =
  /** Al poste que el mazo del jugador deja más libre. */
  | 'gap'
  /** Al otro, el que sí cubre: el que engaña a quien se va al hueco antes de tiempo. */
  | 'cross'
  /** A la banda, para que el disco llegue a la portería por el lado contrario. */
  | 'bank'

/**
 * Cuánto hueco deja el mazo del jugador a cada poste, en metros.
 *
 * **Se lee el mazo, no el lado del jugador.** Un mazo a un palmo del poste
 * izquierdo lo tapa aunque su centro esté en la mitad derecha de la portería, y
 * un mazo fuera del marco no tapa ninguno de los dos. Lo que decide es cuánto
 * espacio queda entre el borde del mazo y el punto por el que el disco entra.
 */
export function goalGaps(playerMallet: Vec2): { left: number; right: number } {
  const hueco = (poste: number) =>
    Math.max(0, Math.abs(poste - playerMallet.x) - MALLET_RADIUS)
  return { left: hueco(-GOAL_REACH), right: hueco(GOAL_REACH) }
}

/**
 * El poste con más hueco: `-1` el de la izquierda, `1` el de la derecha.
 *
 * Empatados —el mazo en el centro— se tira a la izquierda: da igual cuál, lo que
 * no vale es el punto muerto de tirarle justo encima. Apuntando siempre al medio,
 * un jugador que deje el mazo delante de su portería es un tapón perfecto: el
 * disco va y vuelve en línea recta entre los dos mazos y la jugada no se acaba.
 */
export function openPost(playerMallet: Vec2): -1 | 1 {
  const { left, right } = goalGaps(playerMallet)
  return right > left ? 1 : -1
}

/** Qué plan toca en este golpe, según lo mezclada que juegue esta dificultad. */
export function planFor(skill: OpponentSkill, seed: AimSeed): OpponentPlan {
  const tirada = unitHash(seed.match, seed.rally, seed.hit)
  if (tirada < skill.bank) return 'bank'
  if (tirada < skill.bank + skill.cross) return 'cross'
  return 'gap'
}

/**
 * A qué punto tira la máquina en este golpe.
 *
 * Se apunta a donde el disco cabe entero, no al poste: rozándolo no entraría
 * (ver `fitsThroughGoal`).
 *
 * El tiro a la banda no apunta a la banda: apunta al **espejo** del poste al otro
 * lado de ella, que es el punto que hace que el disco rebote y acabe entrando. Es
 * un punto de fuera de la mesa a propósito —no es un sitio, es una dirección—, y
 * sale de la geometría y no de un número a ojo: el rebote conserva el ángulo, así
 * que la recta al espejo es exactamente la que pasa por el poste después de
 * rebotar. Con la restitución de la banda por debajo de uno el disco se abre algo
 * hacia ella al salir, y eso lo mete más adentro de la portería, no fuera.
 */
export function aimPoint(playerMallet: Vec2, skill: OpponentSkill, seed: AimSeed): Vec2 {
  const open = openPost(playerMallet)
  switch (planFor(skill, seed)) {
    case 'cross':
      return { x: -open * GOAL_REACH, z: HALF_LENGTH }
    case 'bank':
      // Se rebota en la banda del lado que el jugador cubre y se acaba en el
      // poste libre: así el disco le cruza por delante en vez de llegarle de
      // frente, que es lo que hace que cambie de lado.
      return { x: -open * (2 * PUCK_SIDE_LIMIT + GOAL_REACH), z: HALF_LENGTH }
    default:
      return { x: open * GOAL_REACH, z: HALF_LENGTH }
  }
}

/**
 * Dónde quiere estar el mazo rival.
 *
 * Atacar solo cuando el disco está en su mitad y a tiro: salir a buscarlo al
 * campo contrario no está permitido (`constrainMallet`) y perseguirlo hasta la
 * línea deja la portería abierta al primer rechace.
 */
export function opponentTarget(
  { puck, mallet, playerMallet, skill }: Omit<OpponentInput, 'dt'>,
  seed: AimSeed,
): Vec2 {
  // A dónde va el disco, no dónde está: perseguir la posición actual llega
  // siempre tarde, y es justo lo que hace floja a la dificultad más baja.
  const predicted: Vec2 = {
    x: puck.position.x + puck.velocity.x * skill.anticipation,
    z: puck.position.z + puck.velocity.z * skill.anticipation,
  }

  const reach = Math.hypot(
    puck.position.x - mallet.x,
    puck.position.z - mallet.z,
  )
  const inOwnHalf = puck.position.z < 0

  if (inOwnHalf && reach <= skill.attackRange) {
    // Detrás del disco, en la línea que lo une con el punto al que tira: al
    // avanzar, el golpe sale hacia allí en vez de a cualquier banda.
    const goal = aimPoint(playerMallet, skill, seed)
    const toGoal = {
      x: goal.x - puck.position.x,
      z: goal.z - puck.position.z,
    }
    const distance = Math.hypot(toGoal.x, toGoal.z)
    const contact = PUCK_RADIUS + MALLET_RADIUS
    if (distance > 0) {
      return {
        x: puck.position.x - (toGoal.x / distance) * contact,
        z: puck.position.z - (toGoal.z / distance) * contact,
      }
    }
  }

  // Defensa: a la altura que le toque por dificultad, cubriendo la vertical
  // del disco. El ángulo se cierra apuntando algo hacia el centro, que es de
  // donde salen los rebotes en banda.
  return {
    x: predicted.x * 0.85,
    z: -HALF_LENGTH + skill.defenseDepth * HALF_LENGTH,
  }
}

/**
 * El mazo rival tras `dt` segundos: hacia dónde quiere ir, sin pasarse de su
 * velocidad máxima ni salirse de su mitad.
 *
 * Devuelve también la velocidad con la que llega, que es la que la física
 * necesita para saber con cuánta fuerza golpea (ver `resolveMalletHit`).
 */
export function stepOpponent(
  { puck, mallet, playerMallet, skill, dt }: OpponentInput,
  seed: AimSeed,
): Body {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { position: mallet, velocity: { x: 0, z: 0 } }
  }

  const target = opponentTarget({ puck, mallet, playerMallet, skill }, seed)
  const delta = { x: target.x - mallet.x, z: target.z - mallet.z }
  const distance = Math.hypot(delta.x, delta.z)
  const budget = skill.maxSpeed * dt

  const step =
    distance <= budget || distance === 0
      ? delta
      : { x: (delta.x / distance) * budget, z: (delta.z / distance) * budget }

  const position = constrainMallet(
    { x: mallet.x + step.x, z: mallet.z + step.z },
    'opponent',
  )

  return {
    position,
    // La real, no la pretendida: el recorte por velocidad y por los bordes de
    // la mesa tiene que notarse en la fuerza del golpe, o la máquina dispararía
    // desde una banda como si hubiera llegado lanzada.
    velocity: {
      x: (position.x - mallet.x) / dt,
      z: (position.z - mallet.z) / dt,
    },
  }
}

/** Dónde espera la máquina antes de que empiece la jugada. */
export function opponentStart(skill: OpponentSkill): Vec2 {
  return constrainMallet(
    { x: 0, z: -HALF_LENGTH + skill.defenseDepth * HALF_LENGTH },
    'opponent',
  )
}

/** Dónde empieza el mazo del jugador: delante de su portería. */
export function playerStart(): Vec2 {
  return constrainMallet({ x: 0, z: HALF_LENGTH * 0.72 }, 'player')
}
