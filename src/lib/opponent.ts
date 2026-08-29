import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  PUCK_RADIUS,
  type OpponentSkill,
} from './gameConfig'
import {
  HALF_LENGTH,
  constrainMallet,
  type Body,
  type Vec2,
} from './puckPhysics'

/**
 * Cómo juega la máquina.
 *
 * Dos intenciones y nada más: **defender**, plantándose entre el disco y su
 * portería, y **atacar**, poniéndose detrás del disco para empujarlo hacia la
 * del jugador. Lo que separa a Fácil de Imposible no es cuál elige, sino a qué
 * velocidad se mueve, cuánto se adelanta a donde va a estar el disco y desde
 * cuán lejos sale a buscarlo (ver `OPPONENT_SKILLS` en `gameConfig.ts`).
 *
 * Sin nada de azar a propósito: una máquina que falla por un número aleatorio
 * no se puede probar, y de cara al jugador su nivel se vuelve caprichoso. Aquí
 * pierde porque no llega a tiempo, que es una razón que se entiende viéndola.
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
 * A qué punto de la portería del jugador tira la máquina.
 *
 * **Al lado que él no cubre**, no al centro. Apuntando siempre al medio, un
 * jugador que deje el mazo delante de su portería es un tapón perfecto: el
 * disco va y vuelve en línea recta entre los dos mazos y no se acaba nunca la
 * jugada. Buscar el poste contrario es además lo que hace cualquiera que juegue
 * de verdad.
 *
 * Se apunta a donde el disco cabe entero, no al poste: rozándolo no entraría
 * (ver `fitsThroughGoal`).
 */
export function aimPoint(playerMallet: Vec2): Vec2 {
  const reach = GOAL_WIDTH / 2 - PUCK_RADIUS
  // Empatados en el centro se tira a la izquierda: da igual cuál, lo que no
  // vale es el punto muerto de tirarle justo encima.
  const side = playerMallet.x >= 0 ? -1 : 1
  return { x: side * reach, z: HALF_LENGTH }
}

/**
 * Dónde quiere estar el mazo rival.
 *
 * Atacar solo cuando el disco está en su mitad y a tiro: salir a buscarlo al
 * campo contrario no está permitido (`constrainMallet`) y perseguirlo hasta la
 * línea deja la portería abierta al primer rechace.
 */
export function opponentTarget({
  puck,
  mallet,
  playerMallet,
  skill,
}: Omit<OpponentInput, 'dt'>): Vec2 {
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
    const goal = aimPoint(playerMallet)
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
export function stepOpponent({
  puck,
  mallet,
  playerMallet,
  skill,
  dt,
}: OpponentInput): Body {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { position: mallet, velocity: { x: 0, z: 0 } }
  }

  const target = opponentTarget({ puck, mallet, playerMallet, skill })
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
