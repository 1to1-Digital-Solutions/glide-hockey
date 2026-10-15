import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENERY_KEY } from './settings'
import { DUEL_SETUP } from './duel'
import { getDuelTally } from './duelTally'
import { DEFAULT_GOALS, MAX_GOALS, MIN_GOALS } from './gameConfig'
import { clampGoalTarget, useGame, useGameStoreValue } from './gameStore'
import { getBestEndlessStreak, getBestPoints } from './highScore'
import { tableSeed } from './opponent'
import type { Goal } from './goal'
import type { GameResult } from './seed'
import { LEVEL_COUNT } from './levels'
import { OWN_SCENERY_KEY } from './scenery'

/**
 * The state of the match. The rules live in their modules —the scoreboard in
 * `gameMode.ts`, the physics in `puckPhysics.ts`—; what is tested here is what
 * only happens while playing: how an endless match ends, which is the only mode
 * decided not by the scoreboard but by whoever is playing.
 */

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Runs out the serve countdown: one tick per second, one per iteration. */
function waitForServe(hook: { result: { current: { gameState: string } } }): void {
  for (let i = 0; i < 10 && hook.result.current.gameState === 'countdown'; i += 1) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/**
 * Mounts the store and leaves **practice** chosen, which is what almost all these tests play: the
 * menu opens on the challenge (checked by «the menu opens on the challenge», further down).
 */
function inPractice(options: Parameters<typeof useGameStoreValue>[0] = {}) {
  const hook = renderHook(() => useGameStoreValue(options))
  act(() => hook.result.current.setGameMode('practice'))
  return hook
}

/** Mounts the store, chooses the endless match and serves. */
function startEndless() {
  const hook = inPractice()
  act(() => hook.result.current.setEndless(true))
  act(() => hook.result.current.startGame())
  waitForServe(hook)
  return hook
}

describe('the endless match', () => {
  it('the scoreboard does not close it: it stays alive however many goals fall', () => {
    const { result } = startEndless()

    for (let i = 0; i < 12; i += 1) act(() => result.current.scorePlayer())

    expect(result.current.outcome).toBeNull()
  })

  it('whoever is playing closes it, and it counts as won if they are ahead', () => {
    // It is its only way out with a summary: without this, leaving it would leave no best.
    const { result } = startEndless()

    act(() => result.current.scorePlayer())
    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('won')
  })

  it('and being behind on leaving it counts as lost', () => {
    const { result } = startEndless()

    act(() => result.current.scoreOpponent())
    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('lost')
  })

  it('tied on leaving it counts as won: the player held out', () => {
    const { result } = startEndless()

    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('won')
  })
})

describe('how many goals a match lasts', () => {
  it('what is asked for, if it fits in the range', () => {
    expect(clampGoalTarget(5)).toBe(5)
  })

  it('what falls outside the range is clamped to the limits', () => {
    expect(clampGoalTarget(0)).toBe(MIN_GOALS)
    expect(clampGoalTarget(999)).toBe(MAX_GOALS)
  })

  it('a number with decimals is rounded: there is no half goal', () => {
    expect(clampGoalTarget(4.6)).toBe(5)
  })

  it('what is not a number stays at the usual', () => {
    // It comes from what is stored in the browser and from the menu's control, which in the
    // headset can give an empty value.
    expect(clampGoalTarget(Number.NaN)).toBe(DEFAULT_GOALS)
  })
})

describe('the challenge', () => {
  it('winning a round ends nothing: it chains the next one', () => {
    // It is what makes the challenge have no ending: only losing closes it.
    const hook = inPractice()
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.startGame())
    waitForServe(hook)

    const round = hook.result.current.round
    for (let i = 0; i < 20 && hook.result.current.round === round; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(5000))
    }

    expect(hook.result.current.round).toBeGreaterThan(round ?? 0)
    expect(hook.result.current.outcome).toBeNull()
  })

  it('the round decides the difficulty, not what was chosen in the menu', () => {
    const hook = inPractice()
    act(() => hook.result.current.setDifficulty('impossible'))
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.startGame())

    // `difficulty` is still what was chosen in the menu; the one that rules is
    // `activeDifficulty`, which comes from the round.
    expect(hook.result.current.difficulty).toBe('impossible')
    expect(hook.result.current.activeDifficulty).not.toBe('impossible')
  })
})

describe('learning while playing the challenge', () => {
  const GOAL = {
    medals: { bronze: 150, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: null,
    mode: 'challenge',
  } as const

  it('with the tutorial being shown, the goals of the machine do not count', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.setLearning(true))
    for (let i = 0; i < 5; i += 1) act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.opponentGoals).toBe(0)
    expect(hook.result.current.gameState).toBe('playing')
  })

  it('when the tutorial closes the challenge starts from zero, and the sign announces for a moment that it now counts', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.setLearning(true))
    act(() => hook.result.current.scorePlayer())
    const table = hook.result.current.runId
    act(() => hook.result.current.setLearning(false))
    act(() => hook.result.current.finishLesson())

    expect(hook.result.current.playerGoals).toBe(0)
    expect(hook.result.current.points).toBe(0)
    expect(hook.result.current.runId).toBe(table + 1)
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.sign?.title).toBe('Now it counts for a medal')

    act(() => void vi.advanceTimersByTime(2600))
    expect(hook.result.current.sign?.title).not.toBe('Now it counts for a medal')
  })

  it('outside the challenge, learning changes nothing and closing the tutorial does not start again', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.setLearning(true))
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.opponentGoals).toBe(1)
    const table = hook.result.current.runId
    act(() => hook.result.current.finishLesson())
    expect(hook.result.current.runId).toBe(table)
    expect(hook.result.current.opponentGoals).toBe(1)
  })

  it('and at the menu it does nothing either', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.finishLesson())
    expect(hook.result.current.gameState).toBe('menu')
  })
})

describe('the levels', () => {
  it('only the unlocked ones can be chosen', () => {
    const hook = inPractice()
    act(() => hook.result.current.setGameMode('levels'))

    act(() => hook.result.current.setLevel(LEVEL_COUNT))

    expect(hook.result.current.level).toBe(1)
  })

  it('winning the first one records it with stars and unlocks the next one', () => {
    const hook = inPractice()
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    waitForServe(hook)

    for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.outcome).toBe('won')
    expect(hook.result.current.levelResult?.passed).toBe(true)
    expect(hook.result.current.levelResult?.unlocked).toBe(2)
  })

  it('the level being played does not change even if the menu is touched mid-match', () => {
    const hook = inPractice()
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    const playing = hook.result.current.activeLevel

    act(() => hook.result.current.setLevel(1))

    expect(hook.result.current.activeLevel).toBe(playing)
  })
})

describe('what is stored at the end', () => {
  it('the score of a practice match is stored as a record', () => {
    // It is stored at the end and not goal by goal: during the match the record has to
    // stay the best to beat.
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    waitForServe(hook)

    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.outcome).toBe('won')
    expect(hook.result.current.isRecord).toBe(true)
    expect(hook.result.current.bestPoints).toBe(hook.result.current.points)
  })

  it('repeating a level already passed does not unlock the next one again', () => {
    // Unlocking happens once: without this, the summary would promise a new level
    // every time the first one is repeated.
    const first = inPractice()
    act(() => first.result.current.setGameMode('levels'))
    act(() => first.result.current.startGame())
    waitForServe(first)
    for (let i = 0; i < 40 && first.result.current.gameState !== 'finished'; i += 1) {
      act(() => first.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(first.result.current.levelResult?.unlocked).toBe(2)

    const second = inPractice()
    act(() => second.result.current.setGameMode('levels'))
    act(() => second.result.current.setLevel(1))
    act(() => second.result.current.startGame())
    waitForServe(second)
    for (let i = 0; i < 40 && second.result.current.gameState !== 'finished'; i += 1) {
      act(() => second.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(second.result.current.levelResult?.passed).toBe(true)
    expect(second.result.current.levelResult?.unlocked).toBeNull()
  })

  it('in levels there is no points record: what counts are the stars', () => {
    const hook = inPractice()
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    waitForServe(hook)

    for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.isRecord).toBe(false)
    expect(hook.result.current.levelStars[0]).toBeGreaterThan(0)
  })

  it('the streak of the endless match is stored on leaving it', () => {
    const { result } = startEndless()

    act(() => result.current.scorePlayer())
    act(() => result.current.scorePlayer())
    act(() => result.current.endRun())

    // In the endless match the best is not the points, it is the streak: that is what
    // the summary shows and what is stored.
    expect(result.current.gameState).toBe('finished')
    expect(result.current.bestStreak).toBeGreaterThan(0)
    expect(getBestEndlessStreak()).toBe(result.current.bestStreak)
    expect(result.current.bestPoints).toBe(result.current.bestStreak)
  })
})

describe('changing mode', () => {
  it('cannot be done mid-match', () => {
    // The points and the mode they were earned in are a pair: with the summary
    // on screen, changing mode would copy that score to the record of the other one.
    const hook = inPractice()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('practice')
  })

  it('from the menu it can', () => {
    const hook = inPractice()

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('challenge')
  })
})

describe('the goals and endless with the match finished', () => {
  /** A practice match won at the default goals, with the summary on screen. */
  function wonMatch() {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(hook.result.current.outcome).toBe('won')
    return hook
  }

  it('raising the target does not put it back in play', () => {
    // The ending is read from the target on every render: changing it rewrote a result already decided.
    const hook = wonMatch()

    act(() => hook.result.current.setGoalTarget(DEFAULT_GOALS + 2))

    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.goalTarget).toBe(DEFAULT_GOALS)
  })

  it('nor does switching to endless', () => {
    const hook = wonMatch()

    act(() => hook.result.current.setEndless(true))

    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.endless).toBe(false)
  })

  it('back at the menu they are chosen as always', () => {
    const hook = wonMatch()
    act(() => hook.result.current.resetGame())

    act(() => hook.result.current.setGoalTarget(DEFAULT_GOALS + 2))
    act(() => hook.result.current.setEndless(true))

    expect(hook.result.current.goalTarget).toBe(DEFAULT_GOALS + 2)
    expect(hook.result.current.endless).toBe(true)
  })
})

describe('going back to the menu', () => {
  it('leaves the table ready for another match', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.scorePlayer())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.playerGoals).toBe(0)
  })

  it('the goals of the menu are clamped to the range', () => {
    const hook = inPractice()

    act(() => hook.result.current.setGoalTarget(999))

    expect(hook.result.current.goalTarget).toBe(MAX_GOALS)
  })
})

describe('using the store without having mounted it', () => {
  it('warns with a clear error instead of breaking somewhere else', () => {
    // Without this, the failure would come out as «cannot read points of null» in the
    // component that asks for it, which is not where the error is.
    expect(() => renderHook(() => useGame())).toThrow(/GameProvider/)
  })
})

/**
 * The serve waits for the mallet to be in the hand.
 *
 * **With the headset on the match started without it**: the puck went out and there was nothing
 * to stop it with, because picking up the mallet is a gesture learned right in those three
 * seconds. On desktop it does not apply —the mouse carries the mallet from the first frame—, so
 * it only waits inside a session.
 */
describe('the serve with the headset on', () => {
  it('does not go past the last second without the mallet in the hand', () => {
    const hook = inPractice()
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())

    // The count goes down to the last second and stays there.
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.countdown).toBe(1)
    expect(hook.result.current.gameState).toBe('countdown')
  })

  it('and says so: while it waits, the game announces that it still has to be picked up', () => {
    // The 1 stuck with no explanation is what was reported from the headset: «the countdown stays
    // stuck on 1 with no explanation». The countdown writes what is missing and the mallet
    // lights up, and both things hang from this signal.
    const hook = inPractice()
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.waitingForMallet).toBe(true)

    act(() => hook.result.current.setMalletHeld(true))
    expect(hook.result.current.waitingForMallet).toBe(false)
  })

  it('outside the headset it waits for nobody: there the mallet goes with the mouse', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.waitingForMallet).toBe(false)
  })

  it('as soon as it is picked up, it serves', () => {
    const hook = inPractice()
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    act(() => hook.result.current.setMalletHeld(true))
    act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.gameState).toBe('playing')
  })

  it('on desktop it waits for nothing', () => {
    // The mouse carries the mallet from the first frame: waiting would be never starting.
    const hook = inPractice()
    act(() => hook.result.current.startGame())

    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.gameState).toBe('playing')
  })
})

/**
 * Leaving the match asks first.
 *
 * **It gets pressed by accident and the goals are lost.** With the headset on you cannot see what
 * is at the sides and the arm passes where it passes. What makes asking not costly is that
 * the table stops: the puck does not run while the question is on screen.
 */
describe('leaving the match', () => {
  it('asks instead of exiting', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.askToQuit())

    expect(hook.result.current.prompt).toBe('quit')
    expect(hook.result.current.gameState).not.toBe('menu')
  })

  it('keeping on playing puts it back where it was', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.keepPlaying())

    expect(hook.result.current.prompt).toBeNull()
  })

  it('and confirming does exit', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.prompt).toBeNull()
    expect(hook.result.current.gameState).toBe('menu')
  })

  it('starting another one sweeps the question away', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.startGame())

    expect(hook.result.current.prompt).toBeNull()
  })
})

/**
 * The countdown waits for the demonstration to end.
 *
 * Starting while the tutorial explains the gesture is starting without it: the serve came with the explanation half done. It only happens
 * with the headset on and only the first time, which is just when it matters most.
 */
describe('waiting for the demonstration', () => {
  it('while it runs, the countdown does not go down', () => {
    const hook = inPractice()
    act(() => hook.result.current.setTutorialRunning(true))
    act(() => hook.result.current.startGame())
    const from = hook.result.current.countdown

    act(() => void vi.advanceTimersByTime(5000))

    expect(hook.result.current.countdown).toBe(from)
    expect(hook.result.current.gameState).toBe('countdown')
  })

  it('and as soon as it ends, it gets going', () => {
    const hook = inPractice()
    act(() => hook.result.current.setTutorialRunning(true))
    act(() => hook.result.current.startGame())
    act(() => void vi.advanceTimersByTime(5000))

    const paused = hook.result.current.countdown

    act(() => hook.result.current.setTutorialRunning(false))
    act(() => void vi.advanceTimersByTime(1100))

    expect(hook.result.current.countdown).toBeLessThan(paused)
  })
})

describe('the scenery, which belongs to the hall', () => {
  it('the stage button writes the scenery of the hall', () => {
    // It is what the two menus call —the web one and the headset one—: a single preference, the
    // same one the hall's panel shows, and not one of the game that contradicts it.
    window.localStorage.removeItem(SCENERY_KEY)
    const hook = inPractice()

    act(() => hook.result.current.setScenery('room'))

    expect(hook.result.current.scenery).toBe('room')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()

    act(() => hook.result.current.setScenery('place'))
    expect(hook.result.current.scenery).toBe('place')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('what is chosen in the hall reaches the match without reloading', () => {
    window.localStorage.removeItem(SCENERY_KEY)
    const hook = inPractice()

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(hook.result.current.scenery).toBe('room')
    window.localStorage.removeItem(SCENERY_KEY)
  })

  it('the own key of the game does not rule and is deleted when the match mounts, without moving it over', () => {
    // With «tu habitación» stored in this cabinet's own key it cannot be left without
    // the room: what the hall says rules, and with nothing chosen there, the drawn place.
    window.localStorage.removeItem(SCENERY_KEY)
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    const hook = inPractice()

    expect(hook.result.current.scenery).toBe('place')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })
})

/** Until the machine closes the match in progress, goal by goal. */
function loseMatch(hook: { result: { current: ReturnType<typeof useGameStoreValue> } }): void {
  for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
    act(() => hook.result.current.scoreOpponent())
  }
}

describe('the challenge the hall passes', () => {
  it('goes straight into the challenge, with its countdown and without going through the menu', () => {
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 4_000_000_000 } }))
    expect(hook.result.current.gameMode).toBe('challenge')
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.round).toBe(1)
    expect(hook.result.current.inChallenge).toBe(true)
    expect(hook.result.current.seed).toBe(tableSeed(4_000_000_000, 0, 1))
  })

  it('the table of each round comes from the seed and the round', () => {
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 } }))
    waitForServe(hook)
    const first = hook.result.current.seed
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(5000))
    }
    expect(hook.result.current.round).toBe(2)
    expect(hook.result.current.seed).toBe(tableSeed(7, 0, 2))
    expect(hook.result.current.seed).not.toBe(first)
  })

  it('on losing it tells the hall only once, with its points and as a challenge', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    act(() => hook.result.current.scorePlayer())
    loseMatch(hook)
    const points = hook.result.current.points
    // Neither a repaint of the host nor a goal that arrives with the match already
    // over —the puck was still rolling— counts it again.
    hook.rerender()
    act(() => hook.result.current.scorePlayer())
    act(() => void vi.advanceTimersByTime(5000))

    expect(hook.result.current.outcome).toBe('lost')
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'challenge', points: points, challenge: true })
    // And the record is still stored as always.
    expect(getBestPoints('challenge')).toBeGreaterThanOrEqual(points)
  })

  it('even if it is not a record, it reports the points of the match', () => {
    localStorage.setItem('glide-hockey:best-points:challenge', '9000')
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    act(() => hook.result.current.scorePlayer())
    loseMatch(hook)

    expect(hook.result.current.isRecord).toBe(false)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'challenge', points: hook.result.current.points, challenge: true })
  })

  it('the match after it is no longer the challenge, nor does it play its table', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    loseMatch(hook)

    act(() => hook.result.current.startGame())
    expect(hook.result.current.inChallenge).toBe(false)
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    waitForServe(hook)
    loseMatch(hook)

    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1]?.[0]).toEqual({ mode: 'challenge', points: 0, challenge: false })
  })

  it('leaving it halfway does not count as finished', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    act(() => hook.result.current.askToQuit())
    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.inChallenge).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('without a challenge, any match is reported at the end, in its mode', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = inPractice({ onFinish })
    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.inChallenge).toBe(false)
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    // Won without conceding: the first time it brings the feat (`feats.ts`).
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'practice',
      points: hook.result.current.points,
      challenge: false,
      feats: ['GH_SHUTOUT'],
    })
  })

  it('with nothing, the table plays with the match number, as always', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    expect(hook.result.current.gameMode).toBe('practice')
  })
})

describe('the menu opens on the challenge', () => {
  it('without touching anything the chosen mode is the challenge, and Jugar starts the match that gives a medal', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.inChallenge).toBe(false)

    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.round).toBe(1)
    expect(result.current.sign?.title).toBe('Win games until you lose one')
  })

  it('always: it does not remember the mode of the last match', () => {
    const first = inPractice()
    act(() => first.result.current.startGame())
    first.unmount()

    const second = renderHook(() => useGameStoreValue())

    expect(second.result.current.gameMode).toBe('challenge')
    expect(localStorage.length).toBe(0)
  })

  it('practice is still one tap away', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('practice'))
    act(() => result.current.startGame())

    expect(result.current.gameMode).toBe('practice')
    expect(result.current.round).toBeNull()
  })
})

describe('the goal sign', () => {
  const GOAL = {
    medals: { bronze: 150, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: null,
    mode: 'challenge',
  } as const

  /** Loses the round in progress: the machine scores the goals it takes. */
  function loseRound(hook: { result: { current: ReturnType<typeof useGameStoreValue> } }): void {
    for (let i = 0; i < MAX_GOALS && hook.result.current.gameState === 'playing'; i += 1) {
      act(() => hook.result.current.scoreOpponent())
    }
  }

  it('at the menu there is no sign at all: it is hung on playing', () => {
    const { result } = renderHook(() => useGameStoreValue({ goal: GOAL }))

    expect(result.current.gameState).toBe('menu')
    expect(result.current.goal).toBe(GOAL)
    expect(result.current.sign).toBeNull()
    expect(result.current.medal).toBeNull()
    expect(result.current.omitted).toEqual({ points: false, round: false })
  })

  it('with the goal of the hall: the mission and the thresholds in the countdown, and afterwards the one still to reach', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())

    expect(hook.result.current.sign).toMatchObject({
      title: 'Win games until you lose one',
      detail: 'Bronze 150 · Silver 8,000 · Gold 20,000',
    })
    // The scoreboard below already omits what the sign is going to say.
    expect(hook.result.current.omitted).toEqual({ points: true, round: true })

    waitForServe(hook)
    expect(hook.result.current.sign).toMatchObject({
      title: 'Bronze at 150 · you have 0',
      detail: 'Round 1 · to 3 goals · goal +100',
    })
    expect(hook.result.current.medal).toBeNull()

    act(() => hook.result.current.scorePlayer())
    // What remains says what the next goal is worth, which with the streak is already more.
    expect(hook.result.current.sign).toMatchObject({
      title: 'Bronze at 150 · you have 100',
      detail: 'Round 1 · to 3 goals · goal +120',
    })
  })

  it('on crossing a threshold the medal goes up, in the first round conceding does not subtract, and at the end the sign says what was missing', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)

    act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.medal).toBeNull()
    act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.medal).toBe('bronze')
    expect(hook.result.current.sign?.title).toBe('Silver at 8,000 · you have 220')

    // In the first round of the challenge, a goal conceded does not subtract (`concededPenalty`).
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.medal).toBe('bronze')

    // And on losing the round what was scored stays: at the end, the sign says what was missing.
    loseRound(hook)
    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.sign).toMatchObject({
      title: 'Bronze · 220 points in the challenge',
      detail: '7,780 short of silver',
    })
    // The round it stopped at goes back to the scoreboard; the points stay on the sign.
    expect(hook.result.current.omitted).toEqual({ points: true, round: false })

    // Repeating —the highlighted button at the end— goes back to the mission, without going through the menu.
    act(() => hook.result.current.startGame())
    expect(hook.result.current.gameMode).toBe('challenge')
    expect(hook.result.current.sign?.title).toBe('Win games until you lose one')
    expect(hook.result.current.medal).toBeNull()
  })

  it('at the end, the record of the hall is the one from before the match, even if the hall has already raised its own', () => {
    let hallGoal: Goal = { ...GOAL, record: 100 }
    const hook = renderHook(() =>
      useGameStoreValue({ goal: hallGoal, onFinish: ({ points }) => void (hallGoal = { ...hallGoal, record: points }) }),
    )
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scorePlayer())
    loseRound(hook)
    // The hall has recorded the match and paints the game again with its new record.
    hook.rerender()

    expect(hallGoal.record).toBe(220)
    expect(hook.result.current.sign).toMatchObject({ title: 'Bronze · 220 points in the challenge', footer: 'New record!' })
  })

  it('losing the first round 1–3 with one goal scored does not leave zero', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.scorePlayer())
    loseRound(hook)
    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.points).toBe(100)
  })

  it('from the second round on, conceding subtracts and it is possible to drop below a threshold already crossed', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    waitForServe(hook)
    expect(hook.result.current.round).toBe(2)
    const before = hook.result.current.points
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.points).toBe(before - 60)
  })

  it('the countdown of the second round is no longer the mission: the threshold stays, with its round', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())

    expect(hook.result.current.round).toBe(2)
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.sign?.detail).toMatch(/^Round 2 · to 5 goals · goal \+\d+$/)
  })

  it('in practice, inside the hall, it says quietly that it does not count', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: GOAL }))
    act(() => hook.result.current.setGameMode('practice'))
    act(() => hook.result.current.startGame())

    expect(hook.result.current.sign).toMatchObject({ title: 'Practice · does not count for a medal', subdued: true })
    expect(hook.result.current.omitted).toEqual({ points: false, round: false })
    waitForServe(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.medal).toBeNull()
  })

  it('with the game opened on its own: in the challenge, the mission and the stored record; in practice, nothing', () => {
    localStorage.setItem('glide-hockey:best-points:challenge', '3100')
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())

    expect(hook.result.current.goal).toBeNull()
    expect(hook.result.current.sign).toMatchObject({ title: 'Win games until you lose one', detail: 'Your record 3,100' })

    act(() => hook.result.current.resetGame())
    act(() => hook.result.current.setGameMode('practice'))
    act(() => hook.result.current.startGame())
    expect(hook.result.current.sign).toBeNull()
  })

  it('with the challenge of the hall, which starts playing, the sign is there from the first frame', () => {
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, goal: GOAL }))

    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.sign?.detail).toBe('Bronze 150 · Silver 8,000 · Gold 20,000')
  })
})

describe('a goal with the match already decided', () => {
  // The puck keeps rolling when the match is decided: if it goes in, it belongs to no match.
  it('changes neither the points nor the scoreboard nor the record', () => {
    const hook = inPractice()
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    const atEnd = hook.result.current
    const record = getBestPoints('practice')
    expect(atEnd.outcome).toBe('won')
    expect(record).toBe(atEnd.points)

    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scoreOpponent())

    expect(hook.result.current.points).toBe(atEnd.points)
    expect(hook.result.current.playerGoals).toBe(atEnd.playerGoals)
    expect(hook.result.current.opponentGoals).toBe(atEnd.opponentGoals)
    expect(hook.result.current.streak).toBe(atEnd.streak)
    expect(getBestPoints('practice')).toBe(record)
    expect(hook.result.current.isRecord).toBe(true)
  })

  it('nor outside a match, at the menu', () => {
    const hook = inPractice()
    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scoreOpponent())

    expect(hook.result.current.points).toBe(0)
    expect(hook.result.current.playerGoals).toBe(0)
    expect(hook.result.current.opponentGoals).toBe(0)
  })
})

describe('the duel', () => {
  type Hook = ReturnType<typeof renderHook<ReturnType<typeof useGameStoreValue>, unknown>>

  /** Plays the match of whoever holds the controller: `a` goals of theirs and `b` of the machine. */
  function play(hook: Hook, a: number, b: number): void {
    waitForServe(hook)
    for (let i = 0; i < a; i += 1) act(() => hook.result.current.scorePlayer())
    for (let i = 0; i < b; i += 1) act(() => hook.result.current.scoreOpponent())
  }

  /** Mounts the store, chooses the duel and starts the first player's match. */
  function startDuel(onFinish?: (result: GameResult) => void): Hook {
    const hook = inPractice({ onFinish })
    act(() => hook.result.current.setGameMode('duel'))
    act(() => hook.result.current.startGame())
    return hook
  }

  it('the first one plays, the controller is handed over and the second one plays', () => {
    const hook = startDuel()
    expect(hook.result.current.duel?.player).toBe(0)

    play(hook, 3, DUEL_SETUP.goalTarget)
    expect(hook.result.current.gameState).toBe('finished')
    // The handover: the first player's match already counts, and it is the second player's turn.
    expect(hook.result.current.duel).toEqual({
      player: 0,
      matches: [{ scored: 3, conceded: DUEL_SETUP.goalTarget }, null],
      next: 1,
      over: false,
      winner: null,
    })

    act(() => hook.result.current.startGame())
    expect(hook.result.current.duel?.player).toBe(1)
    expect(hook.result.current.playerGoals).toBe(0)
  })

  it('both play against the same machine: same level, same goals and same seed', () => {
    const hook = startDuel()
    // What was chosen in practice does not count in the duel.
    const first = hook.result.current
    expect(first.activeDifficulty).toBe(DUEL_SETUP.difficulty)
    expect(first.activeGoalTarget).toBe(DUEL_SETUP.goalTarget)

    play(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())
    const second = hook.result.current

    expect(second.runId).toBe(first.runId + 1)
    expect(second.seed).toBe(first.seed)
    expect(second.activeDifficulty).toBe(first.activeDifficulty)
    expect(second.activeGoalTarget).toBe(first.activeGoalTarget)
  })

  it('another duel is another seed', () => {
    const hook = startDuel()
    const before = hook.result.current.seed
    play(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())
    play(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())

    expect(hook.result.current.seed).not.toBe(before)
  })

  it('at the end it is known who wins and it is recorded on the scoreboard of the pair', () => {
    const hook = startDuel()
    play(hook, DUEL_SETUP.goalTarget, 2)
    act(() => hook.result.current.startGame())
    play(hook, 1, DUEL_SETUP.goalTarget)

    expect(hook.result.current.duel?.over).toBe(true)
    expect(hook.result.current.duel?.winner).toBe(0)
    expect(hook.result.current.duel?.next).toBeNull()
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })

    // Again is a new duel, which the first player starts.
    act(() => hook.result.current.startGame())
    expect(hook.result.current.duel?.player).toBe(0)
    expect(hook.result.current.duel?.matches).toEqual([null, null])
  })

  it('with the same lead it is a tie, and it is recorded as a tie', () => {
    const hook = startDuel()
    play(hook, DUEL_SETUP.goalTarget, 4)
    act(() => hook.result.current.startGame())
    play(hook, DUEL_SETUP.goalTarget, 4)

    expect(hook.result.current.duel?.over).toBe(true)
    expect(hook.result.current.duel?.winner).toBeNull()
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('going back to the menu drops the duel: the first one starts the next', () => {
    const hook = startDuel()
    play(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.resetGame())
    act(() => hook.result.current.startGame())

    expect(hook.result.current.duel?.player).toBe(0)
    expect(hook.result.current.duel?.matches).toEqual([null, null])
  })

  it('there is no record nor is the hall told: the goals belong to two people', () => {
    const onFinish = vi.fn()
    const hook = startDuel(onFinish)
    play(hook, DUEL_SETUP.goalTarget, 0)

    expect(hook.result.current.isRecord).toBe(false)
    expect(hook.result.current.bestPoints).toBe(0)
    expect(getBestPoints('duel')).toBe(0)
    expect(getBestPoints('practice')).toBe(0)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('outside the duel there is no duel', () => {
    const { result } = inPractice()
    expect(result.current.duel).toBeNull()
  })
})

describe('the feats of the match', () => {
  /** A practice to 3 goals, served. */
  function practice(onFinish: (result: GameResult) => void) {
    const hook = inPractice({ onFinish })
    act(() => hook.result.current.setGoalTarget(3))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    return hook
  }

  it('those of the table are recorded and reported to the hall at the end, once in a lifetime', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = practice(onFinish)
    act(() => hook.result.current.scoreOpponent())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    // 3-1: wins, but not without conceding.
    expect(onFinish).toHaveBeenLastCalledWith(expect.objectContaining({ feats: ['GH_OWN_GOAL'] }))

    // With the match decided nothing is recorded any more, and the next one does not repeat it.
    act(() => hook.result.current.recordFeat('GH_LONG_SHOT'))
    act(() => hook.result.current.startGame())
    waitForServe(hook)
    act(() => hook.result.current.scoreOpponent())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1]?.[0]).not.toHaveProperty('feats')
  })

  it('in the challenge, the round won without conceding is reported on losing the challenge', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    expect(hook.result.current.round).toBe(2)
    waitForServe(hook)
    loseMatch(hook)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', feats: ['GH_SHUTOUT'] }))
  })

  it('almost: the round won conceding one does not bring it', () => {
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    waitForServe(hook)
    act(() => hook.result.current.scoreOpponent())
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    waitForServe(hook)
    loseMatch(hook)
    expect(onFinish.mock.calls[0]?.[0]).not.toHaveProperty('feats')
  })

  it('leaving it halfway does not store those of the table', () => {
    const hook = practice(vi.fn())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    act(() => hook.result.current.resetGame())
    expect(localStorage.getItem('glide-hockey:hazanas')).toBeNull()
  })
})

/**
 * The common hook of the browser tests (`testRun.ts`): what the common screenshots
 * ask of the match without playing it.
 */
describe('the hook of the match', () => {
  const GOAL: Goal = {
    medals: { bronze: 10, silver: 20, gold: 30 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  afterEach(() => {
    delete globalThis.__runGlideHockey
  })

  it('without asking for it leaves nothing', () => {
    renderHook(() => useGameStoreValue({ goal: GOAL }))
    expect(globalThis.__runGlideHockey).toBeUndefined()
  })

  it('starts the challenge without tutorial, sets the points, ends it reporting it and returns the sign', () => {
    globalThis.__runGlideHockey = {}
    const onFinish = vi.fn<(result: GameResult) => void>()
    const hook = inPractice({ goal: GOAL, onFinish })
    const run = globalThis.__runGlideHockey
    expect(run.sign!()).toBeNull()

    act(() => run.start!())
    expect([hook.result.current.gameMode, hook.result.current.gameState]).toEqual(['challenge', 'countdown'])
    expect(hook.result.current.milestones).toEqual({ grab: true, hit: true, goal: true })
    expect(run.sign!()?.detail).toContain('Bronze 10')

    act(() => run.score!(1))
    expect(hook.result.current.gameState).toBe('playing')
    expect(run.sign!()?.title).toBe('Bronze at 10 · you have 1')
    act(() => run.score!(10))
    expect(run.sign!()?.cheer).toBe('Bronze!')

    act(() => run.end!())
    expect(hook.result.current.gameState).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', points: 10 }))
    expect(run.sign!()?.title).toMatch(/^Bronze · /)
  })
})
