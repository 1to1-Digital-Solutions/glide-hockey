'use client'

import { NO_MILESTONES, TUTORIAL_STEPS, recordMilestone, type TutorialMilestones, type TutorialStepKey } from './tutorial'
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
import { volumeFactor, type Scenery } from './settings'
import { setScenery as setArcadeScenery, useLang, useScenery, useVolumes } from './settingsClient'
import { NOW_IT_COUNTS_MS, withNowItCountsNotice, scoreboardOmits, signRun } from './scoreboardSign'
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
import { withFeats, earnFeats, matchFeats, type Feat } from './feats'
import { goalSign, medalToCelebrate, type Medal, type Goal, type GoalSignView } from './goal'
import { tableSeed } from './opponent'
import { exposeTestRun } from './testRun'
import type { GameResult, Challenge } from './seed'
import { forgetOwnScenery } from './scenery'
import { gameStorage } from './storage'
import { type Scorer } from './puckPhysics'
import { concededPenalty, scoreConceded, scoreGoal } from './scoring'
import { softTranslator } from './textos'

/**
 * The state of an air hockey match and the three things chosen before
 * starting: the mode, the machine's level and how many goals it is played to.
 *
 * Almost everything is **derived** instead of stored. The phases of the match
 * come from the countdown and the scoreboard, and the ending from the
 * scoreboard and the mode: that way there are no parallel counters to keep in
 * step nor effects that change phase causing cascading renders. The only things
 * really stored are whether a match is under way, the scoreboard and which
 * round the challenge is on.
 *
 * The scoring and the challenge ladder live in their modules (`scoring.ts`,
 * `challenge.ts`), which are pure functions: here they are only called.
 */

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

/** How the duel is going, as seen from the screen. */
export interface DuelView {
  /** Whose match is on screen, or the one about to start. */
  player: Player
  /** The two matches, counting the one that has just ended. */
  matches: Duel['matches']
  /** Whose turn is next, or `null` if both have already played. */
  next: Player | null
  over: boolean
  /** Who has won, or `null` if it is not over or it is a tie. */
  winner: Player | null
}

/**
 * The mode played with the hall's `challenge`: the one of the cabinet's record
 * (`glide-hockey:best-points:challenge`).
 *
 * The challenge has no settings that change the score: the machine's level and
 * the goals of each round are set by the ladder (`challenge.ts`), so there is
 * no difficulty nor goals to fix.
 */
const CHALLENGE_MODE: GameMode = 'challenge'

/** Every step of the tutorial, done: with them there is nothing left to teach (`tutorialStep`). */
const ALL_MILESTONES = Object.fromEntries(TUTORIAL_STEPS.map((step) => [step, true])) as TutorialMilestones

/**
 * What the hall passes to the store through the scene (see `GlideHockeyScene`).
 *
 * All optional: with nothing, the game starts at the menu and plays as on its own website.
 */
export interface HallOptions {
  /**
   * Play this challenge: it goes **straight** into a match of the challenge, with
   * the machine's shots drawn from the seed. It is read on mount; another
   * challenge is another mount.
   */
  challenge?: Challenge
  /**
   * Called once at the end of each match with a score (not when it is left halfway), with the
   * feats earned for the first time in it (`feats.ts`).
   */
  onFinish?: (result: GameResult) => void
  /**
   * The game's medal thresholds and the best of whoever is playing, for the sign above the
   * scoreboard (`goal.ts`). Without it —the game opened on its own— the sign states the mission
   * and the local record.
   */
  goal?: Goal
}

export interface GameStore {
  /** Goals a practice match is played to (3–15). */
  goalTarget: number
  /** Chosen level. In the challenge the round decides it and this is left alone. */
  difficulty: Difficulty
  /** Practice, levels, challenge or duel (see `gameMode.ts`). */
  gameMode: GameMode
  /** Endless practice: the match does not end on goals, the player ends it. */
  endless: boolean
  /** Level chosen in Levels, or `null` = the highest one unlocked. */
  level: number | null
  /** The level being played: the chosen one, or the highest one unlocked. */
  activeLevel: number
  /** Up to which level can be played, remembered between visits. */
  unlockedLevel: number
  /** Stars of each level, from the first to the last. */
  levelStars: readonly Stars[]
  /** How the level played ended, only with the match finished in Levels. */
  levelResult: { stars: Stars; passed: boolean; unlocked: number | null } | null

  /** The turn-based duel, or `null` outside that mode (see `duel.ts`). */
  duel: DuelView | null

  /** Round of the challenge, or `null` in a mode that has none. */
  round: number | null
  /**
   * Which lap of the challenge ladder it is on, or `null` outside the challenge.
   *
   * It is only different from 1 past round fifteen, and then it is what has to
   * be shown: it is the only way to see that what is being played is worth more
   * than the previous lap (see `challenge.ts`).
   */
  lap: number | null
  /** What the goals are multiplied by for the lap they fall in. */
  lapMultiplier: number
  /** Level being played at: the chosen one in practice, the round's in the challenge. */
  activeDifficulty: Difficulty
  /** Goals that decide the match in progress. */
  activeGoalTarget: number

  /** Scoreboard of the match in progress. */
  playerGoals: number
  opponentGoals: number
  /** Goals of the whole session. In the challenge, adding up rounds. */
  totalPlayerGoals: number
  totalOpponentGoals: number
  /** Who scored the last goal, which is who decides which way the serve goes. */
  lastScorer: Scorer | null

  /** Points accumulated (see `scoring.ts`). */
  points: number
  /** Goals in a row without conceding. */
  streak: number
  /** The best streak of the session, for the final summary. */
  bestStreak: number
  /** Best score of the chosen mode, stored between visits. */
  bestPoints: number
  /** The match that has just ended has beaten the previous record. */
  isRecord: boolean
  /** How it ended, or `null` while it is still alive. */
  outcome: RunOutcome | null

  /** What the hall passed, or `null` with the game opened on its own: the menus say which mode gives a medal. */
  goal: Goal | null
  /**
   * What the sign above the scoreboard says (`goal.ts`), or `null` if there is nothing to
   * hang: at the menu, and outside the challenge with the game opened on its own.
   */
  sign: GoalSignView | null
  /** The medal that already belongs to whoever is playing in this match: when it goes up, the threshold is celebrated. */
  medal: Medal | null
  /** What the back scoreboard omits because the sign already says it (`scoreboardOmits`). */
  omitted: { points: boolean; round: boolean }

  gameState: GameState

  /**
   * What whoever is playing has already done.
   *
   * It is written by the same places that already record what happens, and read by the tutorial:
   * each of its steps is passed **by really doing it**, so it needs neither to stop anyone's game
   * nor to listen to anything else. It accumulates: doing something is not undone.
   */
  milestones: TutorialMilestones
  recordMilestone: (milestone: TutorialStepKey) => void
  /** Seconds to the serve. It only makes sense in `countdown`. */
  countdown: number
  /**
   * Whether the mallet is in the hand right now. The table says so, frame by frame.
   *
   * **The countdown waits for it.** With the headset on, the serve came with the mallet still on
   * the table: the puck went out and there was nothing to stop it with. It stops at the last
   * second until it is picked up, which is what the tutorial is teaching right then.
   */
  malletHeld: boolean
  setMalletHeld: (held: boolean) => void
  /**
   * The countdown is stopped waiting for the mallet to be picked up.
   *
   * **It stops and that has to be said.** Without this, the 1 stayed stuck with no explanation and
   * from inside it looks as if the game has hung: «if the object to push the puck is not picked
   * up, the countdown stays stuck on 1 with no explanation». It is read by the countdown —which
   * writes what is missing— and by the mallet, which lights up so that it is clear which one it is.
   */
  waitingForMallet: boolean
  /**
   * Match identifier. It goes up when a new one starts, and in the challenge also
   * on moving to the next round: it is what remounts the table and returns the
   * puck to the centre.
   */
  runId: number
  /**
   * Which seed the machine picks its shots with on the table being played (`AimSeed.match`):
   * the match number, or in the challenge the one from its seed and its round (`tableSeed`). In
   * the duel, the duel's: the same for both (`Duel.seed`).
   */
  seed: number
  /**
   * What is being played now is the `challenge` the hall passed. It stops being so as soon as
   * another match is started or the player goes back to the menu.
   */
  inChallenge: boolean
  /** Whether an immersive session is open, that is, whether it is played with a headset. */
  immersive: boolean
  /** Whether the game is silent. It belongs to whoever is playing and is remembered between visits. */
  /**
   * Game in silence, because the effects are at zero in the hall's settings. It
   * is no longer a preference of this game: it is chosen once in xrcade and
   * applies to all twelve (see `settings.ts`). It is left derived because half
   * the scene asks «am I muted?» and not «what level are the effects at?».
   */
  muted: boolean
  /** Volume of the effects, from 0 to 1, just as the Web Audio API wants it. */
  sfxVolume: number
  /** Background music on: the ambience of the settings, above zero. */
  /** Volume of the ambience, from 0 to 1. */
  ambienceVolume: number
  /** What is painted around: the game's room or your own room. */
  scenery: Scenery

  setGoalTarget: (goals: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /** Chooses the mode. **Only from the menu** (see why in the implementation). */
  setGameMode: (mode: GameMode) => void
  setEndless: (endless: boolean) => void
  /** Chooses a level among the unlocked ones; what is not unlocked is clamped. */
  setLevel: (level: number) => void
  /** Ends the endless match at will: it is its only way out with a summary. */
  endRun: () => void
  setImmersive: (immersive: boolean) => void
  /** Whether the background music plays. Silence overrides it. */
  music: boolean
  /**
   * Changes what is painted around. It can be done mid-match and with the
   * headset on: it is what makes it possible to look at the room without leaving
   * the session, which is what this setting is about.
   */
  setScenery: (scenery: Scenery) => void

  /**
   * Whether the demonstration of the gesture is running right now. `XRTutorial` says so.
   *
   * **The countdown waits for it.** Starting while the demonstration explains the gesture is starting
   * without it: the serve came with the explanation half done. Outside the headset there is no demonstration and this stays at `false`.
   */
  tutorialRunning: boolean
  setTutorialRunning: (running: boolean) => void
  /**
   * Whether the tutorial is being shown right now. `XRTutorial` says so.
   *
   * **In the challenge, while learning nothing is lost**: the machine's goals do not count —neither
   * on the scoreboard nor in the points—, although they are heard and felt just the same. When the
   * tutorial closes the challenge starts from zero (`finishLesson`).
   */
  learning: boolean
  setLearning: (learning: boolean) => void
  /**
   * The tutorial has closed —through its steps, through «Siguiente» or through «Saltar»— with the
   * match under way. In the challenge, the match starts again from zero, with its countdown, and
   * the sign announces for a moment that it now counts for a medal. Outside the challenge it does nothing.
   */
  finishLesson: () => void
  /**
   * What is being asked right now, or `null` if nothing is being asked.
   *
   * Leaving the match halfway **loses what has been earned**, and the button gets pressed by
   * accident: with the headset on you cannot see what is at the sides and the arm passes where it
   * passes. So it does not exit at once: the table stops and it asks. While it asks the puck does
   * not run, because otherwise deciding would cost goals.
   */
  prompt: 'quit' | null
  /** Stops the match and asks whether the player really wants to leave it. */
  askToQuit: () => void
  /** No: play goes on from where it was. */
  keepPlaying: () => void

  startGame: () => void
  /** Player's goal: adds points and extends the streak. With the match decided it does not count. */
  scorePlayer: () => void
  /** Machine's goal: takes points off and cuts the streak. With the match decided it does not count. */
  scoreOpponent: () => void
  /**
   * Records a feat of the table (a one-touch goal from the back, an own goal) on the match in
   * progress: it is stored and reported to the hall when it ends. With the match decided it does not count.
   */
  recordFeat: (feat: Feat) => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Clamps the goals of a match to the allowed range. */
export function clampGoalTarget(goals: number): number {
  if (Number.isNaN(goals)) return DEFAULT_GOALS
  return Math.min(MAX_GOALS, Math.max(MIN_GOALS, Math.round(goals)))
}

export function useGameStoreValue({ challenge: hallChallenge, onFinish, goal }: HallOptions = {}): GameStore {
  // What was stored when the game was called `air-hockey`, brought over to the current keys.
  // During render and not in an effect: the record and the levels are read further down with
  // `useSyncExternalStore`, which already reads in this same pass (see `lib/legacyKeys.ts`).
  migrateLegacyKeysOnce()

  const [goalTarget, setGoalTargetState] = useState(DEFAULT_GOALS)
  const [milestones, setMilestones] = useState<TutorialMilestones>(NO_MILESTONES)
  const noteMilestone = useCallback((milestone: TutorialStepKey) => {
    setMilestones((current) => recordMilestone(current, milestone))
  }, [])
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // The menu **always** opens on the challenge, with a hall or without one, and does not remember
  // the last mode: it is the one of the record and of the medals, so whoever comes in and presses
  // Jugar without touching anything has to be playing what counts, with their goal in front of
  // them. Practice is one tap away, next to it.
  const [gameMode, setGameModeState] = useState<GameMode>(CHALLENGE_MODE)
  const [endless, setEndlessState] = useState(false)
  // `null` is «the highest one unlocked»: that way the menu shows the level due
  // without reading storage on the first render, which does not exist on the server.
  const [level, setLevelState] = useState<number | null>(null)
  // The endless match is ended by the player: it is the only thing that closes it.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  // With a challenge the game starts playing: the hall has already chosen game and mode for whoever is playing.
  const [running, setRunning] = useState(hallChallenge != null)
  const [countdown, setCountdown] = useState(hallChallenge != null ? COUNTDOWN_SECONDS : 0)
  const [prompt, setPrompt] = useState<'quit' | null>(null)
  const [tutorialRunning, setTutorialRunning] = useState(false)
  const [learning, setLearning] = useState(false)
  /** Whether the sign is announcing that it now counts (`withNowItCountsNotice`). */
  const [nowItCountsNotice, setNowItCountsNotice] = useState(false)
  const [malletHeld, setMalletHeld] = useState(false)
  const [runId, setRunId] = useState(hallChallenge != null ? 1 : 0)
  // The challenge is looked at only once, on mount: it is what decides what to start with.
  const [inChallenge, setInChallenge] = useState(hallChallenge != null)
  const [challengeSeed] = useState(() => hallChallenge?.seed ?? null)
  // Round of the challenge. It lives here and is not derived because it is the
  // only thing that survives from one match to the next within the same challenge.
  const [challengeRoundNumber, setChallengeRoundNumber] = useState(1)
  // The duel's matches already closed and its seed. The one that has just ended is not recorded
  // here until the next one starts: while the summary is on view it is deduced from the scoreboard (`duelNow`).
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
  // The feats of this match (in the challenge, of all its rounds): they are earned and reported to
  // the hall at the end. A ref and not state because they are not painted, and a set because Strict
  // Mode repeats the effects and the same feat must not count twice.
  const featsThisMatch = useRef(new Set<Feat>())

  // The record is not React state: it lives in the browser and the game
  // subscribes to it, so there is no copy that could disagree with what is stored.
  // Each mode has its own, and that is why the read changes with the chosen mode.
  const readRecord = useCallback(() => getBestPoints(gameMode), [gameMode])
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    readRecord,
    getServerBestPoints,
  )
  // The best to beat is frozen at the start: as soon as the match ends and is
  // stored, `bestPoints` already includes what has just been done and would be no
  // use to tell whether anything has been beaten.
  const [recordToBeat, setRecordToBeat] = useState(() =>
    hallChallenge != null ? getBestPoints(CHALLENGE_MODE) : 0,
  )
  // And the hall's, for the same reason: at the end, the hall raises its own (`onFinish`) and the
  // sign would say «Has igualado tu récord» about the match that has just beaten it (`goal.ts`).
  const hallRecord = goal?.record ?? null
  const liveHallRecord = useRef(hallRecord)
  useEffect(() => {
    liveHallRecord.current = hallRecord
  }, [hallRecord])
  const [hallRecordAtStart, setHallRecordAtStart] = useState(hallRecord)

  // Sound is not state of this game: it comes from the hall's settings, which
  // are chosen once in xrcade and apply to all twelve. Here it is only translated
  // into what the scene asks: whether it is muted and at what volume (see `settings.ts`).
  const volumes = useVolumes()
  const muted = volumes.sfx === 0
  const sfxVolume = volumeFactor(volumes.sfx)
  const music = volumes.ambience > 0
  const ambienceVolume = volumeFactor(volumes.ambience)
  // What is painted around is not React state either, and besides it does not belong
  // to the game: it is the hall's scenery (`xrcade:scenery`). It is changed from the hall's
  // panel and from the two menus here, and all three have to see the same thing.
  const scenery = useScenery()
  // The game's own key is deleted when the state of the match mounts, without
  // moving it over: the choice that rules is the hall's (see `lib/scenery.ts`).
  useEffect(() => {
    forgetOwnScenery(gameStorage())
  }, [])

  // The progress of Levels is not React state either: it lives in the browser and is
  // read subscribed, like the record, so that both menus see it at once.
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
  // How far could be played at the start, and which level it started with. The level
  // is frozen at the start: on winning it the next one is unlocked on the spot, and
  // if the active one followed the unlocked one the match won would turn into
  // the next one halfway, with more goals to score and the summary gone.
  const [unlockedAtStart, setUnlockedAtStart] = useState(1)
  const [levelAtStart, setLevelAtStart] = useState(1)

  const challenge = gameMode === 'challenge'
  const levels = gameMode === 'levels'
  const duelMode = gameMode === 'duel'
  const round = challenge ? challengeRoundNumber : null
  const currentRound = challengeRound(challengeRoundNumber)
  const lap = challenge ? currentRound.lap : null
  // Outside the challenge there is no lap to multiply by: one, which is not multiplying.
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
  // The round and not the `runId`: within the challenge, the table of each round is the same
  // for everyone, whatever happens in the previous ones.
  const seed = duelMode ? duel.seed : tableSeed(inChallenge ? challengeSeed : null, runId, challengeRoundNumber)
  const totalOpponentGoals = previousOpponentGoals + opponentGoals

  // When a match ends is decided by the scoreboard (see `gameMode.ts`).
  const matchOutcome = running
    ? runOutcome({ playerGoals, opponentGoals, goalTarget: activeGoalTarget })
    : null
  // In the challenge, winning ends nothing: it chains the next round. Only losing
  // closes a challenge, and hence it has no ending. The endless match is not closed
  // by goals: the player closes it, and it counts as won if they are ahead.
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

  // One tick per second until the serve. The countdown gives time to place the
  // mallet —in the headset you have just pressed a button and have your hand where
  // it should not be— and announces that the match is going to start for real.
  // And in the headset it does not go past the last second until the mallet is in the hand:
  // serving with the mallet on the table is starting to lose.
  const waitingForMallet = immersive && !malletHeld && countdown <= 1
  useEffect(() => {
    if (!running || countdown <= 0 || waitingForMallet || prompt !== null || tutorialRunning) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown, waitingForMallet, prompt, tutorialRunning])

  // Which round the step up was already taken from. Without this mark, two runs of
  // the effect for the same round —Strict Mode causes them in development— would add
  // what was done twice and skip a whole round. It is a ref and not state
  // because it is not painted: it only avoids repeating a handover already done.
  const advancedRound = useRef(0)

  // Round won: the scoreboard is stored, the step up is taken and the next
  // match starts. The `runId` changes so that the table remounts with the
  // puck in the centre.
  useEffect(() => {
    if (!running || !challenge || matchOutcome !== 'won') return
    // Two runs of the effect for the same round —Strict Mode causes them in
    // development— would add what was done twice and skip a whole round.
    /* v8 ignore next */
    if (advancedRound.current === challengeRoundNumber) return
    advancedRound.current = challengeRoundNumber
    // Each round of the challenge is a match: winning it without conceding is already the feat.
    for (const feat of matchFeats({ won: true, conceded: opponentGoals, endless: false })) {
      featsThisMatch.current.add(feat)
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

  // How the level ended, only with the match finished in Levels.
  const levelResult = useMemo(() => {
    if (!levels || gameState !== 'finished') return null
    const stars = levelStars(outcome === 'won', playerGoals, opponentGoals)
    const passed = levelPassed(stars)
    const unlocks = passed && activeLevel + 1 > unlockedAtStart && activeLevel < LEVEL_COUNT
    return { stars, passed, unlocked: unlocks ? activeLevel + 1 : null }
  }, [levels, gameState, outcome, playerGoals, opponentGoals, activeLevel, unlockedAtStart])

  // The duel with the match that has just ended already counted. It is deduced instead of recorded
  // at the end so as not to write state from an effect: it is really recorded when the next turn
  // starts (`startGame`).
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

  // Which duel was already recorded on the pair's scoreboard. It is a ref and not state because it
  // is not painted: it only avoids adding the same duel twice if the effect repeats.
  const savedDuelRun = useRef(0)
  useEffect(() => {
    if (!duelMode || gameState !== 'finished' || !duelOver(duelNow)) return
    // Strict Mode repeats the effects in development: without this mark, a duel would count double.
    /* v8 ignore next */
    if (savedDuelRun.current === runId) return
    savedDuelRun.current = runId
    saveDuelResult(duelWinner(duelNow))
  }, [duelMode, gameState, duelNow, runId])

  /**
   * The match (its `runId`) the hall was already told about. The notification hangs
   * from the same effect that stores the record, which is redone with every render
   * that changes its dependencies (and twice in development): without this, it would
   * count twice a match that ended once.
   */
  const notifiedRun = useRef(0)
  // The callback is read from the last render and does not enter the dependencies: a
  // host that passes a new function on every render has no reason to redo
  // anything.
  const notify = useRef(onFinish)
  useEffect(() => {
    notify.current = onFinish
  }, [onFinish])

  // Each mode stores its own at the end: points, streak or stars. Storing
  // only does something if it improves what there was, so repeating it changes nothing.
  // It is stored at the end and not goal by goal so that during the match the record
  // stays the best to beat.
  useEffect(() => {
    if (gameState !== 'finished') return
    // In the duel there is no record: the goals belong to two people (see `highScore.ts`). For the
    // same reason the hall is not told either: they do not belong to whoever wears the headset.
    if (duelMode) return
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
    // Right here the hall is told, once per match and even if it is not a
    // record: the points of the match, which in the challenge are those of the record.
    // With the goals after the end discarded (`inPlay`), nothing that is played
    // redoes this effect with the match over: the guard is left for Strict Mode and for
    // any dependency that changes with the summary on screen, and no test reaches it.
    /* v8 ignore next */
    if (notifiedRun.current === runId) return
    notifiedRun.current = runId
    for (const feat of matchFeats({ won: outcome === 'won', conceded: opponentGoals, endless: endlessRun })) {
      featsThisMatch.current.add(feat)
    }
    const newFeats = earnFeats(featsThisMatch.current)
    notify.current?.(withFeats({ mode: gameMode, points: points, challenge: inChallenge }, newFeats))
  }, [gameState, gameMode, duelMode, points, bestStreak, endlessRun, levelResult, activeLevel, runId, inChallenge, outcome, opponentGoals])

  // The sign above the scoreboard: what has to be beaten and how much is left. It is built already
  // translated, as it is painted: its phrases are templates, and composing them outside would force splitting them.
  const lang = useLang()
  const t = useMemo(() => softTranslator(lang), [lang])
  const goals = totalPlayerGoals + totalOpponentGoals
  const run = useMemo(
    () =>
      signRun(
        {
          goal: goal == null ? goal : { ...goal, record: hallRecordAtStart },
          gameMode,
          gameState,
          round: challengeRoundNumber,
          goals,
          points,
          streak,
          record: recordToBeat,
        },
        t,
      ),
    [goal, hallRecordAtStart, gameMode, gameState, challengeRoundNumber, goals, points, streak, recordToBeat, t],
  )
  const sign = useMemo(
    () => (run == null ? null : withNowItCountsNotice(goalSign(run, t), gameMode, nowItCountsNotice, t)),
    [run, t, gameMode, nowItCountsNotice],
  )
  const medal = run == null ? null : medalToCelebrate(run)
  const omitted = useMemo(() => scoreboardOmits(run), [run])

  // The best of this mode: points, or the streak in the endless match. In Levels
  // there is no best to beat: there are stars. In the duel, neither: there is a winner.
  const bestForMode = endlessRun ? bestEndlessStreak : levels || duelMode ? 0 : bestPoints
  const scoreForRecord = endlessRun ? bestStreak : points

  // The match has beaten the record it started with *and* what is stored is
  // exactly this score. Without that second condition, with storage
  // blocked the best to beat would stay at zero for ever and
  // every match with points would be announced as a record. And equality is required,
  // not «at least»: with two tabs open, the other one may have stored something
  // better while this one was being played.
  const isRecord =
    gameState === 'finished' &&
    !levels &&
    !duelMode &&
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  /**
   * How many goals it is played to and whether there is an ending are chosen between matches, like the mode and the level.
   *
   * The scoreboard decides the ending by reading the target on every render (`runOutcome`), so
   * changing it with the match under way rewrites it: with the summary of a 5-0 on screen, raising
   * the target to 7 —or switching to endless— put it back in play, and winning the same match
   * twice stored and reported again what had already been counted. Both menus are only painted
   * outside the match, so the lock takes nothing away from whoever is playing.
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
   * The mode belongs to the whole session, so it is only changed between matches.
   *
   * It is not a theoretical precaution: the points and the mode they were
   * earned in are a pair, and the record is stored by reading both. With the
   * summary on screen —where the score is still alive— changing mode
   * would copy that score to the record of the other one, which has not been played.
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
    featsThisMatch.current = new Set()
    setNowItCountsNotice(false)
  }, [])

  /** Starts a match of that mode with what was chosen: the play button, and the tests' hook. */
  const launch = useCallback(
    (mode: GameMode) => {
      // What comes is another match: it is no longer the hall's challenge, even if it is played
      // in the same mode.
      setInChallenge(false)
      setPrompt(null)
      // In the duel, starting after the first player's match is the second player's turn: the one that
      // has just ended is recorded and the seed carries on. With both played, or from the menu, it is
      // a new duel, with the seed of this match: it does not repeat the shots of the previous duel.
      if (mode === 'duel') {
        setDuel(gameState === 'finished' && !duelOver(duelNow) ? duelNow : newDuel(runId + 1))
      }
      clearRun()
      advancedRound.current = 0
      setEndedByPlayer(false)
      setRecordToBeat(mode === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(mode))
      setHallRecordAtStart(liveHallRecord.current)
      setUnlockedAtStart(getUnlockedLevel())
      setLevelAtStart(selectedLevel)
      setRunId((id) => id + 1)
      setCountdown(COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, endless, selectedLevel, gameState, duelNow, runId],
  )
  const startGame = useCallback(() => launch(gameMode), [launch, gameMode])

  // The common hook of the browser tests (`testRun.ts`): only if the test has asked for it
  // before loading the page. It is redone with what it uses, so the test always calls the current one.
  const liveSign = useRef(sign)
  useEffect(() => {
    liveSign.current = sign
  }, [sign])
  useEffect(() => {
    exposeTestRun({
      start: () => {
        // The challenge, without the tutorial in front: its steps, taken as done.
        setGameModeState(CHALLENGE_MODE)
        setMilestones(ALL_MILESTONES)
        launch(CHALLENGE_MODE)
      },
      score: (newPoints) => {
        setCountdown(0)
        setPoints(newPoints)
      },
      // Let the machine win the round: in the challenge, that is what ends it.
      end: () => {
        setCountdown(0)
        setOpponentGoals(activeGoalTarget)
      },
      sign: () => liveSign.current,
    })
  }, [launch, activeGoalTarget])

  // Only the goal of a live match counts. The puck keeps rolling when the match has already been
  // decided —the table finds out one frame late—, and such a goal changed the points after
  // the end and stored the record again with them. Nor does it count with the challenge's round
  // already won and not yet handed over: it would add to the next one what was not played in it.
  const inPlay = gameState === 'playing' && matchOutcome === null
  const scorePlayer = useCallback(() => {
    if (!inPlay) return
    // And the third: scoring.
    noteMilestone('goal')
    setPlayerGoals((value) => value + 1)
    setLastScorer('player')
    // The streak is computed in here because the points depend on it: reading
    // `streak` from the previous render would give the same bonus to two goals
    // chained in the same batch of updates.
    setStreak((previous) => {
      const next = previous + 1
      setBestStreak((best) => Math.max(best, next))
      setPoints((total) =>
        scoreGoal(total, { difficulty: activeDifficulty, streak: next, lap: lapFactor }),
      )
      return next
    })
  }, [inPlay, activeDifficulty, lapFactor, noteMilestone])

  // Learning in the challenge, what the machine scores does not count (`learning`).
  const learningTheChallenge = learning && challenge
  const scoreOpponent = useCallback(() => {
    if (!inPlay || learningTheChallenge) return
    setOpponentGoals((value) => value + 1)
    setLastScorer('opponent')
    setStreak(0)
    // In the first round of the challenge conceding does not subtract (`concededPenalty`).
    setPoints((total) => scoreConceded(total, concededPenalty(round)))
  }, [inPlay, learningTheChallenge, round])

  const finishLesson = useCallback(() => {
    if (!challenge || !running) return
    // The challenge, from zero: what came before was learning. The table is brand new (`runId`) with
    // the puck in the centre, and the countdown waits again for the mallet in the hand.
    clearRun()
    advancedRound.current = 0
    setEndedByPlayer(false)
    setRunId((id) => id + 1)
    setCountdown(COUNTDOWN_SECONDS)
    setNowItCountsNotice(true)
  }, [challenge, running, clearRun])

  // The notice goes away by itself.
  useEffect(() => {
    if (!nowItCountsNotice) return
    const dismiss = setTimeout(() => setNowItCountsNotice(false), NOW_IT_COUNTS_MS)
    return () => clearTimeout(dismiss)
  }, [nowItCountsNotice])

  const recordFeat = useCallback(
    (feat: Feat) => {
      if (!inPlay) return
      featsThisMatch.current.add(feat)
    },
    [inPlay],
  )

  // Writes the hall's key, not one of the game: the button and the hall's panel are the same setting.
  const setScenery = useCallback((value: Scenery) => setArcadeScenery(value), [])

  const askToQuit = useCallback(() => setPrompt('quit'), [])
  const keepPlaying = useCallback(() => setPrompt(null), [])

  const resetGame = useCallback(() => {
    setInChallenge(false)
    setPrompt(null)
    // Going back to the menu drops the duel: the other player's turn no longer has anything to compare against.
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
      learning,
      setLearning,
      finishLesson,
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
      goal: goal ?? null,
      sign,
      medal,
      omitted,
      gameState,
      milestones,
      recordMilestone: noteMilestone,
      countdown,
      malletHeld,
      setMalletHeld,
      waitingForMallet,
      runId,
      seed,
      inChallenge,
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
      recordFeat,
      resetGame,
    }),
    [
      prompt,
      tutorialRunning,
      learning,
      finishLesson,
      askToQuit,
      keepPlaying,
      malletHeld,
      waitingForMallet,
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
      goal,
      sign,
      medal,
      omitted,
      gameState,
      countdown,
      runId,
      seed,
      inChallenge,
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
      recordFeat,
      resetGame,
      milestones,
      noteMilestone,
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
