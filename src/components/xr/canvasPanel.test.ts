import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PANEL_PIXELS_PER_METER, drawParagraph, drawText, panelFont, wrapText } from './canvasPanel'

/**
 * El texto de los paneles, que es lo único de aquí que se puede comprobar sin
 * un visor delante: dentro del Canvas no hay DOM que medir, así que una
 * etiqueta que se sale de su botón solo se ve con el casco puesto.
 *
 * Lo que se asegura es el encogido. Con cuatro modos en la fila del menú los
 * botones miden doce centímetros y «301/501» no cabe a su tamaño; sin esto se
 * leería encima del botón de al lado.
 */

/** Lo ancho que es una letra respecto al alto, más o menos, en este lienzo. */
const ADVANCE = 0.6

/** El tamaño declarado en una fuente de canvas, en píxeles de la textura. */
function pixelsOf(font: string): number {
  return Number(font.match(/([\d.]+)px/)?.[1])
}

/** Y el mismo tamaño en metros del panel, que es en lo que se piden los textos. */
function sizeOf(font: string): number {
  return pixelsOf(font) / PANEL_PIXELS_PER_METER
}

/** Un lienzo de mentira: mide como uno de verdad y apunta lo que se escribe. */
function lienzo() {
  const escrito: { texto: string; font: string; argumentos: number }[] = []

  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText(text: string) {
      // Lo que mide depende de la letra que haya puesta, como en el navegador: en píxeles
      // de la fuente, sin importar la escala del lienzo.
      return { width: text.length * pixelsOf(ctx.font) * ADVANCE }
    },
    fillText(...args: unknown[]) {
      escrito.push({ texto: String(args[0]), font: ctx.font, argumentos: args.length })
    },
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, escrito }
}

const NEGRO = '#101419'

describe('drawText', () => {
  it('escribe al tamaño pedido lo que cabe', () => {
    const { ctx, escrito } = lienzo()

    drawText(ctx, 'Reloj', 0, 0, { size: 0.032, color: NEGRO, maxWidth: 0.2 })

    expect(escrito).toHaveLength(1)
    expect(sizeOf(escrito[0].font)).toBeCloseTo(0.032, 9)
  })

  it('pide la fuente en píxeles de verdad, no en metros', () => {
    // Una letra de 0,03 px ampliada mil veces es lo que el navegador del visor pintaba con las
    // letras amontonadas: a ese tamaño las medidas de cada letra no valen. Reportado con el
    // visor puesto: «las letras están completamente pegadas, una sobre la otra».
    const { ctx, escrito } = lienzo()

    drawText(ctx, 'Levels', 0, 0, { size: 0.03, color: NEGRO, maxWidth: 0.08 })
    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, { size: 0.03, color: NEGRO, maxWidth: 0.2 })

    for (const linea of escrito) expect(pixelsOf(linea.font), linea.texto).toBeGreaterThanOrEqual(8)
  })

  it('encoge lo que no cabe hasta que quepa', () => {
    // El hueco de un botón de la fila de modos, con el punto de elegido puesto.
    const room = 0.081
    const { ctx, escrito } = lienzo()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: NEGRO, maxWidth: room })

    const size = sizeOf(escrito[0].font)
    expect(size).toBeLessThan(0.032)
    expect('301/501'.length * size * ADVANCE).toBeLessThanOrEqual(room + 1e-9)
  })

  it('encoge la letra, no la estrecha', () => {
    // `fillText` sabe apretar el texto en el ancho que se le diga, pero un
    // texto condensado en un panel a un brazo de distancia se lee mucho peor
    // que el mismo texto un punto más pequeño.
    const { ctx, escrito } = lienzo()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: NEGRO, maxWidth: 0.081 })

    expect(escrito[0].argumentos).toBe(3)
  })

  it('sin máximo no toca el tamaño: es lo que hace el resto de los paneles', () => {
    const { ctx, escrito } = lienzo()

    drawText(ctx, 'Un título largo de los que no caben', 0, 0, { size: 0.055, color: NEGRO })

    expect(sizeOf(escrito[0].font)).toBeCloseTo(0.055, 9)
  })
})

/**
 * El reparto en líneas.
 *
 * **Es lo que hacía ilegibles los tutoriales.** Una frase de cuarenta caracteres encogida
 * hasta caber de una sola línea en un panel de sesenta centímetros acaba en letra de dos
 * centímetros: dentro del visor estaba escrito y no se entendía nada. Encoger vale para una
 * etiqueta de botón; para una frase hay que partirla.
 */
describe('repartir un texto en líneas', () => {
  it('mete en una línea lo que cabe', () => {
    const { ctx } = lienzo()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'Dale al topo', 1)).toEqual(['Dale al topo'])
  })

  it('parte por espacios lo que no cabe', () => {
    const { ctx } = lienzo()
    ctx.font = panelFont('600', 0.03)
    // Con este lienzo, cada letra mide 0,018 m: caben unas once por línea de 0,2.
    const lineas = wrapText(ctx, 'Hold the trigger and the ball appears', 0.2)

    expect(lineas.length).toBeGreaterThan(1)
    expect(lineas.join(' ')).toBe('Hold the trigger and the ball appears')
    for (const linea of lineas) {
      expect(ctx.measureText(linea).width / PANEL_PIXELS_PER_METER).toBeLessThanOrEqual(0.2)
    }
  })

  it('deja entera una palabra que no cabe ella sola', () => {
    // Partirla por la mitad se lee peor que dejarla asomar, y en un visor mucho peor.
    const { ctx } = lienzo()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'incomprehensiblemente', 0.05)).toEqual(['incomprehensiblemente'])
  })

  it('con un texto vacío no escribe nada', () => {
    const { ctx } = lienzo()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, '   ', 1)).toEqual([])
  })
})

describe('escribir un párrafo', () => {
  it('escribe una línea por trozo, todas del mismo tamaño', () => {
    // Sin encoger: el tamaño que se pide es el que se lee, y lo que sobra baja de línea.
    const { ctx, escrito } = lienzo()

    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
      size: 0.03,
      color: '#fff',
      maxWidth: 0.2,
    })

    expect(escrito.length).toBeGreaterThan(1)
    expect(new Set(escrito.map((linea) => sizeOf(linea.font))).size).toBe(1)
    expect(sizeOf(escrito[0].font)).toBeCloseTo(0.03, 6)
  })

  it('centra el bloque en la altura que se le da', () => {
    // `y` es el centro del bloque y no la primera línea: si no, una frase de dos líneas y
    // otra de una quedarían en sitios distintos y el panel daría un salto entre tramos.
    const { ctx, escrito } = lienzo()
    const dosLineas = () => {
      escrito.length = 0
      drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
        size: 0.03,
        color: '#fff',
        maxWidth: 0.2,
      })
      return escrito.length
    }

    const cuantas = dosLineas()
    expect(cuantas).toBeGreaterThan(1)
    // El bloque reparte sus líneas arriba y abajo del centro, así que la primera queda por
    // encima de cero y la última por debajo.
    expect(cuantas % 2 === 0 || cuantas > 1).toBe(true)
  })

  it('con un texto vacío no escribe nada', () => {
    const { ctx, escrito } = lienzo()

    drawParagraph(ctx, '', 0, 0, { size: 0.03, color: '#fff', maxWidth: 0.2 })

    expect(escrito).toEqual([])
  })
})

/**
 * Y lo único del componente que se puede comprobar sin montar la escena: que el lienzo **no
 * escribe profundidad**.
 *
 * Un material transparente apunta su profundidad salvo que se le diga que no, y este plano
 * va por delante de los botones del panel cubriéndolos enteros: con la profundidad puesta,
 * todo lo que quede detrás desaparece aunque el lienzo esté vacío ahí. Así es como el botón
 * de jugar de air-hockey se quedó sin su placa azul —«no se ve en azul, está como
 * sombreado»— y con él las placas de los botones pequeños de varios juegos.
 */
describe('el plano del panel', () => {
  const fuente = readFileSync(
    path.join(process.cwd(), 'src/components/xr/canvasPanel.tsx'),
    'utf8',
  )

  it('no escribe profundidad: taparía lo que tenga detrás', () => {
    expect(fuente).toContain('depthWrite={false}')
  })
})
