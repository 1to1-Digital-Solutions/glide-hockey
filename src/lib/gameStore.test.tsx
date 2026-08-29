import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGE_GOAL_STEPS, challengeRound } from './challenge'
import {
  COUNTDOWN_SECONDS,
  DEFAULT_GOALS,
  MAX_GOALS,
  MIN_GOALS,
} from './gameConfig'
import { useGameStoreValue } from './gameStore'
import { getBestPoints } from './highScore'
import { CONCEDED_PENALTY } from './scoring'

type Store = { current: ReturnType<typeof useGameStoreValue> }

/**
 * Deja pasar la cuenta atrás.
 *
 * Con reloj falso y no esperando de verdad: un test que tarda tres segundos en
 * empezar es un test que acaba ignorándose. Se recorre segundo a segundo porque
 * el store encadena un `setTimeout` por tic, no uno solo de tres segundos.
 */
function skipCountdown() {
  for (let i = 0; i < COUNTDOWN_SECONDS; i++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/** Mete `goals` goles seguidos, como haría la escena gol a gol. */
function scorePlayer(store: Store, goals: number) {
  for (let i = 0; i < goals; i++) act(() => store.current.scorePlayer())
}

function scoreOpponent(store: Store, goals: number) {
  for (let i = 0; i < goals; i++) act(() => store.current.scoreOpponent())
}

describe('useGameStoreValue', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('entra en el menú, en prueba y con la partida por defecto', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.gameMode).toBe('practice')
    expect(result.current.goalTarget).toBe(DEFAULT_GOALS)
    expect(result.current.round).toBeNull()
  })

  it('no acepta partidas de más ni de menos goles de los que existen', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGoalTarget(999))
    expect(result.current.goalTarget).toBe(MAX_GOALS)

    act(() => result.current.setGoalTarget(0))
    expect(result.current.goalTarget).toBe(MIN_GOALS)
  })

  it('cuenta atrás antes del saque y luego se juega', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)

    skipCountdown()
    expect(result.current.gameState).toBe('playing')
  })

  it('termina la prueba en cuanto alguien llega a los goles pactados', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGoalTarget(3))
    act(() => result.current.startGame())
    skipCountdown()

    scorePlayer(result, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('won')
  })

  it('la pierde si llega antes la máquina', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGoalTarget(3))
    act(() => result.current.startGame())
    skipCountdown()

    scoreOpponent(result, 3)

    expect(result.current.outcome).toBe('lost')
  })

  it('suma puntos al marcar y resta al encajar', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    skipCountdown()

    scorePlayer(result, 2)
    const marcados = result.current.points
    expect(marcados).toBeGreaterThan(0)

    scoreOpponent(result, 1)
    expect(result.current.points).toBe(marcados - CONCEDED_PENALTY)
  })

  it('un gol en contra corta la racha', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    skipCountdown()

    scorePlayer(result, 3)
    expect(result.current.streak).toBe(3)

    scoreOpponent(result, 1)
    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(3)
  })

  it('recuerda quién marcó el último gol, que es quien decide el saque', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    skipCountdown()
    expect(result.current.lastScorer).toBeNull()

    scoreOpponent(result, 1)
    expect(result.current.lastScorer).toBe('opponent')
  })

  it('en reto, ganar encadena la ronda siguiente en vez de terminar', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('challenge'))
    act(() => result.current.startGame())
    skipCountdown()

    scorePlayer(result, CHALLENGE_GOAL_STEPS[0])

    expect(result.current.outcome).toBeNull()
    expect(result.current.round).toBe(2)
    expect(result.current.activeGoalTarget).toBe(challengeRound(2).goalTarget)
    // El marcador de la ronda se vacía, pero lo jugado sigue contando.
    expect(result.current.playerGoals).toBe(0)
    expect(result.current.totalPlayerGoals).toBe(CHALLENGE_GOAL_STEPS[0])
  })

  it('en reto, la primera partida perdida lo acaba', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('challenge'))
    act(() => result.current.startGame())
    skipCountdown()

    scoreOpponent(result, CHALLENGE_GOAL_STEPS[0])

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('lost')
  })

  it('en reto, el nivel lo manda la ronda y no lo elegido en el menú', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setDifficulty('impossible'))
    act(() => result.current.setGameMode('challenge'))

    expect(result.current.activeDifficulty).toBe(challengeRound(1).difficulty)
  })

  it('no deja cambiar de modo con una partida en marcha', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    act(() => result.current.setGameMode('challenge'))

    expect(result.current.gameMode).toBe('practice')
  })

  it('guarda el récord del modo jugado al terminar', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGoalTarget(3))
    act(() => result.current.startGame())
    skipCountdown()
    scorePlayer(result, 3)

    expect(getBestPoints('practice')).toBe(result.current.points)
    expect(getBestPoints('challenge')).toBe(0)
    expect(result.current.isRecord).toBe(true)
  })

  it('no anuncia récord si no se ha superado el anterior', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGoalTarget(3))
    act(() => result.current.startGame())
    skipCountdown()
    scorePlayer(result, 3)

    act(() => result.current.resetGame())
    act(() => result.current.startGame())
    skipCountdown()
    // La misma partida otra vez: iguala el récord, no lo bate.
    scorePlayer(result, 3)

    expect(result.current.isRecord).toBe(false)
  })

  it('volver al menú deja el marcador y los puntos a cero', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.startGame())
    skipCountdown()
    scorePlayer(result, 2)

    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.points).toBe(0)
    expect(result.current.playerGoals).toBe(0)
  })
})
