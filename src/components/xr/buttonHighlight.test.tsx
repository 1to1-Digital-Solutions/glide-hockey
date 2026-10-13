import { act, cleanup, render } from '@testing-library/react'
import { Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ButtonHighlight,
  HIGHLIGHT_Z,
  PANEL_ORDER,
  useButtonFeedback,
  type ButtonState,
} from './buttonHighlight'

/**
 * That pointing at a button does not erase it.
 *
 * It is the bug that was reported with the headset on —«when you put the cursor over a button it
 * is as if the button disappears, showing what is underneath»— and it is not seen from a
 * screen because **it depends on where you look**: the highlight is painted 5 mm in front of
 * the plate, and three sorts what is transparent by the depth of each object's **origin**.
 * Looking at the centre of the panel the highlight comes out nearer and is painted last, which is
 * correct; looking at the button —which is what you do to point at it— the button ends up farther
 * along the view axis than the centre of the plate, the order is inverted, and a highlight that
 * writes depth erases the whole plate inside its rectangle.
 *
 * Here both halves are checked: that the order really **flips** (with three's
 * maths, without a browser) and that the highlight is made in such a way that it does not matter.
 */

/**
 * React DOM does not know `<mesh>` or `args`: they are three's tags and here they are mounted
 * without a Canvas on purpose, since what is looked at is the tree React produces. Those warnings
 * are silenced, one by one; any other error still comes out on the console.
 */
const THREE_WARNINGS = [
  'is unrecognized in this browser',
  'incorrect casing',
  'non-boolean attribute',
  'does not recognize the',
  'Invalid value for prop',
  'React does not recognize',
]

afterEach(cleanup)

beforeEach(() => {
  const original = console.error
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = String(args[0])
    if (THREE_WARNINGS.some((warning) => message.includes(warning))) return
    original(...args)
  })
})

const BUTTON = { width: 0.16, height: 0.09 }

/**
 * What really reaches three, which is not what is seen by mounting it.
 *
 * React DOM does not paint the booleans of a tag it does not know: mounted, the material comes out
 * with `color` and `opacity` and **with no trace of `transparent` or of `depthWrite`**. So a
 * test that looked at the DOM would accept exactly the bug that is being fixed. What is looked at
 * is the tree the component returns, which is the contract with `@react-three/fiber`.
 */
function highlightParts(state: ButtonState) {
  const mesh = ButtonHighlight({ ...BUTTON, state, glow: '#f4f1ea', ink: '#151a22' })
  if (mesh == null) return null

  const props = mesh.props as { renderOrder: number; children: unknown }
  const children = (Array.isArray(props.children) ? props.children : [props.children]) as {
    type: string
    props: Record<string, unknown>
  }[]
  const inside = (type: string) => children.find((child) => child?.type === type)?.props ?? {}

  return {
    renderOrder: props.renderOrder,
    geometry: inside('planeGeometry') as { args: [number, number] },
    material: inside('meshBasicMaterial') as {
      color: string
      transparent: boolean
      depthWrite: boolean
    },
  }
}

describe('the highlight of a panel button', () => {
  it('not pointed at it paints nothing: a still panel has no reason to pay for one more plane', () => {
    expect(highlightParts('idle')).toBeNull()
    expect(
      render(<ButtonHighlight {...BUTTON} state="idle" glow="#fff" ink="#000" />).container
        .querySelector('mesh'),
    ).toBeNull()
  })

  it.each<ButtonState>(['pointed', 'pressed'])(
    'pointed at or pressed (%s) it is painted, which is the opposite of disappearing',
    (state) => {
      expect(
        render(<ButtonHighlight {...BUTTON} state={state} glow="#fff" ink="#000" />).container
          .querySelector('mesh'),
      ).not.toBeNull()
    },
  )

  it.each<ButtonState>(['pointed', 'pressed'])(
    'and its material does NOT write depth (%s): it is what erased the plate behind',
    (state) => {
      const material = highlightParts(state)!.material
      expect(material.transparent).toBe(true)
      // `transparent` does not imply `depthWrite: false` in three, and that is the whole fault.
      expect(material.depthWrite).toBe(false)
    },
  )

  it.each<ButtonState>(['pointed', 'pressed'])(
    'and it is painted after the plate whatever happens (%s), not when the sorting feels like it',
    (state) => {
      const order = highlightParts(state)!.renderOrder
      expect(order).toBe(PANEL_ORDER.highlight)
      // In front of all the layers of the panel: if it tied with any, the sorting by depth
      // would decide again, which is exactly the one that flips.
      expect(order).toBeGreaterThan(
        Math.max(PANEL_ORDER.back, PANEL_ORDER.behind, PANEL_ORDER.face),
      )
    },
  )

  it('pointed at it overflows the button and pressed it goes inside: it sinks instead of leaving', () => {
    expect(highlightParts('pointed')!.geometry.args[0]).toBeGreaterThan(BUTTON.width)
    expect(highlightParts('pressed')!.geometry.args[0]).toBeLessThan(BUTTON.width)
  })

  it('and it changes colour when pressed, which is what was asked for: not only size', () => {
    expect(highlightParts('pointed')!.material.color).toBe('#f4f1ea')
    expect(highlightParts('pressed')!.material.color).toBe('#151a22')
  })
})

/**
 * The inversion of the order, with three's maths and without a browser.
 *
 * `WebGLRenderer` keeps for each object the `z` of its origin passed through the projection
 * matrix, and paints what is transparent from greatest to least: the farthest first. That is what
 * is repeated here — and what shows that it is **not** enough to bring the highlight a few
 * millimetres forward.
 */
describe('how three sorts the plate and the highlight', () => {
  /** The panel, face-on and at arm's length, with a button near the bottom edge. */
  const DISTANCE = 0.8
  const BUTTON_Y = -0.55

  function sortingZ(point: Vector3, lookingAt: Vector3): number {
    const camera = new PerspectiveCamera(60, 1, 0.05, 20)
    camera.position.set(0, 0, DISTANCE)
    camera.lookAt(lookingAt)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    const projection = new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    return point.clone().applyMatrix4(projection).z
  }

  const plate = new Vector3(0, 0, 0)
  const highlight = new Vector3(0, BUTTON_Y, HIGHLIGHT_Z)

  it('looking at the centre of the panel the highlight comes out in front, and that is why the bug seemed capricious', () => {
    const atCentre = new Vector3(0, 0, 0)
    expect(sortingZ(highlight, atCentre)).toBeLessThan(sortingZ(plate, atCentre))
  })

  it('but looking at the button —which is what you do when pointing at it— it is painted BEFORE the plate', () => {
    const atButton = new Vector3(0, BUTTON_Y, 0)
    // Farther along the view axis, even though it is 5 mm in front on the panel: three
    // paints it first, and from there everything that writes depth erases the plate.
    expect(sortingZ(highlight, atButton)).toBeGreaterThan(sortingZ(plate, atButton))
  })
})

describe('what is listened to on a button to know how it is', () => {
  function Panel() {
    const { stateOf, handlersFor } = useButtonFeedback()
    return (
      <div>
        <button data-testid="uno" {...handlersFor('uno')} />
        <span data-testid="estado">{stateOf('uno')}</span>
      </div>
    )
  }

  const stateIn = (container: HTMLElement) =>
    container.querySelector('[data-testid="estado"]')?.textContent

  function events(container: HTMLElement) {
    const button = container.querySelector('[data-testid="uno"]') as HTMLElement
    return {
      enter: () => act(() => button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))),
      press: () => act(() => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))),
      release: () => act(() => button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))),
      leave: () => act(() => button.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))),
    }
  }

  it('with nothing over it it is idle', () => {
    const { container } = render(<Panel />)
    expect(stateIn(container)).toBe('idle')
  })

  it('pointing at it lights it up, and pressing sinks it', () => {
    const { container } = render(<Panel />)
    const { enter, press } = events(container)
    enter()
    expect(stateIn(container)).toBe('pointed')
    press()
    expect(stateIn(container)).toBe('pressed')
  })

  it('on release it is only pointed at again: the button is still there', () => {
    const { container } = render(<Panel />)
    const { enter, press, release } = events(container)
    enter()
    press()
    release()
    expect(stateIn(container)).toBe('pointed')
  })

  it('and leaving clears both: aiming freehand, the ray leaves the button without releasing it', () => {
    const { container } = render(<Panel />)
    const { enter, press, leave } = events(container)
    enter()
    press()
    leave()
    // Without this the button would stay sunk for ever, which is worse than not sinking.
    expect(stateIn(container)).toBe('idle')
  })
})
