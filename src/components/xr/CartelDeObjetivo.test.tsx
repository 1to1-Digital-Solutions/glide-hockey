import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEGUNDOS_DE_FESTEJO, type Medalla, type VistaDelCartel } from '../../lib/objetivo'
import { PALETA } from '../../lib/paleta'
import { lienzoQueApunta } from './legibilidad'

/**
 * La celebración de un listón: del cartel y solo del cartel.
 *
 * Se monta sin Canvas —lo que se mira es cuándo avisa, qué pinta y cuánto crece—, con el
 * fotograma de three y la placa del panel sustituidos por lo que el test puede llamar a mano.
 */

const escena = vi.hoisted(() => ({
  fotograma: null as ((estado: { clock: { elapsedTime: number } }) => void) | null,
  dibujar: null as ((ctx: CanvasRenderingContext2D) => void) | null,
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (alFotograma: (estado: { clock: { elapsedTime: number } }) => void) => {
    escena.fotograma = alFotograma
  },
}))

vi.mock('./canvasPanel', async (original) => ({
  ...(await original<typeof import('./canvasPanel')>()),
  CanvasPanel: ({ draw }: { draw: (ctx: CanvasRenderingContext2D) => void }) => {
    escena.dibujar = draw
    return null
  },
}))

import { CartelDeObjetivo, DISTANCIA_DE_DIBUJO, escalaDelCartel } from './CartelDeObjetivo'

/** React DOM no conoce `<group>`: se callan sus avisos, y solo esos. */
const AVISOS_DE_THREE = ['is unrecognized in this browser', 'incorrect casing', 'React does not recognize', 'Invalid value for prop']

const VISTA: VistaDelCartel = {
  titulo: 'Silver at 16 · you have 9',
  detalle: 'Lives ♥♥♡',
  barra: 0.3,
  medalla: 'plata',
  discreto: false,
}

const DISTANCIA = 6

/** Los colores con que se ha pintado el borde: el último `strokeStyle` que quedó puesto. */
function borde(): string {
  const { ctx } = lienzoQueApunta()
  escena.dibujar!(ctx)
  return String(ctx.strokeStyle)
}

/** Cuánto mide el grupo del cartel después de ese fotograma. */
function escalaEn(contenedor: HTMLElement, segundos: number): number {
  const grupo = contenedor.querySelector('group') as unknown as { scale: { setScalar: (valor: number) => void } }
  let puesta = Number.NaN
  grupo.scale = { setScalar: (valor) => void (puesta = valor) }
  escena.fotograma!({ clock: { elapsedTime: segundos } })
  return puesta
}

function cartel(celebra: Medalla | null, alCelebrar?: (medalla: Medalla) => void) {
  return <CartelDeObjetivo vista={VISTA} position={[0, 4, -3]} distancia={DISTANCIA} celebra={celebra} alCelebrar={alCelebrar} />
}

beforeEach(() => {
  vi.useFakeTimers()
  const original = console.error
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (AVISOS_DE_THREE.some((aviso) => String(args[0]).includes(aviso))) return
    original(...args)
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('el cartel celebra el listón cruzado', () => {
  it('avisa una vez, cambia de color y vuelve solo al acabar', () => {
    const alCelebrar = vi.fn()
    const { rerender } = render(cartel(null, alCelebrar))
    expect(borde()).toBe(PALETA.borde)

    rerender(cartel('bronce', alCelebrar))

    expect(alCelebrar).toHaveBeenCalledTimes(1)
    expect(alCelebrar).toHaveBeenCalledWith('bronce')
    expect(borde()).toBe(PALETA.bronce)

    // Otro render sin cambio de medalla no repite nada.
    rerender(cartel('bronce', alCelebrar))
    expect(alCelebrar).toHaveBeenCalledTimes(1)

    act(() => void vi.advanceTimersByTime(SEGUNDOS_DE_FESTEJO * 1000 + 1))
    expect(borde()).toBe(PALETA.borde)
  })

  it('cada listón se celebra: del bronce a la plata vuelve a avisar', () => {
    const alCelebrar = vi.fn()
    const { rerender } = render(cartel(null, alCelebrar))

    rerender(cartel('bronce', alCelebrar))
    rerender(cartel('plata', alCelebrar))

    expect(alCelebrar.mock.calls).toEqual([['bronce'], ['plata']])
    expect(borde()).toBe(PALETA.plata)
  })

  it('montado con la medalla ya ganada no celebra nada: no se ha visto cruzar el listón', () => {
    const alCelebrar = vi.fn()
    render(cartel('oro', alCelebrar))

    expect(alCelebrar).not.toHaveBeenCalled()
    expect(borde()).toBe(PALETA.borde)
  })

  it('perder la medalla —otra partida— apaga la celebración sin avisar', () => {
    const alCelebrar = vi.fn()
    const { rerender } = render(cartel(null, alCelebrar))
    rerender(cartel('bronce', alCelebrar))

    rerender(cartel(null, alCelebrar))

    expect(alCelebrar).toHaveBeenCalledTimes(1)
    expect(borde()).toBe(PALETA.borde)
  })

  it('sin nadie a quien avisar, celebra igual', () => {
    const { rerender } = render(cartel(null))

    rerender(cartel('oro'))

    expect(borde()).toBe(PALETA.oro)
  })
})

describe('el pulso', () => {
  it('el cartel mide lo que pide su distancia, y al celebrar crece y vuelve', () => {
    const base = escalaDelCartel(DISTANCIA)
    const { container, rerender } = render(cartel(null))
    expect(base).toBe(DISTANCIA / DISTANCIA_DE_DIBUJO)
    expect(escalaEn(container, 10)).toBe(base)

    rerender(cartel('plata'))

    // El primer fotograma de la celebración marca el principio.
    expect(escalaEn(container, 20)).toBe(base)
    expect(escalaEn(container, 20.25)).toBeGreaterThan(base * 1.1)
    expect(escalaEn(container, 21)).toBe(base)
  })

  it('con «menos movimiento» pedido, no se mueve: solo cambia de color', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('reduce') }))
    const { container, rerender } = render(cartel(null))

    rerender(cartel('plata'))
    escalaEn(container, 20)

    expect(escalaEn(container, 20.25)).toBe(escalaDelCartel(DISTANCIA))
    expect(borde()).toBe(PALETA.plata)
  })
})
