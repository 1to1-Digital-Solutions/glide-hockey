import { describe, expect, it } from 'vitest'
import { Euler, Quaternion, Vector3 } from 'three'
import {
  EYE_HEIGHTS,
  MIN_READING_DEGREES,
  centreInside,
  distanceFromEyes,
  eyesAt,
  facingEyes,
  letterAngle,
  noTextOwnsAButton,
  panelRotation,
  pointOnPanel,
  readingDistance,
  rotate,
  sizesOffList,
  textsOnButtons,
  tiltTowardEyes,
  unreadableTexts,
  worstReadingDistance,
  worstText,
  type EulerOrder,
  type WrittenText,
} from './panelReading'

/**
 * How much of the eye a font on a panel takes up, without a browser.
 *
 * The sums are compared with three —the scene rotates the panels with it— and with what a font
 * takes up head-on, which is the usual sum: if a far row or an edge-on panel did not take up
 * less, measuring with the foreshortening would be no use at all.
 */

const EYES = eyesAt(1.6)

/** How much something of that height at that distance takes up in the eye, head-on, in degrees. */
function headOn(height: number, distance: number): number {
  return (2 * Math.atan(height / 2 / distance) * 180) / Math.PI
}

/** A text recorded the way the canvas records it, with the box height of a font of `font` metres. */
function written(text: string, x: number, y: number, font: number, lineHeight = 0.8): WrittenText {
  return { text, x, y, width: text.length * font * 0.62, height: font * lineHeight }
}

describe('a panel rotated the way three rotates it', () => {
  const ORDERS: EulerOrder[] = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']

  it('each order rotates a point the same as a three Euler', () => {
    for (const order of ORDERS) {
      const rotation = [0.3, -0.7, 0.2, order] as const
      const expected = new Vector3(0.2, -0.35, 0.1).applyQuaternion(new Quaternion().setFromEuler(new Euler(...rotation)))
      const point = rotate({ x: 0.2, y: -0.35, z: 0.1 }, rotation)
      expect(expected.distanceTo(new Vector3(point.x, point.y, point.z)), order).toBeLessThan(1e-12)
    }
  })

  it('without an order it is XYZ, and without a rotation it does not move', () => {
    expect(rotate({ x: 1, y: 2, z: 3 }, [0.4, 0.5, 0.6])).toEqual(rotate({ x: 1, y: 2, z: 3 }, [0.4, 0.5, 0.6, 'XYZ']))
    expect(rotate({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('a point of the panel lands where three would put it hanging from a group with that place and that rotation', () => {
    const pose = { position: [0.7, 1.3, -1.1], rotation: [-0.2, -0.5, 0.1, 'YXZ'] } as const
    const expected = new Vector3(0.25, -0.3, 0)
      .applyQuaternion(new Quaternion().setFromEuler(new Euler(...pose.rotation)))
      .add(new Vector3(...pose.position))
    const point = pointOnPanel(pose, 0.25, -0.3)
    expect(expected.distanceTo(new Vector3(point.x, point.y, point.z))).toBeLessThan(1e-12)
  })
})

describe('facing the eyes and tilted toward them', () => {
  it('the face of the panel points at the eyes, whether it is below, level or above', () => {
    for (const place of [
      [-0.6, 0.8, -0.7],
      [0.6, 1.6, -0.7],
      [0.8, 2.1, -1.1],
      [0, 1.5, -1.15],
    ] as const) {
      for (const height of EYE_HEIGHTS) {
        const eyes = eyesAt(height)
        const [x, y, z, order] = panelRotation(place, eyes)
        const face = new Vector3(0, 0, 1).applyEuler(new Euler(x, y, z, order))
        const toEye = new Vector3(eyes.x - place[0], eyes.y - place[1], eyes.z - place[2]).normalize()
        expect(face.dot(toEye), `${place.join(', ')} with the eyes at ${height}`).toBeCloseTo(1, 10)
      }
    }
  })

  it('at eye height it does not tilt, and straight ahead it does not rotate', () => {
    expect(tiltTowardEyes([0, 1.6, -1], EYES)).toBeCloseTo(0, 12)
    expect(facingEyes([0, 1.2, -1], EYES)).toBeCloseTo(0, 12)
  })

  it('the distance to the eyes counts the height, not just the floor plan', () => {
    expect(distanceFromEyes([0, 1.6, -1], EYES)).toBeCloseTo(1, 12)
    expect(distanceFromEyes([0, 0.85, -1], EYES)).toBeCloseTo(1.25, 12)
  })
})

describe('how much a font takes up in the eye', () => {
  it('at the centre of a panel that looks at the eyes, the same as head-on at that distance', () => {
    const position = [-0.6, 0.8, -0.8] as const
    const pose = { position, rotation: panelRotation(position, EYES) }
    const d = distanceFromEyes(position, EYES)
    expect(letterAngle(pose, EYES, 0, 0, 0.034)).toBeCloseTo(headOn(0.034, d), 6)
    expect(readingDistance(pose, EYES, 0, 0, 0.034)).toBeCloseTo(d, 6)
  })

  it('in a row far from the centre, less: it is farther away and seen at a glancing angle', () => {
    const position = [0, 1.5, -1.15] as const
    const pose = { position, rotation: panelRotation(position, EYES) }
    expect(letterAngle(pose, EYES, -0.3, 0.48, 0.034)).toBeLessThan(letterAngle(pose, EYES, 0, 0, 0.034))
    expect(readingDistance(pose, EYES, -0.3, 0.48, 0.034)).toBeGreaterThan(distanceFromEyes(position, EYES))
  })

  it('the control: an edge-on panel below the line of sight reads the font foreshortened', () => {
    // Rotated only about the vertical, one metre below the eyes and one metre from them.
    const position = [0, 0.6, -1] as const
    const edgeOn = letterAngle({ position }, EYES, 0, 0, 0.034)
    const tilted = letterAngle({ position, rotation: panelRotation(position, EYES) }, EYES, 0, 0, 0.034)
    expect(edgeOn).toBeLessThan(tilted * 0.75)
  })
})

describe('measuring what a panel writes', () => {
  const position = [0, 1.6, -1] as const
  const pose = { position, rotation: panelRotation(position, EYES) }
  const large = written('Jugar', 0, 0.1, 0.04)
  const small = written('Salir', 0.1, -0.1, 0.02)

  it('flags the font that falls short, with its size and its degrees', () => {
    expect(MIN_READING_DEGREES).toBe(1.4)
    expect(unreadableTexts([large, small], pose, EYES, 0.8)).toEqual([
      `«Salir» at 20.0 mm takes up ${letterAngle(pose, EYES, 0.1, -0.1, 0.02).toFixed(2)}°`,
    ])
    // With a lower minimum, it passes.
    expect(unreadableTexts([small], pose, EYES, 0.8, 1)).toEqual([])
  })

  it('says which one reads worst and at what distance the panel has to be measured', () => {
    expect(worstText([large, small], pose, EYES, 0.8)).toEqual({
      text: 'Salir',
      degrees: letterAngle(pose, EYES, 0.1, -0.1, 0.02),
    })
    expect(worstText([small, large], pose, EYES, 0.8)?.text).toBe('Salir')
    expect(worstText([], pose, EYES, 0.8)).toBeNull()
    expect(worstReadingDistance([large, small], pose, EYES, 0.8)).toBeCloseTo(
      readingDistance(pose, EYES, 0.1, -0.1, 0.02),
      12,
    )
  })

  it('flags the size that is not in the list', () => {
    expect(sizesOffList([large, small], 0.8, [0.04, 0.034])).toEqual(['«Salir» at 20.0 mm'])
  })

  it('flags the text that runs into a button that is not its own', () => {
    const buttons = [
      { x: 0, y: 0.1, width: 0.3, height: 0.1 },
      { x: 0, y: 0.06, width: 0.3, height: 0.06 },
    ]
    // «Jugar» is the label of the first one and runs into the one below.
    expect(textsOnButtons([large], buttons)).toEqual(['«Jugar» runs into the button at (0.00, 0.06)'])
    // One that touches none is not flagged.
    expect(textsOnButtons([written('Lejos', 0, -0.4, 0.04)], buttons)).toEqual([])
  })

  it('in a panel of labels, not even the one with its centre inside belongs to a button', () => {
    const button = { x: -0.28, y: 0.48, width: 0.11, height: 0.11 }
    const label = written('Modo', -0.3, 0.43, 0.03)
    expect(centreInside(label, button)).toBe(true)
    expect(textsOnButtons([label], [button])).toEqual([])
    expect(textsOnButtons([label], [button], noTextOwnsAButton)).toEqual(['«Modo» runs into the button at (-0.28, 0.48)'])
  })
})
