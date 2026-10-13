import { describe, expect, it } from 'vitest'
import {
  contraste,
  materialEncendido,
  materialMate,
  materialTranslucido,
  PALETA,
  type ColorComun,
} from './paleta'

/** Lo que se escribe como texto sobre un panel: tiene que dar el contraste de texto normal. */
const SE_ESCRIBEN: ColorComun[] = [
  'acierto',
  'fallo',
  'aviso',
  'texto',
  'textoSuave',
  'acento',
  'bronce',
  'plata',
  'oro',
]

describe('la paleta común', () => {
  it('son todos #rrggbb en minúsculas, que es lo que leen igual el CSS, three y Godot', () => {
    for (const color of Object.values(PALETA)) expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('no repite colores: dos significados con el mismo color no se distinguen', () => {
    const colores = Object.values(PALETA)
    expect(new Set(colores).size).toBe(colores.length)
  })

  it('todo lo que se escribe se lee sobre el fondo del salón (WCAG AA, 4,5:1)', () => {
    for (const nombre of SE_ESCRIBEN) {
      expect(contraste(PALETA[nombre], PALETA.fondo), nombre).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('el texto principal pasa de AAA (7:1): es el que se lee a un brazo de distancia', () => {
    expect(contraste(PALETA.texto, PALETA.fondo)).toBeGreaterThanOrEqual(7)
  })

  it('el borde se distingue del fondo sin llegar a competir con lo que está escrito', () => {
    const borde = contraste(PALETA.borde, PALETA.fondo)
    expect(borde).toBeGreaterThan(1.2)
    expect(borde).toBeLessThan(contraste(PALETA.textoSuave, PALETA.fondo))
  })

  it('acierto y fallo se distinguen por luz, sin ver el color', () => {
    // Para quien no separa el rojo del verde lo único que queda es cuánto brilla cada uno.
    expect(contraste(PALETA.acierto, PALETA.fallo)).toBeGreaterThanOrEqual(1.8)
  })

  it('las medallas son las del salón, para que la chapa del juego y la de la cabina coincidan', () => {
    // Copiadas de `MEDAL_COLORS` (`xrcade/src/components/salon/theme.ts`).
    expect([PALETA.bronce, PALETA.plata, PALETA.oro]).toEqual(['#e39a64', '#d3d9e6', '#f6c945'])
  })
})

describe('el contraste', () => {
  it('va de 1 (el mismo color) a 21 (negro sobre blanco), en cualquier orden', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contraste('#7ae582', '#7ae582')).toBe(1)
  })

  it('coincide con la cifra de WCAG en un caso conocido', () => {
    // #767676 sobre blanco es el gris más claro que da 4,5:1.
    expect(contraste('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('no adivina colores que no son #rrggbb', () => {
    expect(() => contraste('red', '#000000')).toThrow(/#rrggbb/)
    expect(() => contraste('#fff', '#000000')).toThrow(/#rrggbb/)
  })
})

describe('los materiales base', () => {
  it('el mate no brilla ni es metal', () => {
    expect(materialMate(PALETA.acierto)).toEqual({ color: '#7ae582', roughness: 1, metalness: 0 })
  })

  it('el encendido enseña el color tal cual, sin la curva de tono de la escena', () => {
    expect(materialEncendido(PALETA.fallo)).toEqual({ color: '#ff5a4f', toneMapped: false })
  })

  it('el translúcido nunca escribe profundidad, que borraría lo que tiene detrás', () => {
    expect(materialTranslucido(PALETA.acierto, 0.5)).toEqual({
      color: '#7ae582',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    })
    expect(materialTranslucido(PALETA.acierto, 0).opacity).toBe(0)
    expect(materialTranslucido(PALETA.acierto, 1).opacity).toBe(1)
  })

  it('el translúcido no acepta una opacidad fuera de [0, 1]', () => {
    expect(() => materialTranslucido(PALETA.acierto, -0.1)).toThrow(RangeError)
    expect(() => materialTranslucido(PALETA.acierto, 1.5)).toThrow(RangeError)
    expect(() => materialTranslucido(PALETA.acierto, Number.NaN)).toThrow(RangeError)
  })

  it('cada llamada da un objeto nuevo: extenderlo sobre un material no toca el de al lado', () => {
    expect(materialMate(PALETA.oro)).not.toBe(materialMate(PALETA.oro))
  })
})
