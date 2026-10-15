/**
 * The session of Glide Hockey in Godot: what on the web is `lib/gameStore.ts`, without React.
 *
 * The web's store is a hook (`useState`, `useEffect`, `useSyncExternalStore`) and the engine has no
 * React, so here the same machine is written as a class that the scene advances every frame. **The
 * rules are not rewritten**: the score and the end come from `gameMode.ts` (`runOutcome`), the
 * points from `scoring.ts`, the ladder of the challenge from `challenge.ts`, the levels and their
 * stars from `levels.ts`, the turn-based duel from `duel.ts`, what is stored from `highScore.ts`,
 * `progress.ts` and `duelTally.ts`, and the machine's seed from `opponent.ts` (`tableSeed`). What
 * is left here is what on the web the `useState`s do: what has been chosen, which phase it is in
 * and the score of the match in progress.
 *
 * As on the web, **almost everything is derived**: the phase comes from whether there is a match,
 * from the countdown and from the score, and the end from the score and the mode. What is not
 * derived is what the web keeps in state, with the same names where possible.
 *
 * It does not touch the engine (neither `godot` nor nodes), so it is tested whole in
 * `match.engine.test.ts` without mounting the scene.
 */
import { goalWithPlayed } from '@kit/lib/gameBase'

import type { Lang } from '@/lib/settings'
import { NOW_IT_COUNTS_MS, withNowItCountsNotice, scoreboardOmits, signRun } from '@/lib/scoreboardSign'
import { challengeRound } from '@/lib/challenge'
import { DUEL_SETUP, controllerHolder, duelOver, duelTurn, duelWinner, newDuel, recordMatch, type Duel, type Player } from '@/lib/duel'
import { saveDuelResult } from '@/lib/duelTally'
import { COUNTDOWN_SECONDS, DEFAULT_GOALS, MAX_GOALS, MIN_GOALS, type Difficulty } from '@/lib/gameConfig'
import { ENDLESS, isEndless, runOutcome, type GameMode, type RunOutcome } from '@/lib/gameMode'
import { getBestEndlessStreak, getBestPoints, saveBestEndlessStreak, saveBestPoints } from '@/lib/highScore'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from '@/lib/levels'
import { goalSign, medalToCelebrate, type Medal, type Goal, type Run as GoalRun, type GoalSignView } from '@/lib/goal'
import { tableSeed } from '@/lib/opponent'
import { getStarsList, getUnlockedLevel, saveLevelResult } from '@/lib/progress'
import type { Scorer } from '@/lib/puckPhysics'
import { concededPenalty, scoreConceded, scoreGoal } from '@/lib/scoring'
import { withFeats, earnFeats, matchFeats, type Feat } from '@/lib/feats'
import type { GameResult, Challenge } from '@/lib/seed'
import { softTranslator } from '@/lib/textos'
import { NO_MILESTONES, recordMilestone, type TutorialMilestones, type TutorialStepKey } from '@/lib/tutorial'

/** The web's phases (`GameState`), plus the question of leaving, which there is `prompt`. */
export type MatchPhase = 'menu' | 'countdown' | 'playing' | 'finished'

/** The mode the hall's `challenge` is played with: that of the cabinet's record (`CHALLENGE_MODE`). */
export const CHALLENGE_MODE: GameMode = 'challenge'

/** How a level ended: what the end shows (the web's `levelResult`). */
export interface LevelResult {
  stars: Stars
  passed: boolean
  /** The level this match unlocks, if it unlocks any. */
  unlocked: number | null
}

/** Clamps the goals of a match to the allowed range (`clampGoalTarget`). */
export function clampGoals(goals: number): number {
  if (Number.isNaN(goals)) return DEFAULT_GOALS
  return Math.min(MAX_GOALS, Math.max(MIN_GOALS, Math.round(goals)))
}

/** How the duel is going, seen from the screen (the web's `DuelView`). */
export interface DuelView {
  /** Whose match is the one on screen, or the one about to start. */
  player: Player
  /** The two matches, counting the one that has just ended. */
  matches: Duel['matches']
  /** Whose turn it is next, or `null` if both have already played. */
  next: Player | null
  over: boolean
  /** Who has won, or `null` if it has not ended or it is a tie. */
  winner: Player | null
}

export interface MatchOptions {
  /** Play this challenge: it goes straight into a match of the challenge with its seed. */
  challenge?: Challenge | null
  /** Called once when each match ends with a score (not when it is left halfway). */
  onFinish?: (result: GameResult) => void
  /**
   * The game's medal thresholds and the best mark of whoever plays, for the sign above the
   * scoreboard (`goal.ts`). Without it, the sign says the mission and the record stored here.
   */
  goal?: Goal | null
}

export class Match {
  // What is chosen in the menu.
  goalTarget = DEFAULT_GOALS
  difficulty: Difficulty = 'easy'
  /**
   * The menu **always** opens on the challenge, with a hall or without one, and does not remember
   * the last mode: it is the one of the record and of the medals, so playing without touching
   * anything is playing what counts. Practice is one tap away.
   */
  gameMode: GameMode = CHALLENGE_MODE
  endless = false
  /** Level chosen in Levels, or `null` = the highest unlocked. */
  level: number | null = null

  // The match in progress.
  running = false
  /** Seconds left of the countdown, with decimals: it is shown rounded up. */
  countdown = 0
  prompt: 'quit' | null = null
  /** Whether the mallet is in the hand (with a headset): the countdown waits for it in its last second. */
  malletHeld = false
  /** Whether it is played with a headset: without one there is no mallet to wait for. */
  immersive = false
  runId = 0
  inChallenge = false
  playerGoals = 0
  opponentGoals = 0
  previousPlayerGoals = 0
  previousOpponentGoals = 0
  lastScorer: Scorer | null = null
  points = 0
  streak = 0
  bestStreak = 0
  challengeRoundNumber = 1
  /** What whoever plays has already done, for the tutorial: it accumulates and is not undone. */
  milestones: TutorialMilestones = NO_MILESTONES
  /**
   * Whether the tutorial is being shown right now; the interface says so. In the challenge, while
   * learning, the machine's goals do not count (the web's `learning`).
   */
  learning = false
  /** Seconds left for the notice that it now counts (`withNowItCountsNotice`). */
  private nowItCountsLeft = 0
  /** The matches of the duel already closed and its seed; the one just ended is recorded when the next one starts. */
  duelSoFar: Duel = newDuel(0)
  private endedByPlayer = false
  private recordToBeat = 0
  private unlockedAtStart = 1
  private levelAtStart = 1
  private readonly challengeSeed: number | null
  /**
   * The goal of the match in progress, or `null` with the game opened on its own: the one the hall
   * passed with the record raised by what has already been reported to it (`goalWithPlayed`). It is
   * read again when each match starts —the `goal` metadata does not change until going back to the
   * hall— and not during it: the end compares with the mark there was at the start, like the web
   * (`hallRecordAtStart`).
   */
  goal: Goal | null
  /** What the hall passed when mounting the game. */
  private readonly hallGoal: Goal | null
  /** What has been reported to the hall since it was mounted: the goal's record rises from there. */
  private readonly reported: GameResult[] = []
  private readonly onFinish: ((result: GameResult) => void) | undefined
  /** The feats of this match (in the challenge, of all its rounds): they are earned when it closes. */
  private feats = new Set<Feat>()
  /** The match (its `runId`) whose end was already saved and reported to the hall. */
  private closedRun = 0
  /** What the end left: whether it was a record and how the level ended. Worked out once, on closing. */
  private _isRecord = false
  private _levelResult: LevelResult | null = null

  constructor({ challenge = null, onFinish, goal = null }: MatchOptions = {}) {
    this.hallGoal = goal
    this.goal = goal
    this.challengeSeed = challenge?.seed ?? null
    this.onFinish = onFinish
    if (challenge != null) {
      // With the hall's challenge it goes straight into playing, as on the web.
      this.running = true
      this.countdown = COUNTDOWN_SECONDS
      this.runId = 1
      this.inChallenge = true
      this.recordToBeat = getBestPoints(CHALLENGE_MODE)
    }
  }

  get challenge(): boolean {
    return this.gameMode === 'challenge'
  }

  get levels(): boolean {
    return this.gameMode === 'levels'
  }

  get duel(): boolean {
    return this.gameMode === 'duel'
  }

  /** Round of the challenge, or `null` in a mode that has none. */
  get round(): number | null {
    return this.challenge ? this.challengeRoundNumber : null
  }

  /** Which lap of the ladder the challenge is on, or `null` outside it. */
  get lap(): number | null {
    return this.challenge ? challengeRound(this.challengeRoundNumber).lap : null
  }

  get lapMultiplier(): number {
    return this.challenge ? challengeRound(this.challengeRoundNumber).multiplier : 1
  }

  get unlockedLevel(): number {
    return getUnlockedLevel()
  }

  /** The stars of each level, from the first to the last. */
  get levelStars(): Stars[] {
    return getStarsList().split(',').map((s) => Number(s) as Stars)
  }

  /** The level being played: the chosen one, or the highest unlocked; in a match, the one at the start. */
  get activeLevel(): number {
    if (this.running) return this.levelAtStart
    return this.selectedLevel
  }

  private get selectedLevel(): number {
    const unlocked = getUnlockedLevel()
    return clampLevel(Math.min(this.level ?? unlocked, unlocked))
  }

  get activeDifficulty(): Difficulty {
    if (this.challenge) return challengeRound(this.challengeRoundNumber).difficulty
    if (this.levels) return levelSpec(this.activeLevel).difficulty
    if (this.duel) return DUEL_SETUP.difficulty
    return this.difficulty
  }

  get activeGoalTarget(): number {
    if (this.challenge) return challengeRound(this.challengeRoundNumber).goalTarget
    if (this.levels) return levelSpec(this.activeLevel).goalTarget
    if (this.duel) return DUEL_SETUP.goalTarget
    return this.endless ? ENDLESS : this.goalTarget
  }

  get totalPlayerGoals(): number {
    return this.previousPlayerGoals + this.playerGoals
  }

  get totalOpponentGoals(): number {
    return this.previousOpponentGoals + this.opponentGoals
  }

  /** Which seed the machine picks its shots with on the table of now: in the duel, the same for both. */
  get seed(): number {
    if (this.duel) return this.duelSoFar.seed
    return tableSeed(this.inChallenge ? this.challengeSeed : null, this.runId, this.challengeRoundNumber)
  }

  /** How the match in progress ends by the score, without looking at the mode. */
  private get matchOutcome(): RunOutcome | null {
    return this.running ? runOutcome({ playerGoals: this.playerGoals, opponentGoals: this.opponentGoals, goalTarget: this.activeGoalTarget }) : null
  }

  /** How it ended, or `null` while it goes on: in the challenge, winning ends nothing, it moves to the next round. */
  get outcome(): RunOutcome | null {
    const match = this.matchOutcome
    if (match === 'won' && this.challenge) return null
    if (this.running && this.endedByPlayer && isEndless(this.activeGoalTarget)) {
      return this.playerGoals >= this.opponentGoals ? 'won' : 'lost'
    }
    return match
  }

  get gameState(): MatchPhase {
    if (!this.running) return 'menu'
    if (this.countdown > 0) return 'countdown'
    if (this.outcome != null) return 'finished'
    return 'playing'
  }

  /** The countdown is stopped waiting for the mallet to be picked up (`waitingForMallet`). */
  get waitingForMallet(): boolean {
    return this.immersive && !this.malletHeld && this.running && this.countdown > 0 && this.countdown <= 1
  }

  /** The digit of the countdown: 3, 2, 1. */
  get count(): number {
    return Math.ceil(this.countdown)
  }

  /** The match just ended has beaten the mode's record (or the endless streak). */
  get isRecord(): boolean {
    return this.gameState === 'finished' && this._isRecord
  }

  get levelResult(): LevelResult | null {
    return this.gameState === 'finished' ? this._levelResult : null
  }

  /** The record of the chosen mode that the menu shows (the web's `bestPoints`). */
  get bestPoints(): number {
    if (this.gameMode === 'practice' && this.endless) return getBestEndlessStreak()
    return this.levels || this.duel ? 0 : getBestPoints(this.gameMode)
  }

  /** The match as it is told to the goal sign (the web's `signRun`). */
  private forSign(lang: Lang): GoalRun | null {
    return signRun(
      {
        goal: this.goal,
        gameMode: this.gameMode,
        gameState: this.gameState,
        round: this.challengeRoundNumber,
        goals: this.totalPlayerGoals + this.totalOpponentGoals,
        points: this.points,
        streak: this.streak,
        record: this.recordToBeat,
      },
      softTranslator(lang),
    )
  }

  /**
   * What the sign above the scoreboard says, in that language, or `null` if there is nothing to
   * hang: in the menu, and outside the challenge with the game opened on its own.
   */
  sign(lang: Lang): GoalSignView | null {
    const run = this.forSign(lang)
    if (run == null) return null
    const t = softTranslator(lang)
    return withNowItCountsNotice(goalSign(run, t), this.gameMode, this.nowItCountsLeft > 0, t)
  }

  /** The medal that already belongs to whoever plays in this match: when it rises, the threshold is celebrated. */
  get medal(): Medal | null {
    const run = this.forSign('en')
    return run == null ? null : medalToCelebrate(run)
  }

  /** What the back scoreboard leaves out because the sign already says it (`scoreboardOmits`). */
  get omitted(): { points: boolean; round: boolean } {
    return scoreboardOmits(this.forSign('en'))
  }

  /** The duel with the match just ended already counted (the web's `duelNow`). */
  private get duelNow(): Duel {
    return this.duel && this.gameState === 'finished'
      ? recordMatch(this.duelSoFar, { scored: this.playerGoals, conceded: this.opponentGoals })
      : this.duelSoFar
  }

  /** How the duel is going, or `null` outside that mode. */
  get duelView(): DuelView | null {
    if (!this.duel) return null
    const now = this.duelNow
    return {
      player: controllerHolder(this.duelSoFar),
      matches: now.matches,
      next: duelTurn(now),
      over: duelOver(now),
      winner: duelWinner(now),
    }
  }

  // What is chosen between matches: with one running nothing changes, as on the web.

  setGoalTarget(goals: number): void {
    if (!this.running) this.goalTarget = clampGoals(goals)
  }

  setEndless(endless: boolean): void {
    if (!this.running) this.endless = endless
  }

  setGameMode(mode: GameMode): void {
    if (!this.running) this.gameMode = mode
  }

  setDifficulty(difficulty: Difficulty): void {
    if (!this.running) this.difficulty = difficulty
  }

  setLevel(level: number): void {
    if (!this.running) this.level = clampLevel(Math.min(level, getUnlockedLevel()))
  }

  private clearRun(): void {
    this.playerGoals = 0
    this.opponentGoals = 0
    this.previousPlayerGoals = 0
    this.previousOpponentGoals = 0
    this.lastScorer = null
    this.points = 0
    this.streak = 0
    this.bestStreak = 0
    this.challengeRoundNumber = 1
    this._isRecord = false
    this._levelResult = null
    this.feats = new Set()
    this.nowItCountsLeft = 0
  }

  /** Starts a match with what was chosen: the play button, and the play-again one. */
  startGame(): void {
    this.inChallenge = false
    this.prompt = null
    // In the duel, starting after the first player's match is the second's turn: the one that has
    // just ended is recorded and the seed carries on. With both played, or from the menu, it is a
    // new duel with the seed of this match.
    if (this.duel) {
      const now = this.duelNow
      this.duelSoFar = this.gameState === 'finished' && !duelOver(now) ? now : newDuel(this.runId + 1)
    }
    this.clearRun()
    this.endedByPlayer = false
    this.goal = goalWithPlayed(this.hallGoal, this.reported)
    this.recordToBeat = this.gameMode === 'practice' && this.endless ? getBestEndlessStreak() : getBestPoints(this.gameMode)
    this.unlockedAtStart = getUnlockedLevel()
    this.levelAtStart = this.selectedLevel
    this.runId++
    this.countdown = COUNTDOWN_SECONDS
    this.running = true
  }

  /** Goes back to the menu without saving anything: leaving the match, or going back from the end. */
  resetGame(): void {
    this.inChallenge = false
    this.prompt = null
    // Going back to the menu leaves the duel: the other's turn no longer has anything to compare with.
    this.duelSoFar = newDuel(0)
    this.clearRun()
    this.countdown = 0
    this.endedByPlayer = false
    this.running = false
  }

  /** Ends the endless match at will: it is its only way out with a summary. */
  endRun(): void {
    this.endedByPlayer = true
    this.onChange()
  }

  recordMilestone(milestone: TutorialStepKey): void {
    this.milestones = recordMilestone(this.milestones, milestone)
  }

  askToQuit(): void {
    this.prompt = 'quit'
  }

  keepPlaying(): void {
    this.prompt = null
  }

  private get inPlay(): boolean {
    return this.gameState === 'playing' && this.matchOutcome === null
  }

  /** Goal by the player: it adds points and lengthens the streak. With the match decided it does not count. */
  scorePlayer(): void {
    if (!this.inPlay) return
    this.recordMilestone('goal')
    this.playerGoals++
    this.lastScorer = 'player'
    this.streak++
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.points = scoreGoal(this.points, { difficulty: this.activeDifficulty, streak: this.streak, lap: this.lapMultiplier })
    this.onChange()
  }

  /**
   * Goal by the machine: it takes points away and cuts the streak. While learning in the challenge
   * it does not count, and in its first round it subtracts nothing (`concededPenalty`).
   */
  scoreOpponent(): void {
    if (!this.inPlay || (this.learning && this.challenge)) return
    this.opponentGoals++
    this.lastScorer = 'opponent'
    this.streak = 0
    this.points = scoreConceded(this.points, concededPenalty(this.round))
    this.onChange()
  }

  /**
   * The tutorial has been closed with the match running (the web's `finishLesson`): in the challenge,
   * the match starts again from scratch, with its countdown, and the sign warns that it now counts.
   */
  finishLesson(): void {
    if (!this.challenge || !this.running) return
    this.clearRun()
    this.endedByPlayer = false
    this.runId++
    this.countdown = COUNTDOWN_SECONDS
    this.nowItCountsLeft = NOW_IT_COUNTS_MS / 1000
  }

  /**
   * A feat of the table (`FrameResult.feats`), recorded on the match. It goes **before** the goal
   * that brings it: the last goal closes the match on the spot and would leave it out. With the
   * match decided it does not count.
   */
  recordFeat(feat: Feat): void {
    if (this.inPlay) this.feats.add(feat)
  }

  /**
   * A frame of clock: the countdown goes down, except with the question in front or waiting for the
   * mallet in the last second, which is what on the web the one-second `setTimeout` does.
   */
  tick(delta: number): void {
    this.nowItCountsLeft = Math.max(0, this.nowItCountsLeft - Math.max(0, delta))
    if (!this.running || this.countdown <= 0 || this.prompt !== null) return
    if (this.waitingForMallet) return
    // With the mallet not picked up, the countdown stays in the last second instead of passing it.
    const floor = this.immersive && !this.malletHeld ? Math.min(this.countdown, 1) : 0
    this.countdown = Math.max(floor, this.countdown - Math.max(0, delta))
  }

  /**
   * What on the web the effects do when the score changes: moving to the next round in the challenge
   * on winning one, and on ending, saving and reporting it to the hall only once per match.
   */
  private onChange(): void {
    if (this.running && this.challenge && this.matchOutcome === 'won') {
      for (const feat of matchFeats({ won: true, conceded: this.opponentGoals, endless: false })) this.feats.add(feat)
      this.previousPlayerGoals += this.playerGoals
      this.previousOpponentGoals += this.opponentGoals
      this.playerGoals = 0
      this.opponentGoals = 0
      this.lastScorer = null
      this.challengeRoundNumber++
      this.countdown = COUNTDOWN_SECONDS
      this.runId++
      return
    }
    if (this.gameState !== 'finished' || this.closedRun === this.runId) return
    this.closedRun = this.runId
    // In the duel there is no record and the hall is not told: the goals belong to two people. What
    // is recorded, with both played, is who won in the pair's tally.
    if (this.duel) {
      const now = this.duelNow
      if (duelOver(now)) saveDuelResult(duelWinner(now))
      return
    }
    const endlessRun = isEndless(this.activeGoalTarget)
    if (this.levels) {
      const stars = levelStars(this.outcome === 'won', this.playerGoals, this.opponentGoals)
      const passed = levelPassed(stars)
      const level = this.activeLevel
      const unlocks = passed && level + 1 > this.unlockedAtStart && level < LEVEL_COUNT
      this._levelResult = { stars, passed, unlocked: unlocks ? level + 1 : null }
      saveLevelResult(level, stars)
    } else if (endlessRun) {
      saveBestEndlessStreak(this.bestStreak)
      this._isRecord = this.bestStreak > this.recordToBeat && getBestEndlessStreak() === this.bestStreak
    } else {
      saveBestPoints(this.gameMode, this.points)
      this._isRecord = this.points > this.recordToBeat && getBestPoints(this.gameMode) === this.points
    }
    for (const feat of matchFeats({ won: this.outcome === 'won', conceded: this.opponentGoals, endless: endlessRun })) {
      this.feats.add(feat)
    }
    const result = withFeats({ mode: this.gameMode, points: this.points, challenge: this.inChallenge }, earnFeats(this.feats))
    this.reported.push(result)
    this.onFinish?.(result)
  }
}
