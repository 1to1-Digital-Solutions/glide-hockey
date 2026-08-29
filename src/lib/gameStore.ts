'use client'

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
import { challengeRound } from './challenge'
import {
  COUNTDOWN_SECONDS,
  DEFAULT_GOALS,
  MAX_GOALS,
  MIN_GOALS,
  type Difficulty,
} from './gameConfig'
import { type GameMode, type RunOutcome, runOutcome } from './gameMode'
import {
  getBestPoints,
  getServerBestPoints,
  saveBestPoints,
  subscribeBestPoints,
} from './highScore'
import {
  getMuted,
  getServerMuted,
  saveMuted,
  subscribeMuted,
} from './muted'
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
  /** Prueba o reto (ver `gameMode.ts`). */
  gameMode: GameMode

  /** Ronda del reto, o `null` en un modo que no las tiene. */
  round: number | null
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
  /** Segundos para el saque. Solo tiene sentido en `countdown`. */
  countdown: number
  /**
   * Identificador de partida. Sube al empezar una nueva, y en reto también al
   * pasar de ronda: es lo que remonta la mesa y devuelve el disco al centro.
   */
  runId: number
  /** Si hay una sesión inmersiva abierta, es decir, si se juega con gafas. */
  immersive: boolean
  /** Si el juego está callado. Es de quien juega y se recuerda entre visitas. */
  muted: boolean

  setGoalTarget: (goals: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /** Elige modo. **Solo desde el menú** (ver el porqué en la implementación). */
  setGameMode: (mode: GameMode) => void
  setImmersive: (immersive: boolean) => void
  setMuted: (muted: boolean) => void

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
  const [goalTarget, setGoalTargetState] = useState(DEFAULT_GOALS)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // Se entra en prueba: quien acaba de llegar no tiene por qué estrenarse en un
  // reto que se acaba a la primera derrota. El reto está a un toque, al lado.
  const [gameMode, setGameModeState] = useState<GameMode>('practice')

  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
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

  // El silencio tampoco es estado de React: es una preferencia del navegador,
  // así que los dos menús —el de escritorio y el del visor— leen lo mismo y
  // cambiarlo en uno se ve en el otro (ver `muted.ts`).
  const muted = useSyncExternalStore(subscribeMuted, getMuted, getServerMuted)

  const challenge = gameMode === 'challenge'
  const round = challenge ? challengeRoundNumber : null
  const currentRound = challengeRound(challengeRoundNumber)
  const activeDifficulty = challenge ? currentRound.difficulty : difficulty
  const activeGoalTarget = challenge ? currentRound.goalTarget : goalTarget

  const totalPlayerGoals = previousPlayerGoals + playerGoals
  const totalOpponentGoals = previousOpponentGoals + opponentGoals

  // Cuándo se acaba una partida lo decide el marcador (ver `gameMode.ts`).
  const matchOutcome = running
    ? runOutcome({ playerGoals, opponentGoals, goalTarget: activeGoalTarget })
    : null
  // En reto, ganar no acaba nada: encadena la ronda siguiente. Solo perder
  // cierra un reto, y de ahí que no tenga final.
  const outcome = matchOutcome === 'won' && challenge ? null : matchOutcome

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
  useEffect(() => {
    if (!running || countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown])

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

  // Al terminar, la puntuación sale hacia el almacenamiento; guardar solo hace
  // algo si mejora lo que había, así que repetirlo no cambia nada. Se guarda al
  // final y no gol a gol para que durante la partida el récord siga siendo la
  // marca a batir.
  useEffect(() => {
    if (gameState !== 'finished') return
    saveBestPoints(gameMode, points)
  }, [gameState, gameMode, points])

  // La partida ha batido el récord con el que empezó *y* lo guardado es
  // exactamente esta puntuación. Sin esa segunda condición, con el
  // almacenamiento bloqueado la marca a batir se quedaría a cero para siempre y
  // cada partida con puntos se anunciaría como récord. Y se exige la igualdad y
  // no «al menos»: con dos pestañas abiertas, la otra puede haber guardado algo
  // mejor mientras se jugaba.
  const isRecord =
    gameState === 'finished' && points > recordToBeat && bestPoints === points

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
    clearRun()
    advancedRound.current = 0
    setRecordToBeat(getBestPoints(gameMode))
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setRunning(true)
  }, [clearRun, gameMode])

  const scorePlayer = useCallback(() => {
    setPlayerGoals((value) => value + 1)
    setLastScorer('player')
    // La racha se calcula aquí dentro porque los puntos dependen de ella: leer
    // `streak` del render anterior le daría el mismo bonus a dos goles
    // encadenados en el mismo lote de actualizaciones.
    setStreak((previous) => {
      const next = previous + 1
      setBestStreak((best) => Math.max(best, next))
      setPoints((total) => scoreGoal(total, { difficulty: activeDifficulty, streak: next }))
      return next
    })
  }, [activeDifficulty])

  const scoreOpponent = useCallback(() => {
    setOpponentGoals((value) => value + 1)
    setLastScorer('opponent')
    setStreak(0)
    setPoints((total) => scoreConceded(total))
  }, [])

  const setMuted = useCallback((value: boolean) => saveMuted(value), [])

  const resetGame = useCallback(() => {
    clearRun()
    setCountdown(0)
    setRunning(false)
  }, [clearRun])

  return useMemo(
    () => ({
      goalTarget,
      difficulty,
      gameMode,
      round,
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
      bestPoints,
      isRecord,
      outcome,
      gameState,
      countdown,
      runId,
      immersive,
      muted,
      setGoalTarget,
      setDifficulty,
      setGameMode,
      setImmersive,
      setMuted,
      startGame,
      scorePlayer,
      scoreOpponent,
      resetGame,
    }),
    [
      goalTarget,
      difficulty,
      gameMode,
      round,
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
      bestPoints,
      isRecord,
      outcome,
      gameState,
      countdown,
      runId,
      immersive,
      muted,
      setGoalTarget,
      setGameMode,
      setMuted,
      startGame,
      scorePlayer,
      scoreOpponent,
      resetGame,
    ],
  )
}

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) {
    throw new Error('useGame debe usarse dentro de <GameProvider>')
  }
  return store
}
