import { describe, expect, it } from 'vitest'
import {
  NO_MILESTONES,
  TUTORIAL_BUTTONS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
  TUTORIAL_STEPS,
  recordMilestone,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialMilestones,
} from './tutorial'

/**
 * The script of the tutorial.
 *
 * What is watched here is that **progress comes from doing**. The earlier one ran by the
 * clock: one could watch without doing anything and when the time ran out it was taken as
 * learnt. Reported with the headset on: the throwing step should not pass until the last
 * thing is achieved.
 *
 * And that the step is **computed** from what has happened in the match instead of being
 * stored apart: a tutorial that keeps its own count ends up disagreeing with the game.
 */

/** The milestones with these achieved. */
function achieved(...which: readonly (keyof TutorialMilestones)[]): TutorialMilestones {
  return which.reduce(recordMilestone, NO_MILESTONES)
}

describe('which step is due', () => {
  it('with nothing done, the first one', () => {
    expect(tutorialStep(NO_MILESTONES, 0)).toBe(TUTORIAL_STEPS[0])
  })

  it('doing each thing goes through them all and it ends', () => {
    let milestones = NO_MILESTONES
    const visited = [tutorialStep(milestones, 0)]
    for (const step of TUTORIAL_STEPS) {
      milestones = recordMilestone(milestones, step)
      visited.push(tutorialStep(milestones, 0))
    }
    expect(visited).toEqual([...TUTORIAL_STEPS, null])
  })

  it('waiting advances nothing: the tutorial has no clock', () => {
    // The control for what was changed: with no milestones, the step is the same forever.
    expect(tutorialStep(NO_MILESTONES, 0)).toBe(tutorialStep(NO_MILESTONES, 0))
  })

  it('achieving something from further on does not skip what comes before', () => {
    // Achieving the last thing without having gone through picking up leaves the picking-up
    // step where it was.
    expect(tutorialStep(achieved('goal'), 0)).toBe('grab')
  })

  it('a milestone is not undone', () => {
    const milestones = achieved(TUTORIAL_STEPS[0])
    expect(recordMilestone(milestones, TUTORIAL_STEPS[0])).toBe(milestones)
    expect(tutorialStep(milestones, 0)).toBe(TUTORIAL_STEPS[1])
  })
})

describe('the two ways out', () => {
  it('next moves on to the next one even if it has not been achieved', () => {
    // A step that is not achieved would leave someone locked inside it.
    expect(tutorialStep(NO_MILESTONES, 1)).toBe(TUTORIAL_STEPS[1])
  })

  it('skipping them all ends it', () => {
    expect(tutorialStep(NO_MILESTONES, TUTORIAL_STEPS.length)).toBeNull()
  })

  it('skipping too many breaks nothing', () => {
    expect(tutorialStep(NO_MILESTONES, 99)).toBeNull()
    expect(tutorialStep(NO_MILESTONES, -3)).toBe(TUTORIAL_STEPS[0])
  })
})

describe('which button each step teaches', () => {
  it('the grabbing one teaches the grip button', () => {
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
  })

  it('every step says something, even if it is that there is no button', () => {
    // A step with no entry here would come out drawing the controller with nothing highlighted.
    for (const step of TUTORIAL_STEPS) expect(step in TUTORIAL_BUTTONS).toBe(true)
  })
})

describe('whether it has already been seen', () => {
  const storage = (value: string | null) => ({ getItem: () => value })

  it('only the exact value counts as seen', () => {
    expect(tutorialSeen(storage(TUTORIAL_SEEN_VALUE))).toBe(true)
    expect(tutorialSeen(storage('2'))).toBe(false)
    expect(tutorialSeen(storage(null))).toBe(false)
  })

  it('with no storage it is shown again: seeing it once too often is better than not understanding', () => {
    expect(tutorialSeen(null)).toBe(false)
    expect(
      tutorialSeen({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe(false)
  })

  it('the version goes up when the lesson changes, and this one changed entirely', () => {
    expect(Number(TUTORIAL_SEEN_VALUE)).toBeGreaterThan(2)
  })

  it('the record is left under the key of the game', () => {
    const written: Record<string, string> = {}
    const saved = markTutorialSeen({
      getItem: () => null,
      setItem: (key: string, value: string) => {
        written[key] = value
      },
    } as unknown as Storage)
    expect(saved).toBe(true)
    expect(written[TUTORIAL_SEEN_KEY]).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('and if the browser does not store, it says it was not stored', () => {
    expect(markTutorialSeen(null)).toBe(false)
    expect(
      markTutorialSeen({
        setItem: () => {
          throw new Error('blocked')
        },
      } as unknown as Storage),
    ).toBe(false)
  })
})
