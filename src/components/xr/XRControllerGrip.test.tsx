import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markHandBusy, releaseHands } from './busyHands'

/**
 * El mando de la web propia del juego (`XRControllerGrip`): **el rayo se apaga con la mano
 * ocupada**. Montado en el salón el mando es del hub; aquí lo dibuja este componente, y es el que
 * tiene que leer el registro de manos ocupadas (`manosOcupadas.ts`).
 *
 * Se monta sin Canvas ni sesión: la librería de XR se sustituye por piezas que apuntan con qué
 * se las llama, que es lo que se mira. Los punteros tienen que seguir ahí —el de agarre y el
 * rayo— y lo único que cambia con la mano ocupada es el dibujo del rayo y de su cursor.
 */

const rayos: Record<string, unknown>[] = []
const agarres: Record<string, unknown>[] = []

vi.mock('@react-three/xr', () => ({
  CombinedPointer: ({ children }: { children: ReactNode }) => <>{children}</>,
  DefaultXRControllerGrabPointer: (props: Record<string, unknown>) => {
    agarres.push(props)
    return null
  },
  DefaultXRInputSourceRayPointer: (props: Record<string, unknown>) => {
    rayos.push(props)
    return null
  },
  XRSpace: () => null,
  useXRInputSourceStateContext: () => ({ inputSource: { handedness: 'right' } }),
}))

const { XRControllerGrip } = await import('./XRControllerGrip')

afterEach(() => {
  cleanup()
  act(() => releaseHands())
  rayos.length = 0
  agarres.length = 0
})

describe('el mando de la web propia', () => {
  it('con la mano libre, el rayo y su cursor se dibujan', () => {
    render(<XRControllerGrip />)
    expect(rayos.at(-1)).toMatchObject({ makeDefault: true, cursorModel: true })
    expect(rayos.at(-1)?.rayModel).toBeTruthy()
    expect(agarres.length).toBeGreaterThan(0)
  })

  it('con algo en esa mano, el rayo y el cursor se apagan; al soltar vuelven', () => {
    render(<XRControllerGrip />)
    act(() => markHandBusy('right', true))
    expect(rayos.at(-1)).toMatchObject({ makeDefault: true, rayModel: false, cursorModel: false })
    act(() => markHandBusy('right', false))
    expect(rayos.at(-1)?.rayModel).toBeTruthy()
    expect(rayos.at(-1)?.cursorModel).toBe(true)
  })

  it('un juego sin puntero de agarre sigue sin él, y con su rayo', () => {
    render(<XRControllerGrip grab={false} ray={{ maxLength: 3, opacity: 0.9 }} />)
    expect(agarres).toEqual([])
    expect(rayos.at(-1)?.rayModel).toEqual({ maxLength: 3, opacity: 0.9 })
    act(() => markHandBusy('right', true))
    expect(rayos.at(-1)?.rayModel).toBe(false)
  })

  it('la otra mano ocupada no apaga el rayo de esta', () => {
    render(<XRControllerGrip />)
    act(() => markHandBusy('left', true))
    expect(rayos.at(-1)?.rayModel).toBeTruthy()
  })
})
