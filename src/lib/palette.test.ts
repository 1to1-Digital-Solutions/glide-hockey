import { describe, expect, it } from 'vitest'
import { GLIDE_HOCKEY_CSS_VARIABLES, DIFFICULTY_COLORS, PALETTE } from './palette'
import { DIFFICULTY_ORDER } from './gameConfig'

/**
 * La paleta es el único sitio donde se escribe un color del juego, porque los
 * piden tres capas que no se hablan: el CSS de las pantallas, la escena de
 * three y la interfaz del visor, que no tiene CSS del que tirar.
 *
 * Lo que se comprueba aquí es que sigan siendo colores que las tres saben leer,
 * que las variables CSS salgan de la misma paleta y no de literales escritos
 * otra vez, y que cada dificultad tenga el suyo.
 */

const HEX = /^#[0-9a-f]{6}$/i

describe('los colores del juego', () => {
  it('todos son hexadecimales de seis cifras', () => {
    // Es el único formato que entienden a la vez el CSS y three: un `rgb()` o
    // un nombre CSS se quedaría en negro dentro de la escena.
    for (const [name, value] of Object.entries(PALETTE)) {
      if (typeof value === 'string') expect(value, name).toMatch(HEX)
    }
  })

  it('el fondo y el texto no son el mismo color', () => {
    expect(PALETTE.background).not.toBe(PALETTE.foreground)
  })
})

describe('el color de cada dificultad', () => {
  it('están todas, y ninguna repite color', () => {
    // Es lo que distingue de un vistazo el nivel elegido: dos iguales dejarían
    // la elección sin señal.
    const colores = DIFFICULTY_ORDER.map((id) => DIFFICULTY_COLORS[id])

    expect(colores).toHaveLength(DIFFICULTY_ORDER.length)
    for (const color of colores) expect(color).toMatch(HEX)
    expect(new Set(colores).size).toBe(colores.length)
  })
})

describe('las variables CSS del juego', () => {
  it('salen de la paleta, no de colores escritos otra vez', () => {
    // Escritos a mano en cada capa se desvían sin que nadie lo decida, que es
    // justo lo que este módulo existe para evitar.
    const valores = Object.values(GLIDE_HOCKEY_CSS_VARIABLES) as string[]
    const paleta = new Set<string>(Object.values(PALETTE))

    expect(valores.length).toBeGreaterThan(0)
    for (const valor of valores) expect(paleta.has(valor)).toBe(true)
  })

  it('todas se llaman como variables CSS', () => {
    for (const name of Object.keys(GLIDE_HOCKEY_CSS_VARIABLES)) {
      expect(name).toMatch(/^--[a-z-]+$/)
    }
  })
})
