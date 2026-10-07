/**
 * El cartel del objetivo en este juego: dónde cuelga y qué partida le cuenta.
 *
 * El cartel es común a todos los juegos del salón (`objetivo.ts` y `CartelDeObjetivo.tsx`); lo
 * que es del air hockey está aquí: que va **encima del marcador del fondo**, sobre la portería de
 * la máquina, que es donde ya se mira jugando; que la partida que cuenta es el reto, y que lo que
 * le queda a quien juega es la ronda, a cuántos goles se juega y lo que vale el próximo gol.
 *
 * Sin three ni React: la escena coloca lo que sale de aquí, los tests lo miden y el port a Godot
 * lo lee tal cual.
 */

import { challengeRound } from './challenge'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { GAME_MODE_LABELS, type GameMode } from './gameMode'
import { MEDALLAS, cuentaParaMedalla, type Medalla, type Objetivo, type Partida, type Traducir } from './objetivo'
import { distanceFromEyes, eyesAt, panelRotation, pointOnPanel, type PanelPose, type Triple } from './panelReading'
import { HALF_LENGTH } from './puckPhysics'
import { goalPoints } from './scoring'
import { RECETAS, pulsosDe, type Mano, type Pulso } from './tactos'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * El marcador del fondo, en el espacio de la mesa (su centro, a la altura del tablero): sobre la
 * portería de la máquina e inclinado hacia quien juega. Es de donde cuelga el cartel, y por eso
 * sus medidas viven aquí y la escena las lee.
 */
export const MARCADOR_DEL_FONDO = {
  centro: [0, 0.5, -HALF_LENGTH - 0.05] as [number, number, number],
  /** Como el `rotation.x` de three: echado hacia atrás, de cara a los ojos. */
  inclinacion: -0.18,
  ancho: 0.52,
  alto: 0.34,
} as const

/** El aire entre el canto de arriba del marcador y el cartel, en metros. */
export const AIRE_SOBRE_EL_MARCADOR = 0.03

/** Lo que mide el cartel por cada metro de distancia de lectura: su ancho y su alto. */
export interface ProporcionDelCartel {
  readonly ancho: number
  readonly alto: number
}

/** Dónde queda el cartel y cómo se orienta. */
export interface SitioDelCartel {
  /** Su centro, en el espacio de la mesa, que es de donde cuelga la interfaz. */
  readonly position: [number, number, number]
  /** Como el `rotation` de three: de cara a los ojos e inclinado hacia ellos. */
  readonly rotation: [number, number, number, 'YXZ']
  /** De los ojos al centro del cartel, en metros: de ahí sale su tamaño. */
  readonly distancia: number
}

/** Del espacio de la mesa al de quien juega: los pies en el origen y el `−Z` delante. */
function delEspacioDelJugador(pieza: Triple): [number, number, number] {
  return [pieza[0], pieza[1] + TABLE_HEIGHT, pieza[2] + TABLE_CENTER_Z]
}

/** El centro del canto de arriba del marcador, en el espacio de quien juega. */
export function cantoDeArribaDelMarcador(): { x: number; y: number; z: number } {
  const pose: PanelPose = {
    position: delEspacioDelJugador(MARCADOR_DEL_FONDO.centro),
    rotation: [MARCADOR_DEL_FONDO.inclinacion, 0, 0],
  }
  return pointOnPanel(pose, 0, MARCADOR_DEL_FONDO.alto / 2)
}

/** La pose del cartel ya colocado, en el espacio de quien juega: para medirlo. */
export function poseDelCartel(sitio: SitioDelCartel): PanelPose {
  return { position: delEspacioDelJugador(sitio.position), rotation: sitio.rotation }
}

/**
 * Dónde va el cartel: **encima del marcador del fondo, centrado**, con su canto de abajo a un
 * dedo del canto de arriba del marcador y de cara a los ojos de quien juega.
 *
 * Ahí queda a la altura de la vista y de frente: se lee sin girar la cabeza ni levantarla, y por
 * encima de la mesa entera, así que no tapa ni el disco ni la portería. Cuelga de la interfaz, que
 * sube y baja con los ojos (`XRUiHeight`), igual que el marcador: lo que mide desde ellos no
 * cambia con la estatura.
 *
 * El tamaño depende de la distancia y la distancia de dónde acabe el centro, que a su vez depende
 * del tamaño y de la inclinación: se corrige el centro con lo que falta, unas cuantas vueltas.
 *
 * @param proporcion Lo que mide el cartel por metro de distancia de lectura.
 */
export function sitioDelCartel(proporcion: ProporcionDelCartel): SitioDelCartel {
  const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
  const canto = cantoDeArribaDelMarcador()
  const apoyo = { x: canto.x, y: canto.y + AIRE_SOBRE_EL_MARCADOR, z: canto.z }

  let centro: [number, number, number] = [apoyo.x, apoyo.y, apoyo.z]
  for (let vuelta = 0; vuelta < 12; vuelta++) {
    const pose: PanelPose = { position: centro, rotation: panelRotation(centro, ojos) }
    const abajo = pointOnPanel(pose, 0, (-proporcion.alto * distanceFromEyes(centro, ojos)) / 2)
    centro = [centro[0] + apoyo.x - abajo.x, centro[1] + apoyo.y - abajo.y, centro[2] + apoyo.z - abajo.z]
  }
  return {
    position: [centro[0], centro[1] - TABLE_HEIGHT, centro[2] - TABLE_CENTER_Z],
    rotation: panelRotation(centro, ojos),
    distancia: distanceFromEyes(centro, ojos),
  }
}

/**
 * Dónde va el tutorial de la primera vez: **a un lado del cartel**, a la derecha.
 *
 * Estaba de frente, sobre la mesa y a 1,2 m: 36° de ancho por 28° de alto justo delante del
 * marcador (13° de ancho) y del cartel (24°), que quedaban tapados enteros mientras duraba —y la
 * primera partida es el reto, la que tiene objetivo que leer—. Por arriba no cabe sin levantar la
 * cabeza 19° y por abajo taparía la mesa, así que se aparta: a la misma distancia y a la misma
 * altura, girado hacia los ojos, con lo que cada letra ocupa los mismos grados que ocupaba. A 32°
 * su canto izquierdo queda a 14° del frente y el cartel acaba a 12°: dos grados de aire. A la
 * derecha, porque a la izquierda está el botón de parar (55°). A CALIBRAR CON EL VISOR.
 */
export const TUTORIAL_A_UN_LADO = {
  /** Grados a la derecha del frente. */
  azimut: 32,
  /** De los ojos al panel, en horizontal. */
  distancia: 1.2,
  /** Lo que sube su centro sobre los ojos de referencia. */
  sobreLosOjos: 0.02,
} as const

/**
 * El centro del tutorial, en el espacio de la mesa.
 *
 * @param azimut Grados a la derecha del frente; con cero, de frente: donde estaba, y donde sigue
 *   en plano, que no tiene a dónde girar la cabeza.
 */
export function sitioDelTutorial(azimut: number = TUTORIAL_A_UN_LADO.azimut): [number, number, number] {
  const giro = (azimut * Math.PI) / 180
  return [
    TUTORIAL_A_UN_LADO.distancia * Math.sin(giro),
    REFERENCE_EYE_HEIGHT + TUTORIAL_A_UN_LADO.sobreLosOjos - TABLE_HEIGHT,
    -TUTORIAL_A_UN_LADO.distancia * Math.cos(giro) - TABLE_CENTER_Z,
  ]
}

/**
 * Las dos tiras de neón de la pared del fondo: a qué altura va el centro de cada una y cuánto
 * miden, en metros. Las pintan `Room.tsx` y, en Godot, `sala.ts`.
 *
 * **Su altura depende del cartel.** El cartel sube con los ojos y la pared no: desde 1,6 m quedaba
 * 1,9° por debajo de la tira de abajo, pero a partir de 1,8 m la alcanzaba y a 1,9 m la tenía
 * detrás entera, brillando a través del fondo del cartel. Quince centímetros más arriba las dos
 * —la separación entre ellas no cambia— quedan 0,4° de aire con los ojos a 1,9 m; más abajo,
 * más (`cartelDelMarcador.legible.test.ts`).
 */
export const NEONES_DEL_FONDO = {
  grueso: 0.06,
  tiras: [
    { y: 2.75, ancho: 5 },
    { y: 2.45, ancho: 3.6 },
  ],
} as const

/** El modo del que salen las medallas: el del récord de la cabina. */
const MODO_QUE_CUENTA: GameMode = 'challenge'

/** La misión del reto en una frase. */
export const MISION_DEL_RETO = 'Win games until you lose one'

/** Lo que le queda a quien juega: la ronda, a cuántos goles va y lo que vale el próximo. */
export const LO_QUE_QUEDA = 'Round {round} · to {goals} goals · goal +{points}'

/**
 * Lo que queda, escrito. **De ahí salen los miles de los listones**: el próximo gol vale lo que
 * diga la ronda —la máquina sube de nivel y los goles valen más— y la racha que se lleve.
 */
export function loQueQueda(round: number, streak: number, t: Traducir): string {
  const ronda = challengeRound(round)
  return t(LO_QUE_QUEDA, {
    round: ronda.round,
    goals: ronda.goalTarget,
    points: goalPoints({ difficulty: ronda.difficulty, streak: streak + 1, lap: ronda.multiplier }),
  })
}

/** Si ese modo da medalla: lo que el menú dice de cada uno. */
export function daMedalla(objetivo: Objetivo | null | undefined, mode: GameMode): boolean {
  return mode === MODO_QUE_CUENTA && cuentaParaMedalla(objetivo, mode)
}

/** Lo que el menú dice de un modo: si cuenta para medalla o no. */
export function fraseDeLaMedalla(objetivo: Objetivo | null | undefined, mode: GameMode) {
  return daMedalla(objetivo, mode) ? ('Counts for a medal' as const) : ('Does not count for a medal' as const)
}

/** Lo que el cartel necesita saber de lo que se está jugando. */
export interface LoQueSeJuega {
  /** Lo que pasó el salón, si lo pasó. */
  objetivo?: Objetivo | null
  gameMode: GameMode
  gameState: 'menu' | 'countdown' | 'playing' | 'finished'
  /** La ronda del reto por la que se va (1 fuera de él). */
  round: number
  /** Los goles de toda la partida, de los dos: con alguno ya se está jugando. */
  goles: number
  points: number
  /** Goles seguidos sin encajar. */
  streak: number
  /** El récord del modo guardado aquí al empezar; cero si no hay. */
  record: number
}

/**
 * La partida que se le cuenta al cartel, o `null` si no hay nada que colgar.
 *
 * La que cuenta es el reto —o el modo que diga el salón—: durante la primera cuenta atrás, la
 * misión y los listones; después, el listón que falta y lo que queda; al acabar, lo que faltó. En
 * cualquier otro modo, dentro del salón el cartel dice bajito que no cuenta para medalla; con el
 * juego abierto suelto no hay medalla de la que hablar y no se cuelga. En el menú, nunca.
 */
export function partidaDelCartel(juego: LoQueSeJuega, t: Traducir): Partida | null {
  const { gameMode, gameState } = juego
  if (gameState === 'menu') return null
  const objetivo = juego.objetivo ?? null
  const mision = t(MISION_DEL_RETO)
  if (!daMedalla(objetivo, gameMode)) {
    if (objetivo == null) return null
    return { objetivo, fase: 'jugando', puntos: 0, mision, cuenta: false, modo: t(GAME_MODE_LABELS[gameMode]) }
  }
  const sinEmpezar = gameState === 'countdown' && juego.round === 1 && juego.goles === 0
  return {
    objetivo,
    fase: gameState === 'finished' ? 'final' : sinEmpezar ? 'antes' : 'jugando',
    puntos: juego.points,
    mision,
    queda: loQueQueda(juego.round, juego.streak, t),
    record: juego.record > 0 ? juego.record : null,
  }
}

/**
 * Lo que el marcador del fondo calla porque ya lo dice el cartel que tiene encima.
 *
 * Con el objetivo de frente, repetir los puntos debajo era obligar a elegir dónde mirar; y la
 * ronda va escrita en el cartel mientras se juega. Al acabar el cartel dice lo que faltó, así que
 * la ronda vuelve al marcador: es en la que se quedó el reto.
 */
export function loQueCallaElMarcador(partida: Partida | null): { puntos: boolean; ronda: boolean } {
  const cuenta = partida != null && partida.cuenta !== false
  return { puntos: cuenta, ronda: cuenta && partida.fase !== 'final' }
}

/** Cómo se llama el sonido de cada listón cruzado (`audioEngine.ts`; en Godot, su efecto renderizado). */
export const SONIDO_DEL_LISTON = { bronce: 'medal-bronze', plata: 'medal-silver', oro: 'medal-gold' } as const

/**
 * Lo que se siente en la mano del mazo al cruzar un listón: algo lejano ha llegado, más fuerte
 * cuanto mejor es la medalla. Sale detrás del pulso del gol que lo cruzó, que si no lo cortaría.
 * A CALIBRAR CON EL VISOR.
 */
export function pulsosDelListon(medalla: Medalla, mano: Mano | null): Pulso[] {
  if (mano == null) return []
  return pulsosDe({ tipo: 'llegada', mano, fuerza: 0.5 + 0.25 * MEDALLAS.indexOf(medalla) }).map((pulso) => ({
    ...pulso,
    retardo: pulso.retardo + RECETAS.llegada.ms,
  }))
}
