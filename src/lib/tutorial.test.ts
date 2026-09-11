import { describe, expect, it } from 'vitest'
import {
  TUTORIAL_MAX_SECONDS,
  TUTORIAL_MIN_SECONDS,
  TUTORIAL_SECONDS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialFrameAt,
  tutorialSeen,
} from './tutorial'

/** Un almacenamiento de mentira, con lo justo. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  } as unknown as Storage
}

/** Uno que lanza al tocarlo, como el de un navegador en modo privado. */
const roto = {
  getItem() {
    throw new Error('bloqueado')
  },
  setItem() {
    throw new Error('bloqueado')
  },
} as unknown as Storage

describe('el guion', () => {
  it('dura lo que se puede aguantar antes de tirar', () => {
    // El tope no es decorativo: alargar un tramo obliga a acortar otro, en vez de ir
    // estirando la demostración sin que nadie lo note.
    expect(TUTORIAL_SECONDS).toBeGreaterThanOrEqual(TUTORIAL_MIN_SECONDS)
    expect(TUTORIAL_SECONDS).toBeLessThanOrEqual(TUTORIAL_MAX_SECONDS)
  })

  it('dedica más tiempo a tensar que a nada más', () => {
    // Es el único tramo que hay que ver *pasar*: si la cuerda no recorre el camino
    // entero, no se entiende que aguantar sirva de algo.
    const tensar = TUTORIAL_STEPS.find((s) => s.key === 'draw')!
    for (const otro of TUTORIAL_STEPS) {
      if (otro.key !== 'draw') expect(tensar.seconds).toBeGreaterThan(otro.seconds)
    }
  })

  it('enseña el gesto entero: de qué mano, tensar y soltar', () => {
    expect(TUTORIAL_STEPS.map((s) => s.key)).toEqual(['hand', 'draw', 'release'])
  })
})

describe('tutorialFrameAt', () => {
  it('empieza por el primer tramo', () => {
    const frame = tutorialFrameAt(0)
    expect(frame.step).toBe('hand')
    expect(frame.stepProgress).toBe(0)
    expect(frame.done).toBe(false)
  })

  it('recorre los tramos en orden', () => {
    const vistos = new Set<string | null>()
    for (let t = 0; t < TUTORIAL_SECONDS; t += 0.1) vistos.add(tutorialFrameAt(t).step)
    expect([...vistos]).toEqual(['hand', 'draw', 'release'])
  })

  it('cada tramo avanza de cero a uno', () => {
    const draw = TUTORIAL_STEPS[0].seconds
    expect(tutorialFrameAt(draw).stepProgress).toBeCloseTo(0)
    expect(tutorialFrameAt(draw + TUTORIAL_STEPS[1].seconds - 0.001).stepProgress).toBeCloseTo(1, 2)
  })

  it('pasado el final no queda nada que enseñar', () => {
    expect(tutorialFrameAt(TUTORIAL_SECONDS).done).toBe(true)
    expect(tutorialFrameAt(TUTORIAL_SECONDS + 100).step).toBeNull()
  })

  it('aguanta un reloj que se vuelve loco', () => {
    // El reloj lo lleva el fotograma: un salto raro no puede dejar la demostración
    // colgada tapando el juego.
    expect(tutorialFrameAt(Number.NaN).done).toBe(true)
    expect(tutorialFrameAt(Number.POSITIVE_INFINITY).done).toBe(true)
    expect(tutorialFrameAt(-5).step).toBe('hand')
  })
})

describe('si ya se ha visto', () => {
  it('se enseña la primera vez y no la segunda', () => {
    const storage = almacen()
    expect(tutorialSeen(storage)).toBe(false)

    markTutorialSeen(storage)
    expect(tutorialSeen(storage)).toBe(true)
  })

  it('lo guardado es la versión de la lección, no un sí', () => {
    // Por eso subirla la vuelve a enseñar: quien aprendió el gesto del gatillo tiene que
    // volver a verla ahora que lo que se aprieta es el botón de agarre.
    const storage = almacen()
    markTutorialSeen(storage)
    const guardado = storage.getItem(TUTORIAL_SEEN_KEY)

    expect(guardado).not.toBe('1')
    expect(tutorialSeen(almacen({ [TUTORIAL_SEEN_KEY]: '1' }))).toBe(false)
  })

  it('un valor raro lo vuelve a enseñar', () => {
    expect(tutorialSeen(almacen({ [TUTORIAL_SEEN_KEY]: 'sí' }))).toBe(false)
  })

  it('sin almacenamiento se enseña: ver de más es mejor que no entender', () => {
    expect(tutorialSeen(null)).toBe(false)
    expect(tutorialSeen(roto)).toBe(false)
    expect(markTutorialSeen(null)).toBe(false)
    expect(markTutorialSeen(roto)).toBe(false)
  })
})
