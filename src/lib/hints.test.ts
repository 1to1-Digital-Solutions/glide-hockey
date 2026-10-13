import { describe, expect, it } from 'vitest'
import {
  CRUCE,
  LATIDO,
  MAXIMO,
  MINIMO,
  acercarse,
  avanzarLasAyudas,
  ayudaEncendida,
  latido,
  pase,
  problemasDelGuion,
  sinAyudas,
  type Ayuda,
} from './ayudas'

type Hito = 'coger' | 'golpear'

const NADA = { coger: false, golpear: false }

const SUELO: Ayuda<Hito> = { id: 'suelo', hasta: 'coger', caduca: 10 }
const OBJETIVO: Ayuda<Hito> = { id: 'objetivo', hasta: 'golpear', caduca: 12, desde: 'coger' }

describe('una ayuda se apaga sola, por lo que sea', () => {
  it('se enseña de entrada, mientras no se haya hecho nada', () => {
    expect(ayudaEncendida(SUELO, NADA, 0)).toBe(true)
  })

  it('se apaga en cuanto el gesto se hace una vez, aunque le sobre plazo', () => {
    expect(ayudaEncendida(SUELO, { ...NADA, coger: true }, 0)).toBe(false)
  })

  it('y se apaga al agotarse el plazo, aunque el gesto no se haya hecho nunca', () => {
    expect(ayudaEncendida(SUELO, NADA, SUELO.caduca - 0.01)).toBe(true)
    expect(ayudaEncendida(SUELO, NADA, SUELO.caduca)).toBe(false)
  })

  it('la que espera a un hito no se enseña antes de que llegue', () => {
    expect(ayudaEncendida(OBJETIVO, NADA, 0)).toBe(false)
    expect(ayudaEncendida(OBJETIVO, { ...NADA, coger: true }, 0)).toBe(true)
  })
})

describe('el guion entero, fotograma a fotograma', () => {
  const GUION = [SUELO, OBJETIVO]

  it('dice cuáles se enseñan, por su nombre', () => {
    const estado = avanzarLasAyudas(GUION, NADA, sinAyudas(), 1)
    expect([...estado.encendidas]).toEqual(['suelo'])
  })

  it('la que espera a un hito llega con su plazo entero, no con lo que quede de tanda', () => {
    const estado = sinAyudas()
    // Veinte segundos sin coger nada: más que el plazo de la marca del objetivo.
    for (let i = 0; i < 20; i += 1) avanzarLasAyudas(GUION, NADA, estado, 1)
    expect(estado.relojes.objetivo).toBe(0)
    expect(estado.encendidas.has('objetivo')).toBe(false)

    avanzarLasAyudas(GUION, { ...NADA, coger: true }, estado, 1)
    expect(estado.encendidas.has('objetivo')).toBe(true)
  })

  it('se apagan solas al agotarse el plazo, sin haber hecho nada', () => {
    const estado = sinAyudas()
    for (let i = 0; i < 30; i += 1) avanzarLasAyudas(GUION, NADA, estado, 1)
    expect(estado.encendidas.size).toBe(0)
  })

  it('y en cuanto el gesto se hace una vez, aunque el plazo esté recién empezado', () => {
    const estado = sinAyudas()
    avanzarLasAyudas(GUION, NADA, estado, 0.1)
    expect(estado.encendidas.has('suelo')).toBe(true)
    avanzarLasAyudas(GUION, { ...NADA, coger: true }, estado, 0.1)
    expect(estado.encendidas.has('suelo')).toBe(false)
  })

  it('un fotograma que llega con el reloj hacia atrás no adelanta nada', () => {
    const estado = sinAyudas()
    avanzarLasAyudas(GUION, NADA, estado, -5)
    expect(estado.relojes.suelo).toBe(0)
  })
})

describe('nada aparece ni desaparece de golpe', () => {
  it('tarda el cruce entero en encenderse, y otro tanto en apagarse', () => {
    expect(acercarse(0, 1, CRUCE / 2)).toBeCloseTo(0.5)
    expect(acercarse(0.5, 1, CRUCE / 2)).toBeCloseTo(1)
    expect(acercarse(1, 0, CRUCE / 2)).toBeCloseTo(0.5)
  })

  it('no se pasa de largo por muy tarde que llegue el fotograma', () => {
    expect(acercarse(0, 1, 10)).toBe(1)
    expect(acercarse(1, 0, 10)).toBe(0)
  })

  it('con el reloj parado o sin cruce, salta a donde toca: un desvanecido de cero dura cero', () => {
    expect(acercarse(0, 1, 0)).toBe(0)
    expect(acercarse(0, 1, -1)).toBe(0)
    expect(acercarse(0, 1, 0.1, 0)).toBe(1)
  })
})

describe('el latido', () => {
  it('ronda el uno y no se sale de su fuerza', () => {
    const muestras = Array.from({ length: 64 }, (_, i) => latido(i / 8))
    expect(Math.min(...muestras)).toBeGreaterThanOrEqual(1 - LATIDO.fuerza)
    expect(Math.max(...muestras)).toBeLessThanOrEqual(1 + LATIDO.fuerza)
  })

  it('se queda quieto con la fuerza a cero, que es lo que pide quien no quiere movimiento', () => {
    expect(latido(3.7, 0)).toBe(1)
  })
})

describe('la demostración se repite', () => {
  it('va contando vueltas y por dónde va cada una', () => {
    expect(pase(0, 4)).toEqual({ vuelta: 0, avance: 0 })
    expect(pase(2, 4)).toEqual({ vuelta: 0, avance: 0.5 })
    expect(pase(6, 4)).toEqual({ vuelta: 1, avance: 0.5 })
  })

  it('sin periodo no hay vueltas que contar, y un reloj en negativo empieza por el principio', () => {
    expect(pase(3, 0)).toEqual({ vuelta: 0, avance: 0 })
    expect(pase(-2, 4)).toEqual({ vuelta: 0, avance: 0 })
  })
})

describe('el guardián del guion dice qué falla, no que falla', () => {
  it('da por bueno un guion sano', () => {
    expect(problemasDelGuion([SUELO, OBJETIVO])).toEqual([])
  })

  it('caza la ayuda repetida', () => {
    expect(problemasDelGuion([SUELO, SUELO])).toEqual([expect.stringContaining('dos veces')])
  })

  it('caza el plazo que se queda corto y el que no se acaba nunca', () => {
    expect(problemasDelGuion([{ ...SUELO, caduca: MINIMO - 1 }])).toEqual([
      expect.stringContaining('no da tiempo'),
    ])
    expect(problemasDelGuion([{ ...SUELO, caduca: MAXIMO + 1 }])).toEqual([
      expect.stringContaining('es decorado'),
    ])
  })

  it('caza la que se enciende y se apaga con el mismo hito', () => {
    expect(problemasDelGuion([{ ...SUELO, desde: 'coger' }])).toEqual([
      expect.stringContaining('mismo hito'),
    ])
  })

  it('y nombra la ayuda que falla, que es lo que se busca al leerlo', () => {
    const [problema] = problemasDelGuion([{ ...OBJETIVO, caduca: MAXIMO + 5 }])
    expect(problema).toContain('objetivo')
  })
})
