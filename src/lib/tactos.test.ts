import { describe, expect, it } from 'vitest'

import { RECETAS, SIN_TENSION, pulsosDe, siguienteTension, type Pulso, type Tacto, type Tension } from './tactos'

const TODOS: Tacto[] = [
  { tipo: 'impacto', mano: 'right', fuerza: 0.5 },
  { tipo: 'llegada', mano: 'left', fuerza: 0.5 },
  { tipo: 'agarre', mano: 'right' },
  { tipo: 'suelta', mano: 'left', fuerza: 0.5 },
  { tipo: 'disparo', mano: 'right' },
  { tipo: 'golpeRecibido', fuerza: 0.5 },
]

/** Por mano, en orden de salida: ningún pulso puede empezar antes de que acabe el anterior. */
function seCortan(pulsos: Pulso[]): boolean {
  for (const mano of ['left', 'right'] as const) {
    const suyos = pulsos.filter((p) => p.mano === mano).sort((a, b) => a.retardo - b.retardo)
    for (let i = 1; i < suyos.length; i += 1) {
      if (suyos[i].retardo < suyos[i - 1].retardo + suyos[i - 1].ms) return true
    }
  }
  return false
}

describe('pulsosDe', () => {
  it('ningún suceso encadena pulsos que se corten entre sí, porque pulse() no encola', () => {
    for (const tacto of TODOS) expect(seCortan(pulsosDe(tacto)), tacto.tipo).toBe(false)
  })

  it('todo pulso se nota y ninguno pasa de 1', () => {
    for (const tacto of TODOS) {
      for (const fuerza of [0, 1]) {
        const conFuerza = 'fuerza' in tacto ? { ...tacto, fuerza } : tacto
        for (const p of pulsosDe(conFuerza as Tacto)) {
          expect(p.ms).toBeGreaterThanOrEqual(12)
          expect(p.intensidad).toBeGreaterThan(0.08 - 1e-9)
          expect(p.intensidad).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('vibra solo la mano que toca', () => {
    for (const tacto of TODOS.filter((t) => t.tipo !== 'golpeRecibido')) {
      const manos = new Set(pulsosDe(tacto).map((p) => p.mano))
      expect([...manos], tacto.tipo).toEqual(['mano' in tacto ? tacto.mano : 'right'])
    }
  })

  it('el golpe que recibe el cuerpo, en las dos manos y más largo que cualquier otro', () => {
    const golpe = pulsosDe({ tipo: 'golpeRecibido', fuerza: 0.5 })
    expect(golpe.map((p) => p.mano).sort()).toEqual(['left', 'right'])
    const otros = TODOS.filter((t) => t.tipo !== 'golpeRecibido').flatMap(pulsosDe)
    expect(Math.min(...golpe.map((p) => p.ms))).toBeGreaterThan(Math.max(...otros.map((p) => p.ms)))
  })

  it('un golpe más fuerte vibra más, y la cola es más suave que el golpe', () => {
    const flojo = pulsosDe({ tipo: 'impacto', mano: 'left', fuerza: 0.1 })
    const fuerte = pulsosDe({ tipo: 'impacto', mano: 'left', fuerza: 0.9 })
    expect(fuerte[0].intensidad).toBeGreaterThan(flojo[0].intensidad)
    expect(fuerte[1].intensidad).toBeLessThan(fuerte[0].intensidad)
    expect(fuerte[1].retardo).toBe(RECETAS.impacto.ms)
  })

  it('la fuerza fuera de 0–1 se acota', () => {
    expect(pulsosDe({ tipo: 'suelta', mano: 'left', fuerza: 3 })[0].intensidad).toBe(RECETAS.suelta.maximo)
    expect(pulsosDe({ tipo: 'llegada', mano: 'left', fuerza: -1 })[0].intensidad).toBe(RECETAS.llegada.minimo)
  })
})

describe('siguienteTension', () => {
  /** Tensa durante `ms` a un nivel fijo y devuelve los pulsos que salen. */
  function tensar(nivel: number, ms: number): Pulso[] {
    let estado: Tension = SIN_TENSION
    const pulsos: Pulso[] = []
    for (let t = 0; t <= ms; t += 1000 / 90) {
      const paso = siguienteTension(estado, 'left', nivel, t)
      estado = paso.estado
      if (paso.pulso) pulsos.push({ ...paso.pulso, retardo: t })
    }
    return pulsos
  }

  it('la cuerda en reposo no vibra', () => {
    expect(tensar(0, 1000)).toHaveLength(0)
    expect(tensar(RECETAS.tension.umbral / 2, 1000)).toHaveLength(0)
  })

  it('se siente crecer: más tensa, más pulsos y más fuertes', () => {
    const floja = tensar(0.2, 1000)
    const tensa = tensar(1, 1000)
    expect(tensa.length).toBeGreaterThan(floja.length)
    expect(tensa[0].intensidad).toBeGreaterThan(floja[0].intensidad)
  })

  it('a tope, ningún pulso corta al anterior', () => {
    expect(seCortan(tensar(1, 2000))).toBe(false)
  })

  it('soltar la cuerda vuelve a empezar: el primer pulso de la siguiente tensión sale en el acto', () => {
    const tensando = siguienteTension(SIN_TENSION, 'right', 0.5, 0)
    expect(tensando.pulso).not.toBeNull()
    const suelta = siguienteTension(tensando.estado, 'right', 0, 10)
    expect(suelta.estado).toEqual(SIN_TENSION)
    expect(siguienteTension(suelta.estado, 'right', 0.5, 20).pulso).not.toBeNull()
  })
})
