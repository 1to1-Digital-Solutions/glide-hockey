import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Texture,
} from 'three'

import { COMPONENTE_DEL_BOTON, TUTORIAL_BUTTONS } from '../../lib/tutorial'
import { buttonNode, nodePlacement, disposeModel } from './RealController'

/**
 * That the controller the tutorial shows can really be shown.
 *
 * None of this is seen failing while playing: if the button's identifier does not exist in the
 * profile, or if the `.glb` was not copied, the tutorial **gives no warning** —it is left without
 * a model and carries on, which is what it has to do with an unknown controller—. So it is checked
 * here, against the files that are really served.
 */

const PROFILES = join(process.cwd(), 'public/webxr-profiles')

/**
 * Which controllers have a served model.
 *
 * What is there is looked at and the list is not written: `scripts/sync-xr-profiles.mjs` decides
 * it, and a copy here would be another list to maintain —and one that would fall behind on the
 * very day a controller is added—.
 */
const WITH_MODEL = readdirSync(PROFILES).filter((id) =>
  existsSync(join(PROFILES, id, 'right.glb')),
)

function layoutOf(id: string, hand: 'left' | 'right') {
  const profile = JSON.parse(readFileSync(join(PROFILES, id, 'profile.json'), 'utf8'))
  return profile.layouts[hand]
}

describe('the controller model served with the game', () => {
  it('the one for the headset of the hall is there', () => {
    // Without this, the game would pass the tests without ever having run `sync:xr-profiles`, and
    // the tutorial would be left without a model also on the headset it is tested with.
    expect(WITH_MODEL).toContain('meta-quest-touch-plus')
  })

  it.each(WITH_MODEL)('%s travels with both hands', (id) => {
    expect(existsSync(join(PROFILES, id, 'left.glb'))).toBe(true)
    expect(existsSync(join(PROFILES, id, 'right.glb'))).toBe(true)
  })
})

describe('which part of the model lights up', () => {
  it.each(WITH_MODEL)('on %s, every button of the lesson has its node', (id) => {
    for (const hand of ['left', 'right'] as const) {
      const layout = layoutOf(id, hand)
      for (const button of Object.values(TUTORIAL_BUTTONS)) {
        if (button == null) continue
        expect(buttonNode(layout, COMPONENTE_DEL_BOTON[button])).toBeTruthy()
      }
    }
  })

  it('a controller without that button gives no node, and the tutorial keeps the drawing', () => {
    const layout = layoutOf('generic-trigger', 'right')
    expect(buttonNode(layout, COMPONENTE_DEL_BOTON.gatillo)).toBeTruthy()
    expect(buttonNode(layout, COMPONENTE_DEL_BOTON.agarre)).toBeNull()
  })

  it('it is not `rootNodeName`, which is what it looks like and on Quest is not in the model', () => {
    // The control for the failure: the first attempt looked for the part that way and never found it.
    const layout = layoutOf('meta-quest-touch-plus', 'right')
    const component = layout.components[COMPONENTE_DEL_BOTON.agarre]
    expect(buttonNode(layout, COMPONENTE_DEL_BOTON.agarre)).not.toBe(component.rootNodeName)
  })
})

describe('where the mark is put inside the model', () => {
  /** A fake controller: the pivot far from the button, and the button hanging from it. */
  function fakeModel(): Object3D {
    const root = new Group()
    const pivot = new Object3D()
    pivot.name = 'button_pressed_value'
    pivot.position.set(0, 0.013, -0.025)
    const button = new Mesh(new BoxGeometry(0.01, 0.02, 0.01))
    button.position.set(0, -0.013, 0.04)
    pivot.add(button)
    root.add(pivot)
    return root
  }

  it('falls on the part, not on the pivot that moves it', () => {
    // The control for the failure: marking the node the profile names, the mark came out two
    // and a half centimetres in front of the button, at the top, next to the joystick.
    const placement = nodePlacement(fakeModel(), 'button_pressed_value')
    expect(placement).not.toBeNull()
    expect(placement!.center.y).toBeCloseTo(0, 6)
    expect(placement!.center.z).toBeCloseTo(0.015, 6)
  })

  it('the halo fits how bulky the part is', () => {
    const placement = nodePlacement(fakeModel(), 'button_pressed_value')
    expect(placement!.radius).toBeCloseTo(0.02 * 0.6, 6)
  })

  it('a node that is not in the model gives no placement', () => {
    expect(nodePlacement(fakeModel(), 'does_not_exist')).toBeNull()
  })

  it('nor does a node with no geometry underneath', () => {
    const root = new Group()
    const empty = new Object3D()
    empty.name = 'button_pressed_value'
    root.add(empty)
    expect(nodePlacement(root, 'button_pressed_value')).toBeNull()
  })
})

describe('on leaving, the model disposes of what is its own', () => {
  it('every geometry, every material and its textures, also with several materials and nested', () => {
    const disposed: string[] = []
    const record = (name: string) => () => disposed.push(name)
    const texture = new Texture()
    texture.addEventListener('dispose', record('texture'))
    const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: texture }))
    body.geometry.addEventListener('dispose', record('body'))
    body.material.addEventListener('dispose', record('material of the body'))
    const cap = new Mesh(new BoxGeometry(), [new MeshBasicMaterial(), new MeshBasicMaterial()])
    cap.geometry.addEventListener('dispose', record('cap'))
    for (const material of cap.material) material.addEventListener('dispose', record('material of the cap'))
    const root = new Group()
    const part = new Object3D()
    part.add(cap)
    root.add(body, part)

    disposeModel(root)

    expect(disposed.sort()).toEqual([
      'body',
      'cap',
      'material of the body',
      'material of the cap',
      'material of the cap',
      'texture',
    ])
  })
})
