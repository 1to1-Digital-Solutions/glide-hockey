import { describe, expect, it } from 'vitest'
import {
  DISTANCIA_DE_DIBUJO,
  LETRA_DEL_CARTEL,
  PANEL_DEL_CARTEL,
  dibujarElCartel,
  escalaDelCartel,
  proporcionDelCartel,
} from './CartelDeObjetivo'
import { ALTO_DE_LINEA } from './canvasPanel'
import { MIN_ANGULO, altoMinimo, lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import {
  OBJETIVO_ES,
  cartelDeObjetivo,
  type Objetivo,
  type Partida,
  type Traducir,
  type VistaDelCartel,
} from '../../lib/objetivo'

/**
 * El cartel del objetivo, medido en vez de mirado.
 *
 * Es el mismo test en todos los juegos del salón: mide las frases comunes del cartel, en los dos
 * idiomas, a más y a menos, en cada fase. **La misión y lo que queda son de cada juego**, así que
 * cada uno mide además las suyas, con su traductor, igual que aquí:
 *
 *     const { ctx, escritos } = lienzoQueApunta()
 *     dibujarElCartel(ctx, cartelDeObjetivo(partida, t))
 *     expect(problemasDeLegibilidad(escritos, { panel: PANEL_DEL_CARTEL, distancia: DISTANCIA_DE_DIBUJO })).toEqual([])
 *
 * Se mide a la distancia de dibujo: el cartel se agranda con la distancia de verdad, así que lo
 * que ocupa en el ojo es lo mismo a dos metros que a veinte.
 */

const en: Traducir = (clave, valores) =>
  valores === undefined ? clave : clave.replace(/\{(\w+)\}/g, (_, hueco: string) => String(valores[hueco]))
const es: Traducir = (clave, valores) => en((OBJETIVO_ES as Record<string, string>)[clave] ?? clave, valores)
const IDIOMAS = { en, es }

/** Con cifras de tres dígitos, que es cuando más ocupa. */
const A_MAS: Objetivo = {
  medallas: { bronce: 120, plata: 260, oro: 400 },
  mejorEs: 'mas',
  unidad: 'points in challenge',
  record: 520,
  modo: 'reto',
}
const A_MENOS: Objetivo = {
  medallas: { bronce: 135, plata: 127, oro: 123 },
  mejorEs: 'menos',
  unidad: 'strokes on the round',
  record: 119,
  modo: 'reto',
}

/** Con listones de miles: las cifras más largas que llega a escribir un juego del salón. */
const DE_MILES: Objetivo = {
  medallas: { bronce: 1500, plata: 8000, oro: 20000 },
  mejorEs: 'mas',
  unidad: 'points in challenge',
  record: 104250,
  modo: 'reto',
}

const base = { mision: 'Score until you miss 3 times', queda: 'Lives ♥♥♡ · 0:47' }

/** Cada cosa que el cartel llega a decir: cada fase, cada listón, con récord y sin él. */
function partidas(): Partida[] {
  const todas: Partida[] = []
  for (const objetivo of [A_MAS, A_MENOS, { ...A_MAS, record: null }, { ...A_MENOS, record: null }]) {
    todas.push({ ...base, objetivo, fase: 'antes', puntos: 0 })
    for (const puntos of [0, 118, 125, 130, 200, 300, 450, 519, 999]) {
      todas.push({ ...base, objetivo, fase: 'jugando', puntos })
      todas.push({ ...base, objetivo, fase: 'final', puntos })
    }
    todas.push({ ...base, objetivo, fase: 'jugando', puntos: 0, cuenta: false, modo: 'One minute' })
  }
  for (const objetivo of [DE_MILES, { ...DE_MILES, record: null }]) {
    todas.push({ ...base, objetivo, fase: 'antes', puntos: 0 })
    for (const puntos of [0, 1450, 7900, 19950, 20000, 103900, 104250, 188800]) {
      todas.push({ ...base, objetivo, fase: 'jugando', puntos })
      todas.push({ ...base, objetivo, fase: 'final', puntos })
    }
  }
  for (const record of [null, 520]) {
    for (const fase of ['antes', 'jugando', 'final'] as const) {
      todas.push({ ...base, fase, puntos: 480, record })
      todas.push({ ...base, fase, puntos: 480, record, mejorEs: 'menos' })
    }
  }
  return todas
}

function medir(vista: VistaDelCartel, festejo: Parameters<typeof dibujarElCartel>[2] = null): Escrito[] {
  const { ctx, escritos } = lienzoQueApunta()
  dibujarElCartel(ctx, vista, festejo)
  return escritos
}

/** Cuántos grados ocupa en el ojo la letra de un texto, a la distancia de dibujo. */
function grados(escrito: Escrito): number {
  return (2 * Math.atan(escrito.alto / ALTO_DE_LINEA / (2 * DISTANCIA_DE_DIBUJO)) * 180) / Math.PI
}

describe('el cartel del objetivo se lee', () => {
  it('en cada fase, a más y a menos, con salón y sin él, en los dos idiomas', () => {
    for (const [idioma, t] of Object.entries(IDIOMAS)) {
      for (const partida of partidas()) {
        const vista = cartelDeObjetivo(partida, t)
        const escritos = medir(vista)
        expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
        expect(
          problemasDeLegibilidad(escritos, { panel: PANEL_DEL_CARTEL, distancia: DISTANCIA_DE_DIBUJO }),
          `${idioma}: ${vista.titulo} / ${vista.detalle}`,
        ).toEqual([])
      }
    }
  })

  it('y mientras celebra un listón, que solo cambia el color', () => {
    const vista = cartelDeObjetivo({ ...base, objetivo: A_MAS, fase: 'jugando', puntos: 260 }, es)

    expect(medir(vista, 'plata')).toEqual(medir(vista))
  })

  it('nunca escribe más de dos líneas', () => {
    for (const partida of partidas()) expect(medir(cartelDeObjetivo(partida, es)).length).toBeLessThanOrEqual(2)
  })

  it('la frase de jugar se lee de un vistazo: casi el doble del mínimo, sin encoger', () => {
    const [titulo, detalle] = medir(cartelDeObjetivo({ ...base, objetivo: A_MAS, fase: 'jugando', puntos: 130 }, es))

    expect(titulo.texto).toBe('Plata a 260 · llevas 130')
    expect(grados(titulo)).toBeCloseTo(1.4, 1)
    expect(grados(detalle)).toBeCloseTo(1.2, 1)
    expect(LETRA_DEL_CARTEL.titulo).toBeGreaterThan(altoMinimo(DISTANCIA_DE_DIBUJO) * 1.8)
  })

  it('con listones de miles apenas encoge: «Oro a 20.000 · llevas 19.950» sigue por encima de 1,2°', () => {
    const [titulo] = medir(cartelDeObjetivo({ ...base, objetivo: DE_MILES, fase: 'jugando', puntos: 19950 }, es))

    expect(titulo.texto).toBe('Oro a 20.000 · llevas 19.950')
    expect(grados(titulo)).toBeGreaterThan(1.2)
  })

  it('una frase larga encoge hasta caber, sin bajar del mínimo que se lee', () => {
    const [titulo] = medir(
      cartelDeObjetivo({ ...base, objetivo: A_MENOS, fase: 'jugando', puntos: 121 }, es),
    )

    expect(titulo.texto).toBe('Oro con 123 o menos · llevas 121')
    expect(grados(titulo)).toBeLessThan(1.4)
    expect(grados(titulo)).toBeGreaterThan(MIN_ANGULO)
  })

  it('una sola línea queda centrada; con la barra, todo cabe dentro del panel', () => {
    const [sola] = medir(cartelDeObjetivo({ ...base, objetivo: A_MAS, fase: 'jugando', puntos: 0, cuenta: false }, en))

    expect(sola.y).toBeCloseTo(0)

    const [titulo, detalle] = medir(cartelDeObjetivo({ ...base, objetivo: A_MAS, fase: 'jugando', puntos: 130 }, en))
    expect(titulo.y).toBeGreaterThan(detalle.y)
    expect(detalle.y - detalle.alto / 2).toBeGreaterThan(-PANEL_DEL_CARTEL.height / 2)
  })
})

describe('el tamaño del cartel', () => {
  it('crece con la distancia: ocupa lo mismo en el ojo a dos metros que a veinte', () => {
    expect(escalaDelCartel(DISTANCIA_DE_DIBUJO)).toBe(1)
    expect(escalaDelCartel(20)).toBe(20 / DISTANCIA_DE_DIBUJO)

    const { ancho, alto } = proporcionDelCartel()
    for (const distancia of [2, 7.75, 20]) {
      expect(PANEL_DEL_CARTEL.width * escalaDelCartel(distancia)).toBeCloseTo(ancho * distancia)
      expect(PANEL_DEL_CARTEL.height * escalaDelCartel(distancia)).toBeCloseTo(alto * distancia)
    }
  })

  it('no pasa de 24° de ancho ni de 4,5° de alto: no tapa el juego', () => {
    const angulo = (metros: number) => (2 * Math.atan(metros / (2 * DISTANCIA_DE_DIBUJO)) * 180) / Math.PI

    expect(angulo(PANEL_DEL_CARTEL.width)).toBeLessThanOrEqual(24.01)
    expect(angulo(PANEL_DEL_CARTEL.height)).toBeLessThanOrEqual(4.51)
  })
})
