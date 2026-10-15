/**
 * The game's constants: the table, the puck, the mallets and what each
 * difficulty does.
 *
 * It lives apart from the scene because the puck physics, the rival machine and
 * their tests need the same numbers that are drawn: if the table gets wider,
 * the bounce has to get wider with it.
 *
 * Everything in metres: the scene is at human scale and the player sees it
 * standing up with the headset. The colours are in `palette.ts`.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/** Order of difficulties from lowest to highest, to build selectors. */
export const DIFFICULTY_ORDER: Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'impossible',
]

/** Visible label, in English: it is the key it is translated with (see `textos.ts`). */
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
} as const satisfies Record<Difficulty, string>

/**
 * The table, sized like a real one but a little narrower: in the headset one
 * plays aiming from the edge, and with the 1.07 m of a competition one the
 * far side ends up at an awkward angle.
 *
 * The X axis is the width (from rail to rail) and Z the length (from goal to
 * goal). The player defends the positive Z side, which is the one in front of
 * them.
 */
export const TABLE_WIDTH = 1.1
export const TABLE_LENGTH = 2
/** Height of the playing surface above the floor. */
export const TABLE_HEIGHT = 0.9
/**
 * Where the centre of the table is relative to the player, who is at the origin.
 *
 * 1.2 m away from them: the near edge ends up 20 cm away, the distance at which
 * one stands in front of a real table.
 */
export const TABLE_CENTER_Z = -1.2

/**
 * Width of the opening of each goal, centred on the end rail.
 *
 * Half a metre and not forty centimetres. With the mallet fifteen across, the old goal
 * covered itself: the puck went in through a twelve-centimetre slit and scoring a goal
 * —or conceding one— went from rare to unlikely. What is wanted here is not the rulebook of
 * an arcade hall, it is for a five-minute match to have goals.
 */
export const GOAL_WIDTH = 0.55
/** Height of the rails that surround the table, measured from the surface. */
export const RAIL_HEIGHT = 0.05

export const PUCK_RADIUS = 0.05
/**
 * Radius of the mallet.
 *
 * Somewhat smaller than before (it was 7.5 cm): it covered half the goal by itself, and with
 * the hand on top one does not see the puck go by underneath. It is still bigger than the
 * puck, which is what makes hitting easy and stopping, a little less so.
 */
export const MALLET_RADIUS = 0.066

/**
 * Friction of the puck on the air cushion, as the fraction of speed that is
 * lost per second. Low on purpose: on air the puck barely slows down, and a
 * high value turns the game into pushing instead of hitting.
 */
export const PUCK_FRICTION = 0.28

/**
 * Speed cap of the puck, in m/s.
 *
 * Without it, two hits in a row in the same direction leave it going so fast
 * that it goes through the rail between two frames and leaves the table.
 */
export const MAX_PUCK_SPEED = 6

/** How much speed the puck keeps when bouncing off a rail. */
export const WALL_RESTITUTION = 0.9

/**
 * How much a mallet gives back when hitting: that of a real mallet against a
 * real puck, which does not quite give back everything it receives.
 *
 * It was at 1.15 —above 1— so that a sharp hit came out faster than it
 * arrived. The physics already does that by itself and without making up
 * energy: the impulse is computed with the **relative** speed, so a mallet
 * moving forward at 3 m/s against a puck coming at 2 gives it back almost 7.
 * What the 1.15 did was make a STILL mallet return the puck faster than it
 * arrived, which is a table that plays by itself.
 */
export const MALLET_RESTITUTION = 0.85

/**
 * Maximum speed of the player's mallet, in m/s.
 *
 * The mallet chases the pointer instead of appearing wherever it is: a mouse
 * jerk would teleport it to the other side of the puck without touching it,
 * and with the controller ray any tremor would come out as a hit. Chasing with
 * a cap turns both gestures into a movement with inertia, which is what the
 * physics needs to know how hard it hits.
 */
export const PLAYER_MALLET_SPEED = 4.5

/** Speed at which the puck leaves on the serve from the centre, in m/s. */
export const SERVE_SPEED = 1.1

/** Seconds of countdown between pressing «Jugar» and the first serve. */
export const COUNTDOWN_SECONDS = 3

/** Seconds a goal is celebrated before serving again. */
export const GOAL_PAUSE_SECONDS = 1.4

/** Goals a practice match can be played to. */
export const MIN_GOALS = 3
export const MAX_GOALS = 15
/** How many one starts with: a short match, to try it without committing. */
export const DEFAULT_GOALS = 7

/** How the machine plays at each difficulty. */
export interface OpponentSkill {
  /** Maximum speed of the rival mallet, in m/s. It is what decides what it reaches. */
  maxSpeed: number
  /**
   * How far it gets ahead of the puck when defending, in seconds: how far in
   * advance it works out where it will be instead of chasing where it is.
   */
  anticipation: number
  /**
   * How far from its goal it stands and waits, as a fraction of its half of
   * the table. The larger, the further forward it presses and the bigger the
   * gap it leaves.
   */
  defenseDepth: number
  /**
   * From what distance it comes out to hit the puck, in metres. Short means
   * waiting at the back; long means going out to fetch it up to mid-rink.
   */
  attackRange: number
  /**
   * How often it shoots at the post the player **does** cover, from 0 to 1.
   *
   * It is the shot that fools whoever went to the gap too early. At zero, the
   * machine always goes for the gap and by the third match one knows where it
   * will shoot.
   */
  cross: number
  /**
   * And how often it sends the puck to the rail so that it arrives from the
   * other side, from 0 to 1. Zero below medium difficulty: a bounce off the
   * rail cannot be read as it comes, and on Easy that is not a rival, it is a
   * trap.
   */
  bank: number
}

/**
 * The difficulty goes up in three places at once: the machine moves faster
 * —it reaches pucks that used to get away from it—, defends further forward,
 * which closes the shooting angle, and **mixes its shots more**. All three are
 * needed: with speed alone it stays glued to its goal and the player shoots from
 * mid-rink unopposed; and without mixing, the fastest of all still always shoots
 * at the same place, which is what one learns in three matches.
 *
 * The two shot proportions are split like this: `bank` first, `cross` next and
 * the rest at the gap. On Easy that leaves 92 % of the shots at the gap
 * —predictable on purpose, which is what makes it beatable by watching—; on
 * Impossible, 30 % at the gap, 40 % crossed and 30 % off the rail, which can no
 * longer be guessed.
 */
export const OPPONENT_SKILLS: Record<Difficulty, OpponentSkill> = {
  easy: { maxSpeed: 0.9, anticipation: 0.05, defenseDepth: 0.18, attackRange: 0.3, cross: 0.08, bank: 0 },
  medium: { maxSpeed: 1.3, anticipation: 0.09, defenseDepth: 0.3, attackRange: 0.45, cross: 0.3, bank: 0.16 },
  hard: { maxSpeed: 1.8, anticipation: 0.13, defenseDepth: 0.42, attackRange: 0.6, cross: 0.34, bank: 0.22 },
  expert: { maxSpeed: 2.4, anticipation: 0.17, defenseDepth: 0.54, attackRange: 0.75, cross: 0.37, bank: 0.26 },
  impossible: { maxSpeed: 3.1, anticipation: 0.22, defenseDepth: 0.66, attackRange: 0.9, cross: 0.4, bank: 0.3 },
}
