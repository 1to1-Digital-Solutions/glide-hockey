'use client'

import { SIN_HITOS, apuntarHito, type TutorialHitos, type TutorialStepKey } from './tutorial'
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
import { setScenery as setArcadeScenery, useScenery, useVolumes } from './ajustesCliente'
import { challengeRound } from './challenge'
import {
  COUNTDOWN_SECONDS,
  DEFAULT_GOALS,
  MAX_GOALS,
  MIN_GOALS,
  type Difficulty,
} from './gameConfig'
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
import { forgetOwnScenery } from './scenery'
import { gameStorage } from './storage'
import { type Scorer } from './puckPhysics'
import { scoreConceded, scoreGoal } from './scoring'

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

export interface GameStore {
  /** Goles a los que se juega una partida de prueba (3–15). */
  goalTarget: number
  /** Nivel elegido. En reto lo manda la ronda y esto no se toca. */
  difficulty: Difficulty
  /** Prueba, niveles o reto (ver `gameMode.ts`). */
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
  /** Gol del jugador: suma puntos y alarga la racha. */
  scorePlayer: () => void
  /** Gol de la máquina: descuenta puntos y corta la racha. */
  scoreOpponent: () => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Restringe los goles de una partida al rango permitido. */
export function clampGoalTarget(goals: number): number {
  if (Number.isNaN(goals)) return DEFAULT_GOALS
  return Math.min(MAX_GOALS, Math.max(MIN_GOALS, Math.round(goals)))
}

export function useGameStoreValue(): GameStore {
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
  // Se entra en prueba: quien acaba de llegar no tiene por qué estrenarse en un
  // reto que se acaba a la primera derrota. El reto está a un toque, al lado.
  const [gameMode, setGameModeState] = useState<GameMode>('practice')
  const [endless, setEndless] = useState(false)
  // `null` es «el más alto desbloqueado»: así el menú enseña el nivel que toca
  // sin leer el almacenamiento en el primer render, que no está en el servidor.
  const [level, setLevelState] = useState<number | null>(null)
  // La partida sin fin la termina el jugador: es lo único que la cierra.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [prompt, setPrompt] = useState<'quit' | null>(null)
  const [tutorialRunning, setTutorialRunning] = useState(false)
  const [malletHeld, setMalletHeld] = useState(false)
  const [runId, setRunId] = useState(0)
  // Ronda del reto. Vive aquí y no se deriva porque es lo único que sobrevive
  // de una partida a la siguiente dentro del mismo reto.
  const [challengeRoundNumber, setChallengeRoundNumber] = useState(1)

  const [playerGoals, setPlayerGoals] = useState(0)
  const [opponentGoals, setOpponentGoals] = useState(0)
  const [previousPlayerGoals, setPreviousPlayerGoals] = useState(0)
  const [previousOpponentGoals, setPreviousOpponentGoals] = useState(0)
  const [lastScorer, setLastScorer] = useState<Scorer | null>(null)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [immersive, setImmersive] = useState(false)

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
  const [recordToBeat, setRecordToBeat] = useState(0)

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
      : difficulty
  const activeGoalTarget = challenge
    ? currentRound.goalTarget
    : levels
      ? currentLevel.goalTarget
      : endless
        ? ENDLESS
        : goalTarget
  const endlessRun = isEndless(activeGoalTarget)
  const totalPlayerGoals = previousPlayerGoals + playerGoals
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

  // Cada modo guarda lo suyo al terminar: puntos, racha o estrellas. Guardar
  // solo hace algo si mejora lo que había, así que repetirlo no cambia nada. Se
  // guarda al final y no gol a gol para que durante la partida el récord siga
  // siendo la marca a batir.
  useEffect(() => {
    if (gameState !== 'finished') return
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
  }, [gameState, gameMode, points, bestStreak, endlessRun, levelResult, activeLevel])

  // La marca de este modo: puntos, o la racha en la partida sin fin. En Niveles
  // no hay marca que batir: hay estrellas.
  const bestForMode = endlessRun ? bestEndlessStreak : levels ? 0 : bestPoints
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
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  const setGoalTarget = useCallback((goals: number) => {
    setGoalTargetState(clampGoalTarget(goals))
  }, [])

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
  }, [])

  const startGame = useCallback(() => {
    setPrompt(null)
    clearRun()
    advancedRound.current = 0
    setEndedByPlayer(false)
    setRecordToBeat(
      gameMode === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(gameMode),
    )
    setUnlockedAtStart(getUnlockedLevel())
    setLevelAtStart(selectedLevel)
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setRunning(true)
  }, [clearRun, gameMode, endless, selectedLevel])
  const scorePlayer = useCallback(() => {
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
  }, [activeDifficulty, lapFactor, anotarHito])

  const scoreOpponent = useCallback(() => {
    setOpponentGoals((value) => value + 1)
    setLastScorer('opponent')
    setStreak(0)
    setPoints((total) => scoreConceded(total))
  }, [])

  // Escribe la clave del arcade, no una del juego: el botón y el panel del salón son el mismo ajuste.
  const setScenery = useCallback((value: Scenery) => setArcadeScenery(value), [])

  const askToQuit = useCallback(() => setPrompt('quit'), [])
  const keepPlaying = useCallback(() => setPrompt(null), [])

  const resetGame = useCallback(() => {
    setPrompt(null)
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
      gameState,
      hitos,
      apuntarHito: anotarHito,
      countdown,
      malletHeld,
      setMalletHeld,
      esperandoElMazo,
      runId,
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
      resetGame,
    }),
    [
      prompt,
      tutorialRunning,
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
      gameState,
      countdown,
      runId,
      immersive,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      scenery,
      setGoalTarget,
      setGameMode,
      setLevel,
      endRun,
      setScenery,
      startGame,
      scorePlayer,
      scoreOpponent,
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
