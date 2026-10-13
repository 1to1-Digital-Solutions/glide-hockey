/**
 * The session of Glide Hockey in Godot (`match.ts`) against what the web's `gameStore` does.
 *
 * They are the same rules that `gameStore.test.tsx` and `bothMenus.test.ts` test on the web,
 * which do not go into the engine because they mount React: what can be chosen and when, the
 * countdown, the score and the points, the end of each mode, what is stored, the ladder of the
 * challenge and the contract of the hall's challenge. It runs inside the engine, with the domain tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { DUEL_SETUP } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { COUNTDOWN_SECONDS, DEFAULT_GOALS, MAX_GOALS, MIN_GOALS } from '@/lib/gameConfig'
import { getBestEndlessStreak, getBestPoints } from '@/lib/highScore'
import { getStarsList, getUnlockedLevel } from '@/lib/progress'
import { goalPoints } from '@/lib/scoring'
import { tableSeed } from '@/lib/opponent'
import type { GameResult } from '@/lib/seed'
import { gameStorage } from '@/lib/storage'

import { Match, clampGoals, type MatchOptions } from './match'

/** Passes the whole countdown, in frames of 1/60. */
function serve(match: Match): void {
  for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) match.tick(1 / 60)
}

/**
 * A match with **practice** chosen, which is what almost all these tests play: the menu opens on
 * the challenge (the first one checks it).
 */
function inPractice(options: MatchOptions = {}): Match {
  const match = new Match(options)
  match.setGameMode('practice')
  return match
}

function score(match: Match, player: number, machine: number): void {
  for (let i = 0; i < player; i++) match.scorePlayer()
  for (let i = 0; i < machine; i++) match.scoreOpponent()
}

describe('the match in Godot does what the web store does', () => {
  beforeEach(() => gameStorage()?.clear())

  it('starts in the menu, with the challenge chosen, Easy and the default goals: playing without touching anything is the challenge', () => {
    const p = new Match()
    expect(p.gameState).toBe('menu')
    expect([p.gameMode, p.difficulty, p.goalTarget]).toEqual(['challenge', 'easy', DEFAULT_GOALS])
    expect(p.inChallenge).toBe(false)
    p.startGame()
    expect([p.gameMode, p.gameState, p.round]).toEqual(['challenge', 'countdown', 1])
    expect(p.sign('en')?.title).toBe('Win games until you lose one')
  })

  it('always: it does not remember the mode of the last match, and practice is one tap away', () => {
    const first = new Match()
    first.setGameMode('practice')
    first.startGame()
    expect([first.gameMode, first.round]).toEqual(['practice', null])
    expect(new Match().gameMode).toBe('challenge')
  })

  it('the goals stay between the minimum and the maximum', () => {
    expect(clampGoals(1)).toBe(MIN_GOALS)
    expect(clampGoals(99)).toBe(MAX_GOALS)
    expect(clampGoals(Number.NaN)).toBe(DEFAULT_GOALS)
  })

  it('play opens the countdown and, once past, it is played; with the match running nothing is chosen', () => {
    const p = inPractice()
    p.startGame()
    expect(p.gameState).toBe('countdown')
    expect(p.count).toBe(COUNTDOWN_SECONDS)
    serve(p)
    expect(p.gameState).toBe('playing')
    p.setGameMode('challenge')
    p.setGoalTarget(3)
    p.setDifficulty('hard')
    expect([p.gameMode, p.goalTarget, p.difficulty]).toEqual(['practice', DEFAULT_GOALS, 'easy'])
  })

  it('with the question of leaving in front the countdown does not run', () => {
    const p = inPractice()
    p.startGame()
    p.askToQuit()
    serve(p)
    expect(p.gameState).toBe('countdown')
    p.keepPlaying()
    serve(p)
    expect(p.gameState).toBe('playing')
  })

  it('with the headset, the countdown stops in the last second until the mallet is in the hand', () => {
    const p = inPractice()
    p.immersive = true
    p.startGame()
    serve(p)
    expect(p.gameState).toBe('countdown')
    expect(p.waitingForMallet).toBe(true)
    expect(p.count).toBe(1)
    p.malletHeld = true
    expect(p.waitingForMallet).toBe(false)
    serve(p)
    expect(p.gameState).toBe('playing')
  })

  it('the goals before the serve do not count; in play they add, subtract and keep the streak', () => {
    const p = inPractice()
    p.startGame()
    p.scorePlayer()
    expect(p.playerGoals).toBe(0)
    serve(p)
    score(p, 2, 0)
    expect(p.points).toBe(goalPoints({ difficulty: 'easy', streak: 1 }) + goalPoints({ difficulty: 'easy', streak: 2 }))
    expect([p.streak, p.bestStreak]).toEqual([2, 2])
    p.scoreOpponent()
    expect(p.streak).toBe(0)
    expect(p.bestStreak).toBe(2)
    expect(p.milestones.goal).toBe(true)
  })

  it('practice ends on reaching the goals, saves the record and reports it once', () => {
    const reported: GameResult[] = []
    const p = inPractice({ onFinish: (r) => reported.push(r) })
    p.setGoalTarget(3)
    p.startGame()
    serve(p)
    score(p, 3, 0)
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('won')
    expect(p.isRecord).toBe(true)
    expect(getBestPoints('practice')).toBe(p.points)
    p.scorePlayer()
    // Won without conceding: the first time it brings the feat (`feats.ts`).
    expect(reported).toEqual([{ mode: 'practice', points: p.points, challenge: false, feats: ['GH_SHUTOUT'] }])
    // The next one with fewer points is not a record.
    p.startGame()
    serve(p)
    score(p, 0, 3)
    expect(p.outcome).toBe('lost')
    expect(p.isRecord).toBe(false)
    expect(reported).toHaveLength(2)
  })

  it('endless practice is ended by whoever plays, and its record is the best streak', () => {
    const p = inPractice()
    p.setEndless(true)
    p.startGame()
    serve(p)
    score(p, 4, 1)
    expect(p.gameState).toBe('playing')
    p.endRun()
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('won')
    expect(getBestEndlessStreak()).toBe(4)
    expect(p.isRecord).toBe(true)
  })

  it('in the levels, winning gives stars and unlocks the next one; losing unlocks nothing', () => {
    const p = inPractice()
    p.setGameMode('levels')
    p.startGame()
    serve(p)
    score(p, p.activeGoalTarget, 0)
    expect(p.levelResult).toEqual({ stars: 3, passed: true, unlocked: 2 })
    expect(getUnlockedLevel()).toBe(2)
    expect(getStarsList().split(',')[0]).toBe('3')
    p.resetGame()
    expect(p.activeLevel).toBe(2)
    p.startGame()
    serve(p)
    score(p, 0, p.activeGoalTarget)
    expect(p.levelResult).toEqual({ stars: 0, passed: false, unlocked: null })
    expect(getUnlockedLevel()).toBe(2)
  })

  it('in the challenge, winning the round moves to the next with a new table, and losing ends it', () => {
    const p = inPractice()
    p.setGameMode('challenge')
    p.startGame()
    serve(p)
    const table = p.runId
    score(p, 0, 1)
    score(p, p.activeGoalTarget, 0)
    expect(p.gameState).toBe('countdown')
    expect(p.round).toBe(2)
    expect(p.runId).toBe(table + 1)
    expect([p.playerGoals, p.opponentGoals, p.totalPlayerGoals, p.totalOpponentGoals]).toEqual([0, 0, 3, 1])
    serve(p)
    score(p, 0, p.activeGoalTarget)
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('lost')
    expect(getBestPoints('challenge')).toBe(p.points)
  })

  it('the challenge of the hall goes straight into playing, with its seed, and says it was the challenge', () => {
    const reported: GameResult[] = []
    const p = new Match({ challenge: { seed: 1234 }, onFinish: (r) => reported.push(r) })
    expect([p.gameMode, p.gameState, p.inChallenge]).toEqual(['challenge', 'countdown', true])
    expect(p.seed).toBe(tableSeed(1234, 1, 1))
    expect(p.seed).not.toBe(new Match().seed)
    serve(p)
    score(p, 0, p.activeGoalTarget)
    expect(reported).toEqual([{ mode: 'challenge', points: 0, challenge: true }])
    // Another match from the end is no longer the challenge.
    p.startGame()
    expect(p.inChallenge).toBe(false)
  })

  it('going back to the menu saves nothing and leaves everything at zero', () => {
    const p = inPractice()
    p.startGame()
    serve(p)
    score(p, 2, 0)
    p.resetGame()
    expect(p.gameState).toBe('menu')
    expect([p.playerGoals, p.points, p.streak]).toEqual([0, 0, 0])
    expect(getBestPoints('practice')).toBe(0)
  })

  it('the duel: the first plays, then the second, against the same machine, and whoever gets the bigger margin wins', () => {
    const notices: GameResult[] = []
    const p = inPractice({ onFinish: (r) => notices.push(r) })
    expect(p.duelView).toBeNull()
    p.setGameMode('duel')
    p.setDifficulty('impossible')
    p.startGame()
    expect(p.duelView?.player).toBe(0)
    // What was chosen in practice does not count: the duel is always played the same way.
    expect([p.activeDifficulty, p.activeGoalTarget]).toEqual([DUEL_SETUP.difficulty, DUEL_SETUP.goalTarget])
    const seed = p.seed
    serve(p)
    score(p, DUEL_SETUP.goalTarget, 2)
    expect(p.gameState).toBe('finished')
    expect(p.duelView).toMatchObject({ player: 0, next: 1, over: false })

    // The handover: the second player's, with the same seed and on another table.
    const table = p.runId
    p.startGame()
    expect(p.duelView?.player).toBe(1)
    expect(p.seed).toBe(seed)
    expect(p.runId).toBe(table + 1)
    serve(p)
    score(p, 3, DUEL_SETUP.goalTarget)
    expect(p.duelView).toMatchObject({ over: true, winner: 0, next: null })
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    // No record and no notice to the hall: the goals belong to two people.
    expect([p.isRecord, p.bestPoints, getBestPoints('duel'), notices.length]).toEqual([false, 0, 0, 0])

    // Playing again after a closed duel is a new duel, with another seed; going back to the menu leaves it too.
    p.startGame()
    expect(p.duelView?.player).toBe(0)
    expect(p.seed).not.toBe(seed)
    serve(p)
    score(p, 0, DUEL_SETUP.goalTarget)
    p.resetGame()
    expect(p.duelSoFar.matches).toEqual([null, null])
  })

  it('the duel with the same margin is a tie, and is recorded as a tie', () => {
    const p = inPractice()
    p.setGameMode('duel')
    p.startGame()
    serve(p)
    score(p, DUEL_SETUP.goalTarget, 4)
    p.startGame()
    serve(p)
    score(p, DUEL_SETUP.goalTarget, 4)
    expect(p.duelView).toMatchObject({ over: true, winner: null })
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('the feats go in the JSON passed to the hall (`report_result`), once in a lifetime', () => {
    const jsons: string[] = []
    // The same thing `reportToHall` does in `main.ts` with the result.
    const p = inPractice({ onFinish: (r) => jsons.push(JSON.stringify(r)) })
    p.setGoalTarget(3)
    p.startGame()
    serve(p)
    p.scoreOpponent()
    p.recordFeat('GH_OWN_GOAL')
    score(p, 3, 0)
    // With the match decided nothing is recorded any more.
    p.recordFeat('GH_LONG_SHOT')
    expect(JSON.parse(jsons[0] ?? '{}')).toEqual({ mode: 'practice', points: p.points, challenge: false, feats: ['GH_OWN_GOAL'] })
    p.startGame()
    serve(p)
    p.recordFeat('GH_OWN_GOAL')
    score(p, 3, 0)
    expect(JSON.parse(jsons[1] ?? '{}').feats).toEqual(['GH_SHUTOUT'])
    p.startGame()
    serve(p)
    score(p, 3, 0)
    expect(JSON.parse(jsons[2] ?? '{}')).not.toHaveProperty('feats')
  })

  it('in the challenge, the round won without conceding is reported on losing it', () => {
    const reported: GameResult[] = []
    const p = new Match({ challenge: { seed: 7 }, onFinish: (r) => reported.push(r) })
    serve(p)
    for (let i = 0; i < 20 && p.challengeRoundNumber === 1; i++) p.scorePlayer()
    serve(p)
    for (let i = 0; i < 40 && p.gameState !== 'finished'; i++) p.scoreOpponent()
    expect(reported).toHaveLength(1)
    expect(reported[0]?.feats).toEqual(['GH_SHUTOUT'])
  })
})

describe('the goal sign, as on the web', () => {
  beforeEach(() => gameStorage()?.clear())

  const GOAL = {
    medals: { bronze: 150, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: null,
    mode: 'challenge',
  } as const

  it('in the menu there is no sign at all: it is hung on playing', () => {
    const p = new Match({ goal: GOAL })
    expect(p.goal).toBe(GOAL)
    expect(p.sign('en')).toBeNull()
    expect(p.medal).toBeNull()
    expect(p.omitted).toEqual({ points: false, round: false })
  })

  it('with the goal: the mission and the thresholds in the countdown, and afterwards the one missing and what is left', () => {
    const p = new Match({ goal: GOAL })
    p.startGame()
    expect(p.sign('en')).toMatchObject({ title: 'Win games until you lose one', detail: 'Bronze 150 · Silver 8,000 · Gold 20,000' })
    expect(p.sign('es')?.title).toBe('Gana partidos hasta perder uno')
    expect(p.omitted).toEqual({ points: true, round: true })
    serve(p)
    expect(p.sign('en')).toMatchObject({ title: 'Bronze at 150 · you have 0', detail: 'Round 1 · to 3 goals · goal +100' })
    score(p, 1, 0)
    expect(p.sign('es')).toMatchObject({ title: 'Bronce a 150 · llevas 100', detail: 'Ronda 1 · a 3 goles · gol +120' })
    expect(p.medal).toBeNull()
  })

  it('on crossing a threshold the medal rises, in the first round conceding does not subtract, and at the end it says what was missing', () => {
    const p = new Match({ goal: GOAL })
    p.startGame()
    serve(p)
    score(p, 2, 0)
    expect(p.points).toBe(220)
    expect(p.medal).toBe('bronze')
    expect(p.sign('en')?.title).toBe('Silver at 8,000 · you have 220')
    score(p, 0, 3)
    expect(p.gameState).toBe('finished')
    expect(p.medal).toBe('bronze')
    expect(p.sign('en')).toMatchObject({ title: 'Bronze · 220 points in the challenge', detail: '7,780 short of silver' })
    expect(p.omitted).toEqual({ points: true, round: false })
    // Play again —the highlighted button of the end— goes back to the mission, without going through the menu.
    p.startGame()
    expect(p.sign('en')?.title).toBe('Win games until you lose one')
  })

  it('two matches in a row: the second compares with the record the first made, not with the one at mount', () => {
    // The `goal` metadata is read on mounting and does not change until going back to the hall: the record
    // rises with what the match has already reported to it (the kit's `goalWithPlayed`), when the next one starts.
    const p = new Match({ goal: { ...GOAL, record: 100 } })
    p.startGame()
    serve(p)
    score(p, 2, 0)
    score(p, 0, 3)
    expect([p.gameState, p.points]).toEqual(['finished', 220])
    // The end of the first, against the mark at the start.
    expect(p.goal?.record).toBe(100)
    p.startGame()
    expect(p.goal?.record).toBe(220)
    serve(p)
    score(p, 1, 3)
    expect(p.sign('en')?.title).toBe('No medal · 100 points in the challenge')
    // What belongs to another mode does not raise the challenge's record.
    p.resetGame()
    p.setGameMode('practice')
    p.startGame()
    expect(p.goal?.record).toBe(220)
  })

  it('losing the first round 1–3 with one goal scored does not leave zero; from the second on, conceding subtracts', () => {
    const p = new Match({ goal: GOAL })
    p.startGame()
    serve(p)
    score(p, 1, 3)
    expect([p.gameState, p.points]).toEqual(['finished', 100])
    p.startGame()
    serve(p)
    score(p, 3, 0)
    serve(p)
    const before = p.points
    p.scoreOpponent()
    expect([p.round, p.points]).toEqual([2, before - 60])
  })

  it('while learning the challenge, the machine does not count; on closing the tutorial it starts from scratch and gives notice', () => {
    const p = new Match({ goal: GOAL })
    p.startGame()
    serve(p)
    p.learning = true
    score(p, 1, 5)
    expect([p.playerGoals, p.opponentGoals, p.gameState]).toEqual([1, 0, 'playing'])
    const table = p.runId
    p.learning = false
    p.finishLesson()
    expect([p.playerGoals, p.points, p.runId, p.gameState]).toEqual([0, 0, table + 1, 'countdown'])
    expect(p.sign('es')?.title).toBe('Ahora cuenta para medalla')
    for (let i = 0; i < 160; i++) p.tick(1 / 60)
    expect(p.sign('es')?.title).not.toBe('Ahora cuenta para medalla')
  })

  it('outside the challenge, learning changes nothing and closing the tutorial does not start again', () => {
    const p = inPractice()
    p.startGame()
    serve(p)
    p.learning = true
    p.scoreOpponent()
    const table = p.runId
    p.finishLesson()
    expect([p.opponentGoals, p.runId]).toEqual([1, table])
  })

  it('the countdown of the second round is no longer the mission', () => {
    const p = new Match({ goal: GOAL })
    p.startGame()
    serve(p)
    score(p, 3, 0)
    expect([p.round, p.gameState]).toEqual([2, 'countdown'])
    expect(p.sign('en')?.detail).toBe(`Round 2 · to 5 goals · goal +${goalPoints({ difficulty: 'easy', streak: 4 })}`)
  })

  it('in practice, with a hall, it says quietly that it does not count; with the game on its own, nothing', () => {
    const withHall = inPractice({ goal: GOAL })
    withHall.startGame()
    expect(withHall.sign('es')).toMatchObject({ title: 'Práctica · no cuenta para medalla', subdued: true })
    expect(withHall.omitted).toEqual({ points: false, round: false })
    const standalone = inPractice()
    standalone.startGame()
    expect(standalone.sign('en')).toBeNull()
  })

  it('with the game on its own, in the challenge: the mission and the record stored here', () => {
    gameStorage()?.setItem('glide-hockey:best-points:challenge', '3100')
    const p = new Match()
    p.startGame()
    expect(p.sign('en')).toMatchObject({ title: 'Win games until you lose one', detail: 'Your record 3,100' })
  })
})
