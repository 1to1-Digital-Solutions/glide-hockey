'use client'

import { SIN_HITOS, TUTORIAL_STEPS, apuntarHito, type TutorialHitos, type TutorialStepKey } from './tutorial'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { volumeFactor, type Scenery } from './ajustes'
import { setScenery as setArcadeScenery, useLang, useScenery, useVolumes } from './ajustesCliente'
import { AVISO_DE_QUE_CUENTA_MS, conElAvisoDeQueCuenta, loQueCallaElMarcador, partidaDelCartel } from './cartelDelMarcador'
import { challengeRound } from './challenge'
import {
  COUNTDOWN_SECONDS,
  DEFAULT_GOALS,
  MAX_GOALS,
  MIN_GOALS,
  type Difficulty,
} from './gameConfig'
import {
  DUEL_SETUP,
  controllerHolder,
  duelOver,
  duelTurn,
  duelWinner,
  newDuel,
  recordMatch,
  type Duel,
  type Player,
} from './duel'
import { saveDuelResult } from './duelTally'
import { ENDLESS, type GameMode, type RunOutcome, isEndless, runOutcome } from './gameMode'
import {
  getBestEndlessStreak,
  getBestPoints,
  getServerBestEndlessStreak,
  getServerBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
  subscribeBestEndlessStreak,
  subscribeBestPoints,
} from './highScore'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from './levels'
import {
  getServerStarsList,
  getServerUnlockedLevel,
  getStarsList,
  getUnlockedLevel,
  saveLevelResult,
  subscribeStarsList,
  subscribeUnlockedLevel,
} from './progress'
import { migrateLegacyKeysOnce } from './legacyKeys'
import { conHazanas, estrenarHazanas, hazanasDelPartido, type Hazana } from './hazanas'
import { cartelDeObjetivo, medallaQueCelebra, type Medalla, type Objetivo, type VistaDelCartel } from './objetivo'
import { semillaDeLaMesa } from './opponent'
import { exponerPartida } from './partidaDePrueba'
import type { Resultado, Reto } from './semilla'
import { forgetOwnScenery } from './scenery'
import { gameStorage } from './storage'
import { type Scorer } from './puckPhysics'
import { concededPenalty, scoreConceded, scoreGoal } from './scoring'
import { traductorSuave } from './textos'

/**
 * El estado de una partida de air hockey y las tres cosas que se eligen antes
 * de empezar: el modo, el nivel de la máquina y a cuántos goles se juega.
 *
 * Casi todo se **deriva** en vez de guardarse. Las fases de la partida salen de
 * la cuenta atrás y del marcador, y el final del marcador y del modo: así no
 * hay contadores paralelos que mantener a la par ni efectos que cambien de fase
 * provocando renders en cascada. Lo único que se guarda de verdad es si hay
 * partida en marcha, el marcador y por qué ronda va el reto.
 *
 * La puntuación y la escalera del reto viven en sus módulos (`scoring.ts`,
 * `challenge.ts`), que son funciones puras: aquí solo se llaman.
 */

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

/** Cómo va el duelo, visto desde la pantalla. */
export interface DuelView {
  /** De quién es la partida que está en pantalla, o la que va a empezar. */
  player: Player
  /** Las dos partidas, contando la que acaba de terminar. */
  matches: Duel['matches']
  /** A quién le toca después, o `null` si ya han jugado los dos. */
  next: Player | null
  over: boolean
  /** Quién ha ganado, o `null` si no ha acabado o es empate. */
  winner: Player | null
}

/**
 * El modo que se juega con el `reto` del salón: el del récord de la cabina
 * (`glide-hockey:best-points:challenge`).
 *
 * El reto no tiene ajustes que cambien la puntuación: el nivel de la máquina y
 * los goles de cada ronda los pone la escalera (`challenge.ts`), así que no hay
 * dificultad ni goles que fijar.
 */
const MODO_DEL_RETO: GameMode = 'challenge'

/** Todos los pasos del tutorial, hechos: con ellos no queda nada que enseñar (`tutorialStep`). */
const TODOS_LOS_HITOS = Object.fromEntries(TUTORIAL_STEPS.map((paso) => [paso, true])) as TutorialHitos

/**
 * Lo que el salón le pasa al store a través de la escena (ver `GlideHockeyScene`).
 *
 * Todo opcional: sin nada, el juego arranca en el menú y juega como en su propia web.
 */
export interface OpcionesDelSalon {
  /**
   * Jugar este reto: se entra **directamente** en una partida del reto, con los
   * tiros de la máquina sacados de la semilla. Se lee al montar; otro reto es
   * otro montaje.
   */
  reto?: Reto
  /**
   * Se llama una vez al acabar cada partida con puntuación (no al dejarla a medias), con las
   * hazañas que se estrenan en ella (`hazanas.ts`).
   */
  onTerminar?: (resultado: Resultado) => void
  /**
   * Los listones de medalla del juego y la marca de quien juega, para el cartel de encima del
   * marcador (`objetivo.ts`). Sin él —el juego abierto suelto— el cartel dice la misión y el
   * récord local.
   */
  objetivo?: Objetivo
}

export interface GameStore {
  /** Goles a los que se juega una partida de prueba (3–15). */
  goalTarget: number
  /** Nivel elegido. En reto lo manda la ronda y esto no se toca. */
  difficulty: Difficulty
  /** Prueba, niveles, reto o duelo (ver `gameMode.ts`). */
  gameMode: GameMode
  /** Prueba sin fin: la partida no se acaba por goles, la termina el jugador. */
  endless: boolean
  /** Nivel elegido en Niveles, o `null` = el más alto desbloqueado. */
  level: number | null
  /** El nivel que se juega: el elegido, o el más alto desbloqueado. */
  activeLevel: number
  /** Hasta qué nivel se puede jugar, recordado entre visitas. */
  unlockedLevel: number
  /** Estrellas de cada nivel, del primero al último. */
  levelStars: readonly Stars[]
  /** Cómo acabó el nivel jugado, solo con la partida terminada en Niveles. */
  levelResult: { stars: Stars; passed: boolean; unlocked: number | null } | null

  /** El duelo por turnos, o `null` fuera de ese modo (ver `duel.ts`). */
  duel: DuelView | null

  /** Ronda del reto, o `null` en un modo que no las tiene. */
  round: number | null
  /**
   * Por qué vuelta a la escalera del reto va, o `null` fuera del reto.
   *
   * Solo es distinto de 1 pasada la ronda quince, y entonces es lo que hay que
   * enseñar: es la única forma de que se vea que lo que se está jugando vale más
   * que la vuelta anterior (ver `challenge.ts`).
   */
  lap: number | null
  /** Lo que multiplican los goles por la vuelta en la que caen. */
  lapMultiplier: number
  /** Nivel al que se está jugando: el elegido en prueba, el de la ronda en reto. */
  activeDifficulty: Difficulty
  /** Goles que deciden la partida en curso. */
  activeGoalTarget: number

  /** Marcador de la partida en curso. */
  playerGoals: number
  opponentGoals: number
  /** Goles de toda la sesión. En reto, sumando rondas. */
  totalPlayerGoals: number
  totalOpponentGoals: number
  /** Quién metió el último gol, que es quien decide hacia dónde se saca. */
  lastScorer: Scorer | null

  /** Puntos acumulados (ver `scoring.ts`). */
  points: number
  /** Goles seguidos sin encajar. */
  streak: number
  /** La mejor racha de la sesión, para el resumen final. */
  bestStreak: number
  /** Mejor puntuación del modo elegido, guardada entre visitas. */
  bestPoints: number
  /** La partida recién terminada ha superado el récord anterior. */
  isRecord: boolean
  /** Cómo acabó, o `null` mientras sigue viva. */
  outcome: RunOutcome | null

  /** Lo que pasó el salón, o `null` con el juego abierto suelto: los menús dicen qué modo da medalla. */
  objetivo: Objetivo | null
  /**
   * Lo que dice el cartel de encima del marcador (`objetivo.ts`), o `null` si no hay nada que
   * colgar: en el menú, y fuera del reto con el juego abierto suelto.
   */
  cartel: VistaDelCartel | null
  /** La medalla que ya es de quien juega en esta partida: cuando sube, se celebra el listón. */
  medalla: Medalla | null
  /** Lo que el marcador del fondo calla porque ya lo dice el cartel (`loQueCallaElMarcador`). */
  callado: { puntos: boolean; ronda: boolean }

  gameState: GameState

  /**
   * Lo que quien juega ya ha hecho.
   *
   * Lo escriben los mismos sitios que ya apuntan lo que pasa, y lo lee el tutorial: cada paso
   * suyo se supera **haciéndolo de verdad**, así que no necesita ni pararle el juego a nadie
   * ni escuchar nada aparte. Se acumula: hacer algo no se deshace.
   */
  hitos: TutorialHitos
  apuntarHito: (hito: TutorialStepKey) => void
  /** Segundos para el saque. Solo tiene sentido en `countdown`. */
  countdown: number
  /**
   * Si el mazo va en la mano ahora mismo. Lo dice la mesa, fotograma a fotograma.
   *
   * **La cuenta atrás lo espera.** Con el visor puesto, el saque llegaba con el mazo aún en
   * la mesa: el disco salía y no había con qué pararlo. Se para en el último segundo hasta
   * que se coge, que es lo que el tutorial está enseñando justo entonces.
   */
  malletHeld: boolean
  setMalletHeld: (held: boolean) => void
  /**
   * La cuenta atrás está parada esperando a que se coja el mazo.
   *
   * **Se para y hay que decirlo.** Sin esto, el 1 se quedaba clavado sin explicación y desde
   * dentro parece que el juego se ha colgado: «si no se coge el objeto para empujar el disco,
   * el countdown se queda parado en el 1 sin ninguna explicación». Lo leen la cuenta atrás
   * —que escribe qué falta— y el mazo, que se enciende para que se vea cuál es.
   */
  esperandoElMazo: boolean
  /**
   * Identificador de partida. Sube al empezar una nueva, y en reto también al
   * pasar de ronda: es lo que remonta la mesa y devuelve el disco al centro.
   */
  runId: number
  /**
   * Con qué semilla elige sus tiros la máquina en la mesa que se está jugando (`AimSeed.match`):
   * el número de partida, o en el reto la de su semilla y su ronda (`semillaDeLaMesa`). En el
   * duelo, la del duelo: la misma para los dos (`Duel.seed`).
   */
  seed: number
  /**
   * Lo que se juega ahora es el `reto` que pasó el salón. Deja de serlo en cuanto se empieza
   * otra partida o se vuelve al menú.
   */
  enReto: boolean
  /** Si hay una sesión inmersiva abierta, es decir, si se juega con gafas. */
  immersive: boolean
  /** Si el juego está callado. Es de quien juega y se recuerda entre visitas. */
  /**
   * Juego en silencio, porque los efectos están a cero en los ajustes del
   * arcade. Ya no es una preferencia de este juego: se elige una vez en xrcade
   * y vale para los doce (ver `ajustes.ts`). Se deja derivado porque media
   * escena pregunta «¿estoy mudo?» y no «¿a cuánto están los efectos?».
   */
  muted: boolean
  /** Volumen de los efectos, de 0 a 1, tal y como lo quiere la Web Audio API. */
  sfxVolume: number
  /** Música de fondo encendida: el ambiente de los ajustes, por encima de cero. */
  /** Volumen del ambiente, de 0 a 1. */
  ambienceVolume: number
  /** Qué se pinta alrededor: la sala del juego o tu habitación. */
  scenery: Scenery

  setGoalTarget: (goals: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /** Elige modo. **Solo desde el menú** (ver el porqué en la implementación). */
  setGameMode: (mode: GameMode) => void
  setEndless: (endless: boolean) => void
  /** Elige nivel entre los desbloqueados; lo que no lo está se recorta. */
  setLevel: (level: number) => void
  /** Termina la partida sin fin a voluntad: es su única salida con resumen. */
  endRun: () => void
  setImmersive: (immersive: boolean) => void
  /** Si suena la música de fondo. El silencio manda sobre ella. */
  music: boolean
  /**
   * Cambia lo que se pinta alrededor. Se puede a media partida y con el visor
   * puesto: es lo que hace que se pueda mirar la habitación sin salir de la
   * sesión, que es de lo que va este ajuste.
   */
  setScenery: (scenery: Scenery) => void

  /**
   * Si la demostración del gesto está corriendo ahora mismo. Lo dice `XRTutorial`.
   *
   * **La cuenta atrás la espera.** Empezar mientras la demostración explica el gesto es empezar sin
   * él: el saque llegaba con la explicación a medias. Fuera del visor no hay demostración y esto se queda en `false`.
   */
  tutorialRunning: boolean
  setTutorialRunning: (running: boolean) => void
  /**
   * Si el tutorial se está enseñando ahora mismo. Lo dice `XRTutorial`.
   *
   * **En el reto, aprendiendo no se pierde nada**: los goles de la máquina no cuentan —ni en el
   * marcador ni en los puntos—, aunque se oyen y se sienten igual. Al cerrarse el tutorial el reto
   * empieza desde cero (`acabarLaLeccion`).
   */
  aprendiendo: boolean
  setAprendiendo: (aprendiendo: boolean) => void
  /**
   * El tutorial se ha cerrado —por sus pasos, por «Siguiente» o por «Saltar»— con la partida en
   * marcha. En el reto, la partida vuelve a empezar desde cero, con su cuenta atrás, y el cartel
   * avisa un momento de que ahora cuenta para medalla. Fuera del reto no hace nada.
   */
  acabarLaLeccion: () => void
  /**
   * Lo que se está preguntando ahora mismo, o `null` si no se pregunta nada.
   *
   * Dejar la partida a medias **pierde lo que se lleva**, y el botón se pulsa sin querer:
   * con el visor puesto no se ve lo que hay a los lados y el brazo pasa por donde pasa. Así
   * que no se sale de golpe: se para la mesa y se pregunta. Mientras se pregunta el disco no
   * corre, porque si no, decidir costaría goles.
   */
  prompt: 'quit' | null
  /** Para la partida y pregunta si de verdad se quiere dejar. */
  askToQuit: () => void
  /** No: se sigue jugando desde donde estaba. */
  keepPlaying: () => void

  startGame: () => void
  /** Gol del jugador: suma puntos y alarga la racha. Con la partida decidida no cuenta. */
  scorePlayer: () => void
  /** Gol de la máquina: descuenta puntos y corta la racha. Con la partida decidida no cuenta. */
  scoreOpponent: () => void
  /**
   * Apunta una hazaña de la mesa (un gol de un toque desde el fondo, uno en propia puerta) a la
   * partida en curso: se guarda y se cuenta al salón al acabarla. Con la partida decidida no cuenta.
   */
  apuntarHazana: (hazana: Hazana) => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Restringe los goles de una partida al rango permitido. */
export function clampGoalTarget(goals: number): number {
  if (Number.isNaN(goals)) return DEFAULT_GOALS
  return Math.min(MAX_GOALS, Math.max(MIN_GOALS, Math.round(goals)))
}

export function useGameStoreValue({ reto, onTerminar, objetivo }: OpcionesDelSalon = {}): GameStore {
  // Lo guardado cuando el juego se llamaba `air-hockey`, traído a las claves de ahora.
  // Durante el render y no en un efecto: el récord y los niveles se leen más abajo con
  // `useSyncExternalStore`, que lee ya en esta misma pasada (ver `lib/legacyKeys.ts`).
  migrateLegacyKeysOnce()

  const [goalTarget, setGoalTargetState] = useState(DEFAULT_GOALS)
  const [hitos, setHitos] = useState<TutorialHitos>(SIN_HITOS)
  const anotarHito = useCallback((hito: TutorialStepKey) => {
    setHitos((actuales) => apuntarHito(actuales, hito))
  }, [])
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // El menú abre **siempre** en el reto, con salón o sin él, y no recuerda el último modo: es el
  // del récord y el de las medallas, así que quien entra y pulsa Jugar sin tocar nada tiene que
  // estar jugando a lo que cuenta, con su objetivo delante. La práctica queda a un toque, al lado.
  const [gameMode, setGameModeState] = useState<GameMode>(MODO_DEL_RETO)
  const [endless, setEndlessState] = useState(false)
  // `null` es «el más alto desbloqueado»: así el menú enseña el nivel que toca
  // sin leer el almacenamiento en el primer render, que no está en el servidor.
  const [level, setLevelState] = useState<number | null>(null)
  // La partida sin fin la termina el jugador: es lo único que la cierra.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  // Con reto se entra jugando: el salón ya ha elegido juego y modo por quien juega.
  const [running, setRunning] = useState(reto != null)
  const [countdown, setCountdown] = useState(reto != null ? COUNTDOWN_SECONDS : 0)
  const [prompt, setPrompt] = useState<'quit' | null>(null)
  const [tutorialRunning, setTutorialRunning] = useState(false)
  const [aprendiendo, setAprendiendo] = useState(false)
  /** Si el cartel está avisando de que ya cuenta (`conElAvisoDeQueCuenta`). */
  const [avisoQueCuenta, setAvisoQueCuenta] = useState(false)
  const [malletHeld, setMalletHeld] = useState(false)
  const [runId, setRunId] = useState(reto != null ? 1 : 0)
  // El reto se mira una sola vez, al montar: es lo que decide con qué se arranca.
  const [enReto, setEnReto] = useState(reto != null)
  const [semillaDelReto] = useState(() => reto?.semilla ?? null)
  // Ronda del reto. Vive aquí y no se deriva porque es lo único que sobrevive
  // de una partida a la siguiente dentro del mismo reto.
  const [challengeRoundNumber, setChallengeRoundNumber] = useState(1)
  // Las partidas del duelo ya cerradas y su semilla. La que acaba de terminar no se apunta aquí
  // hasta que empieza la siguiente: mientras se ve el resumen se deduce del marcador (`duelNow`).
  const [duel, setDuel] = useState<Duel>(() => newDuel(0))

  const [playerGoals, setPlayerGoals] = useState(0)
  const [opponentGoals, setOpponentGoals] = useState(0)
  const [previousPlayerGoals, setPreviousPlayerGoals] = useState(0)
  const [previousOpponentGoals, setPreviousOpponentGoals] = useState(0)
  const [lastScorer, setLastScorer] = useState<Scorer | null>(null)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [immersive, setImmersive] = useState(false)
  // Las hazañas de esta partida (en el reto, de todas sus rondas): se estrenan y se cuentan al
  // salón al acabar. Un ref y no estado porque no se pintan, y un conjunto porque Strict Mode
  // repite los efectos y la misma hazaña no tiene que contar dos veces.
  const hazanasDeLaPartida = useRef(new Set<Hazana>())

  // El récord no es estado de React: vive en el navegador y el juego se
  // suscribe a él, así que no hay una copia que pueda discrepar de lo guardado.
  // Cada modo tiene el suyo, y por eso la lectura cambia con el modo elegido.
  const readRecord = useCallback(() => getBestPoints(gameMode), [gameMode])
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    readRecord,
    getServerBestPoints,
  )
  // La marca a batir se congela al empezar: en cuanto la partida termina y se
  // guarda, `bestPoints` ya incluye lo recién hecho y no serviría para saber si
  // se ha superado nada.
  const [recordToBeat, setRecordToBeat] = useState(() =>
    reto != null ? getBestPoints(MODO_DEL_RETO) : 0,
  )
  // Y el del salón, por lo mismo: al acabar, el salón sube el suyo (`onTerminar`) y el cartel
  // diría «Has igualado tu récord» de la partida que lo acaba de batir (`objetivo.ts`).
  const recordDelSalon = objetivo?.record ?? null
  const salonVivo = useRef(recordDelSalon)
  useEffect(() => {
    salonVivo.current = recordDelSalon
  }, [recordDelSalon])
  const [salonAlEmpezar, setSalonAlEmpezar] = useState(recordDelSalon)

  // El sonido no es estado de este juego: sale de los ajustes del arcade, que
  // se eligen una vez en xrcade y valen para los doce. Aquí solo se traduce a
  // lo que la escena pregunta: si está mudo y a qué volumen (ver `ajustes.ts`).
  const volumes = useVolumes()
  const muted = volumes.sfx === 0
  const sfxVolume = volumeFactor(volumes.sfx)
  const music = volumes.ambience > 0
  const ambienceVolume = volumeFactor(volumes.ambience)
  // Lo que se pinta alrededor tampoco es estado de React, y además no es del
  // juego: es el escenario del arcade (`xrcade:scenery`). Se cambia desde el panel
  // del salón y desde los dos menús de aquí, y los tres tienen que ver lo mismo.
  const scenery = useScenery()
  // La clave propia del juego se borra al montar el estado de la partida, sin
  // trasladarla: la elección que manda es la del salón (ver `lib/scenery.ts`).
  useEffect(() => {
    forgetOwnScenery(gameStorage())
  }, [])

  // El progreso de Niveles tampoco es estado de React: vive en el navegador y se
  // lee suscrito, como el récord, para que los dos menús lo vean a la vez.
  const unlockedLevel = useSyncExternalStore(
    subscribeUnlockedLevel,
    getUnlockedLevel,
    getServerUnlockedLevel,
  )
  const starsList = useSyncExternalStore(subscribeStarsList, getStarsList, getServerStarsList)
  const levelStarsAll = useMemo(
    () => starsList.split(',').map((s) => Number(s) as Stars),
    [starsList],
  )
  const bestEndlessStreak = useSyncExternalStore(
    subscribeBestEndlessStreak,
    getBestEndlessStreak,
    getServerBestEndlessStreak,
  )
  // Hasta dónde se podía jugar al empezar, y con qué nivel se empezó. El nivel
  // se congela al empezar: al ganarlo se desbloquea el siguiente en el acto, y
  // si el activo siguiera al desbloqueado la partida ganada se convertiría en
  // la siguiente a medias, con más goles que meter y el resumen esfumado.
  const [unlockedAtStart, setUnlockedAtStart] = useState(1)
  const [levelAtStart, setLevelAtStart] = useState(1)

  const challenge = gameMode === 'challenge'
  const levels = gameMode === 'levels'
  const duelMode = gameMode === 'duel'
  const round = challenge ? challengeRoundNumber : null
  const currentRound = challengeRound(challengeRoundNumber)
  const lap = challenge ? currentRound.lap : null
  // Fuera del reto no hay vuelta que multiplicar: uno, que es no multiplicar.
  const lapFactor = challenge ? currentRound.multiplier : 1
  const selectedLevel = clampLevel(Math.min(level ?? unlockedLevel, unlockedLevel))
  const activeLevel = running ? levelAtStart : selectedLevel
  const currentLevel = levelSpec(activeLevel)
  const activeDifficulty = challenge
    ? currentRound.difficulty
    : levels
      ? currentLevel.difficulty
      : duelMode
        ? DUEL_SETUP.difficulty
        : difficulty
  const activeGoalTarget = challenge
    ? currentRound.goalTarget
    : levels
      ? currentLevel.goalTarget
      : duelMode
        ? DUEL_SETUP.goalTarget
        : endless
          ? ENDLESS
          : goalTarget
  const endlessRun = isEndless(activeGoalTarget)
  const totalPlayerGoals = previousPlayerGoals + playerGoals
  // La ronda y no el `runId`: dentro del reto, la mesa de cada ronda es la misma
  // para todos, pase lo que pase en las anteriores.
  const seed = duelMode ? duel.seed : semillaDeLaMesa(enReto ? semillaDelReto : null, runId, challengeRoundNumber)
  const totalOpponentGoals = previousOpponentGoals + opponentGoals

  // Cuándo se acaba una partida lo decide el marcador (ver `gameMode.ts`).
  const matchOutcome = running
    ? runOutcome({ playerGoals, opponentGoals, goalTarget: activeGoalTarget })
    : null
  // En reto, ganar no acaba nada: encadena la ronda siguiente. Solo perder
  // cierra un reto, y de ahí que no tenga final. La partida sin fin no se cierra
  // por goles: la cierra el jugador, y se cuenta como ganada si va por delante.
  const outcome =
    matchOutcome === 'won' && challenge
      ? null
      : running && endedByPlayer && endlessRun
        ? playerGoals >= opponentGoals
          ? 'won'
          : 'lost'
        : matchOutcome
  const gameState: GameState = !running
    ? 'menu'
    : countdown > 0
      ? 'countdown'
      : outcome
        ? 'finished'
        : 'playing'

  // Un tic por segundo hasta el saque. La cuenta atrás da tiempo a colocar el
  // mazo —en el visor uno acaba de pulsar un botón y tiene la mano donde no
  // toca— y avisa de que la partida va a empezar de verdad.
  // Y en el visor no pasa del último segundo hasta tener el mazo en la mano: sacar con el
  // mazo en la mesa es empezar a perder.
  const esperandoElMazo = immersive && !malletHeld && countdown <= 1
  useEffect(() => {
    if (!running || countdown <= 0 || esperandoElMazo || prompt !== null || tutorialRunning) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown, esperandoElMazo, prompt, tutorialRunning])

  // De qué ronda se subió ya el escalón. Sin esta marca, dos ejecuciones del
  // efecto por la misma ronda —Strict Mode las provoca en desarrollo— sumarían
  // dos veces lo hecho y saltarían una ronda entera. Es un ref y no estado
  // porque no se pinta: solo evita repetir un traspaso que ya se hizo.
  const advancedRound = useRef(0)

  // Ronda ganada: se guarda el marcador, se sube el escalón y empieza la
  // partida siguiente. El `runId` cambia para que la mesa se remonte con el
  // disco en el centro.
  useEffect(() => {
    if (!running || !challenge || matchOutcome !== 'won') return
    // Dos ejecuciones del efecto por la misma ronda —Strict Mode las provoca en
    // desarrollo— sumarían dos veces lo hecho y saltarían una ronda entera.
    /* v8 ignore next */
    if (advancedRound.current === challengeRoundNumber) return
    advancedRound.current = challengeRoundNumber
    // Cada ronda del reto es un partido: ganarla sin encajar ya es la hazaña.
    for (const hazana of hazanasDelPartido({ ganado: true, encajados: opponentGoals, sinFin: false })) {
      hazanasDeLaPartida.current.add(hazana)
    }

    setPreviousPlayerGoals((value) => value + playerGoals)
    setPreviousOpponentGoals((value) => value + opponentGoals)
    setPlayerGoals(0)
    setOpponentGoals(0)
    setLastScorer(null)
    setChallengeRoundNumber((value) => value + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setRunId((id) => id + 1)
  }, [
    running,
    challenge,
    matchOutcome,
    challengeRoundNumber,
    playerGoals,
    opponentGoals,
  ])

  // Cómo acabó el nivel, solo con la partida terminada en Niveles.
  const levelResult = useMemo(() => {
    if (!levels || gameState !== 'finished') return null
    const stars = levelStars(outcome === 'won', playerGoals, opponentGoals)
    const passed = levelPassed(stars)
    const abre = passed && activeLevel + 1 > unlockedAtStart && activeLevel < LEVEL_COUNT
    return { stars, passed, unlocked: abre ? activeLevel + 1 : null }
  }, [levels, gameState, outcome, playerGoals, opponentGoals, activeLevel, unlockedAtStart])

  // El duelo con la partida recién terminada ya contada. Se deduce en vez de apuntarla al acabar
  // para no escribir estado desde un efecto: se apunta de verdad al empezar el turno siguiente
  // (`startGame`).
  const duelNow = useMemo(
    () =>
      duelMode && gameState === 'finished'
        ? recordMatch(duel, { scored: playerGoals, conceded: opponentGoals })
        : duel,
    [duelMode, gameState, duel, playerGoals, opponentGoals],
  )
  const duelView = useMemo<DuelView | null>(
    () =>
      duelMode
        ? {
            player: controllerHolder(duel),
            matches: duelNow.matches,
            next: duelTurn(duelNow),
            over: duelOver(duelNow),
            winner: duelWinner(duelNow),
          }
        : null,
    [duelMode, duel, duelNow],
  )

  // Qué duelo se apuntó ya en el marcador de la pareja. Es un ref y no estado porque no se pinta:
  // solo evita sumar dos veces el mismo duelo si el efecto se repite.
  const savedDuelRun = useRef(0)
  useEffect(() => {
    if (!duelMode || gameState !== 'finished' || !duelOver(duelNow)) return
    // Strict Mode repite los efectos en desarrollo: sin esta marca, un duelo contaría doble.
    /* v8 ignore next */
    if (savedDuelRun.current === runId) return
    savedDuelRun.current = runId
    saveDuelResult(duelWinner(duelNow))
  }, [duelMode, gameState, duelNow, runId])

  /**
   * La partida (su `runId`) de la que ya se avisó al salón. El aviso cuelga del
   * mismo efecto que guarda el récord, que se rehace con cada render que cambie
   * sus dependencias (y dos veces en desarrollo): sin esto, contaría dos veces
   * una partida que acabó una.
   */
  const avisada = useRef(0)
  // El aviso se lee del último render y no entra en las dependencias: un
  // anfitrión que pasa una función nueva en cada render no tiene por qué rehacer
  // nada.
  const avisar = useRef(onTerminar)
  useEffect(() => {
    avisar.current = onTerminar
  }, [onTerminar])

  // Cada modo guarda lo suyo al terminar: puntos, racha o estrellas. Guardar
  // solo hace algo si mejora lo que había, así que repetirlo no cambia nada. Se
  // guarda al final y no gol a gol para que durante la partida el récord siga
  // siendo la marca a batir.
  useEffect(() => {
    if (gameState !== 'finished') return
    // En el duelo no hay récord: los goles son de dos personas (ver `highScore.ts`). Por lo mismo
    // tampoco se avisa al salón: no son de quien lleva el visor.
    if (duelMode) return
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
    // Aquí mismo se le cuenta al salón, una vez por partida y aunque no sea
    // récord: los puntos de la partida, que en el reto son los del récord.
    // Con los goles de después del final descartados (`enJuego`), nada de lo que se juega
    // rehace este efecto con la partida acabada: la guarda queda para Strict Mode y para
    // cualquier dependencia que cambie con el resumen en pantalla, y ningún test llega a ella.
    /* v8 ignore next */
    if (avisada.current === runId) return
    avisada.current = runId
    for (const hazana of hazanasDelPartido({ ganado: outcome === 'won', encajados: opponentGoals, sinFin: endlessRun })) {
      hazanasDeLaPartida.current.add(hazana)
    }
    const nuevas = estrenarHazanas(hazanasDeLaPartida.current)
    avisar.current?.(conHazanas({ modo: gameMode, puntos: points, reto: enReto }, nuevas))
  }, [gameState, gameMode, duelMode, points, bestStreak, endlessRun, levelResult, activeLevel, runId, enReto, outcome, opponentGoals])

  // El cartel de encima del marcador: qué hay que superar y cuánto falta. Se arma ya traducido,
  // como lo pinta: sus frases son plantillas, y componerlas fuera obligaría a partirlas.
  const lang = useLang()
  const t = useMemo(() => traductorSuave(lang), [lang])
  const goles = totalPlayerGoals + totalOpponentGoals
  const partida = useMemo(
    () =>
      partidaDelCartel(
        {
          objetivo: objetivo == null ? objetivo : { ...objetivo, record: salonAlEmpezar },
          gameMode,
          gameState,
          round: challengeRoundNumber,
          goles,
          points,
          streak,
          record: recordToBeat,
        },
        t,
      ),
    [objetivo, salonAlEmpezar, gameMode, gameState, challengeRoundNumber, goles, points, streak, recordToBeat, t],
  )
  const cartel = useMemo(
    () => (partida == null ? null : conElAvisoDeQueCuenta(cartelDeObjetivo(partida, t), gameMode, avisoQueCuenta, t)),
    [partida, t, gameMode, avisoQueCuenta],
  )
  const medalla = partida == null ? null : medallaQueCelebra(partida)
  const callado = useMemo(() => loQueCallaElMarcador(partida), [partida])

  // La marca de este modo: puntos, o la racha en la partida sin fin. En Niveles
  // no hay marca que batir: hay estrellas. En el duelo, tampoco: hay quien gana.
  const bestForMode = endlessRun ? bestEndlessStreak : levels || duelMode ? 0 : bestPoints
  const scoreForRecord = endlessRun ? bestStreak : points

  // La partida ha batido el récord con el que empezó *y* lo guardado es
  // exactamente esta puntuación. Sin esa segunda condición, con el
  // almacenamiento bloqueado la marca a batir se quedaría a cero para siempre y
  // cada partida con puntos se anunciaría como récord. Y se exige la igualdad y
  // no «al menos»: con dos pestañas abiertas, la otra puede haber guardado algo
  // mejor mientras se jugaba.
  const isRecord =
    gameState === 'finished' &&
    !levels &&
    !duelMode &&
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  /**
   * A cuántos goles se juega y si hay final se eligen entre partidas, como el modo y el nivel.
   *
   * El marcador decide el final leyendo el objetivo en cada render (`runOutcome`), así que
   * cambiarlo con la partida en marcha la reescribe: con el resumen de un 5-0 en pantalla, subir
   * el objetivo a 7 —o pasar a sin fin— la devolvía a estar en juego, y ganar dos veces la misma
   * partida volvía a guardar y avisar lo ya contado. Los dos menús solo se pintan fuera de la
   * partida, de modo que el bloqueo no le quita nada a quien juega.
   */
  const setGoalTarget = useCallback(
    (goals: number) => {
      if (running) return
      setGoalTargetState(clampGoalTarget(goals))
    },
    [running],
  )

  const setEndless = useCallback(
    (value: boolean) => {
      if (running) return
      setEndlessState(value)
    },
    [running],
  )

  /**
   * El modo es de la sesión entera, así que solo se cambia entre partidas.
   *
   * No es una precaución teórica: los puntos y el modo en el que se
   * consiguieron son un par, y el récord se guarda leyendo los dos. Con el
   * resumen en pantalla —donde la puntuación sigue viva— cambiar de modo
   * copiaría esa puntuación al récord del otro, que no se ha jugado.
   */
  const setGameMode = useCallback(
    (mode: GameMode) => {
      if (running) return
      setGameModeState(mode)
    },
    [running],
  )

  const setLevel = useCallback(
    (next: number) => {
      if (running) return
      setLevelState(clampLevel(Math.min(next, getUnlockedLevel())))
    },
    [running],
  )

  const endRun = useCallback(() => setEndedByPlayer(true), [])
  const clearRun = useCallback(() => {
    setPlayerGoals(0)
    setOpponentGoals(0)
    setPreviousPlayerGoals(0)
    setPreviousOpponentGoals(0)
    setLastScorer(null)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
    setChallengeRoundNumber(1)
    hazanasDeLaPartida.current = new Set()
    setAvisoQueCuenta(false)
  }, [])

  /** Empieza una partida de ese modo con lo elegido: el botón de jugar, y el gancho de los tests. */
  const arrancar = useCallback(
    (modo: GameMode) => {
      // Lo que viene es otra partida: ya no es el reto del salón, aunque se juegue
      // en el mismo modo.
      setEnReto(false)
      setPrompt(null)
      // En el duelo, empezar tras la partida del primero es el turno del segundo: se apunta la que
      // acaba de terminar y la semilla sigue. Con los dos jugados, o desde el menú, es un duelo
      // nuevo, con la semilla de esta partida: no repite los tiros del duelo anterior.
      if (modo === 'duel') {
        setDuel(gameState === 'finished' && !duelOver(duelNow) ? duelNow : newDuel(runId + 1))
      }
      clearRun()
      advancedRound.current = 0
      setEndedByPlayer(false)
      setRecordToBeat(modo === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(modo))
      setSalonAlEmpezar(salonVivo.current)
      setUnlockedAtStart(getUnlockedLevel())
      setLevelAtStart(selectedLevel)
      setRunId((id) => id + 1)
      setCountdown(COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, endless, selectedLevel, gameState, duelNow, runId],
  )
  const startGame = useCallback(() => arrancar(gameMode), [arrancar, gameMode])

  // El gancho común de los tests de navegador (`partidaDePrueba.ts`): solo si el test lo ha pedido
  // antes de cargar la página. Se rehace con lo que usa, así el test siempre llama a lo de ahora.
  const cartelVivo = useRef(cartel)
  useEffect(() => {
    cartelVivo.current = cartel
  }, [cartel])
  useEffect(() => {
    exponerPartida({
      start: () => {
        // El reto, sin el tutorial delante: sus pasos, dados por hechos.
        setGameModeState(MODO_DEL_RETO)
        setHitos(TODOS_LOS_HITOS)
        arrancar(MODO_DEL_RETO)
      },
      score: (puntos) => {
        setCountdown(0)
        setPoints(puntos)
      },
      // Que la máquina gane la ronda: en el reto, es lo que lo acaba.
      end: () => {
        setCountdown(0)
        setOpponentGoals(activeGoalTarget)
      },
      cartel: () => cartelVivo.current,
    })
  }, [arrancar, activeGoalTarget])

  // Solo cuenta el gol de una partida viva. El disco sigue rodando cuando la partida ya se ha
  // decidido —la mesa se entera un fotograma tarde—, y un gol así cambiaba los puntos después
  // del final y volvía a guardar el récord con ellos. Tampoco cuenta con la ronda del reto ya
  // ganada y aún sin traspasar: sumaría a la siguiente lo que no se jugó en ella.
  const enJuego = gameState === 'playing' && matchOutcome === null
  const scorePlayer = useCallback(() => {
    if (!enJuego) return
    // Y el tercero: marcar.
    anotarHito('goal')
    setPlayerGoals((value) => value + 1)
    setLastScorer('player')
    // La racha se calcula aquí dentro porque los puntos dependen de ella: leer
    // `streak` del render anterior le daría el mismo bonus a dos goles
    // encadenados en el mismo lote de actualizaciones.
    setStreak((previous) => {
      const next = previous + 1
      setBestStreak((best) => Math.max(best, next))
      setPoints((total) =>
        scoreGoal(total, { difficulty: activeDifficulty, streak: next, lap: lapFactor }),
      )
      return next
    })
  }, [enJuego, activeDifficulty, lapFactor, anotarHito])

  // Aprendiendo en el reto, lo que mete la máquina no cuenta (`aprendiendo`).
  const aprendiendoElReto = aprendiendo && challenge
  const scoreOpponent = useCallback(() => {
    if (!enJuego || aprendiendoElReto) return
    setOpponentGoals((value) => value + 1)
    setLastScorer('opponent')
    setStreak(0)
    // En la primera ronda del reto encajar no resta (`concededPenalty`).
    setPoints((total) => scoreConceded(total, concededPenalty(round)))
  }, [enJuego, aprendiendoElReto, round])

  const acabarLaLeccion = useCallback(() => {
    if (!challenge || !running) return
    // El reto, desde cero: lo de antes era aprender. La mesa se estrena (`runId`) con el disco
    // en el centro, y la cuenta atrás vuelve a esperar al mazo en la mano.
    clearRun()
    advancedRound.current = 0
    setEndedByPlayer(false)
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setAvisoQueCuenta(true)
  }, [challenge, running, clearRun])

  // El aviso se quita solo.
  useEffect(() => {
    if (!avisoQueCuenta) return
    const quitar = setTimeout(() => setAvisoQueCuenta(false), AVISO_DE_QUE_CUENTA_MS)
    return () => clearTimeout(quitar)
  }, [avisoQueCuenta])

  const apuntarHazana = useCallback(
    (hazana: Hazana) => {
      if (!enJuego) return
      hazanasDeLaPartida.current.add(hazana)
    },
    [enJuego],
  )

  // Escribe la clave del arcade, no una del juego: el botón y el panel del salón son el mismo ajuste.
  const setScenery = useCallback((value: Scenery) => setArcadeScenery(value), [])

  const askToQuit = useCallback(() => setPrompt('quit'), [])
  const keepPlaying = useCallback(() => setPrompt(null), [])

  const resetGame = useCallback(() => {
    setEnReto(false)
    setPrompt(null)
    // Volver al menú deja el duelo: el turno del otro ya no tiene contra qué compararse.
    setDuel(newDuel(0))
    clearRun()
    setCountdown(0)
    setEndedByPlayer(false)
    setRunning(false)
  }, [clearRun])
  return useMemo(
    () => ({
      prompt,
      tutorialRunning,
      setTutorialRunning,
      aprendiendo,
      setAprendiendo,
      acabarLaLeccion,
      askToQuit,
      keepPlaying,
      goalTarget,
      difficulty,
      gameMode,
      endless,
      level,
      activeLevel,
      unlockedLevel,
      levelStars: levelStarsAll,
      levelResult,
      duel: duelView,
      round,
      lap,
      lapMultiplier: lapFactor,
      activeDifficulty,
      activeGoalTarget,
      playerGoals,
      opponentGoals,
      totalPlayerGoals,
      totalOpponentGoals,
      lastScorer,
      points,
      streak,
      bestStreak,
      bestPoints: bestForMode,
      isRecord,
      outcome,
      objetivo: objetivo ?? null,
      cartel,
      medalla,
      callado,
      gameState,
      hitos,
      apuntarHito: anotarHito,
      countdown,
      malletHeld,
      setMalletHeld,
      esperandoElMazo,
      runId,
      seed,
      enReto,
      immersive,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      scenery,
      setGoalTarget,
      setDifficulty,
      setGameMode,
      setEndless,
      setLevel,
      endRun,
      setImmersive,
      setScenery,
      startGame,
      scorePlayer,
      scoreOpponent,
      apuntarHazana,
      resetGame,
    }),
    [
      prompt,
      tutorialRunning,
      aprendiendo,
      acabarLaLeccion,
      askToQuit,
      keepPlaying,
      malletHeld,
      esperandoElMazo,
      goalTarget,
      difficulty,
      gameMode,
      endless,
      level,
      activeLevel,
      unlockedLevel,
      levelStarsAll,
      levelResult,
      duelView,
      round,
      lap,
      lapFactor,
      activeDifficulty,
      activeGoalTarget,
      playerGoals,
      opponentGoals,
      totalPlayerGoals,
      totalOpponentGoals,
      lastScorer,
      points,
      streak,
      bestStreak,
      bestForMode,
      isRecord,
      outcome,
      objetivo,
      cartel,
      medalla,
      callado,
      gameState,
      countdown,
      runId,
      seed,
      enReto,
      immersive,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      scenery,
      setGoalTarget,
      setEndless,
      setGameMode,
      setLevel,
      endRun,
      setScenery,
      startGame,
      scorePlayer,
      scoreOpponent,
      apuntarHazana,
      resetGame,
      hitos,
      anotarHito,
    ],
  )
}

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) {
    throw new Error('useGame must be used inside a <GameProvider>')
  }
  return store
}
