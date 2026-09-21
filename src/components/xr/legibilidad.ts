/**
 * Comprobar que un panel del visor **se lee**.
 *
 * Es la respuesta a lo que más se repite en el feedback del visor: «el texto se
 * superpone», «las letras están muy pegadas», «no se entiende nada». Ha pasado en
 * el aviso de salir, en los menús de ajustes, en el marcador y en los tutoriales,
 * y siempre se ha descubierto igual: con las gafas puestas. Desde una pantalla no
 * se ve, porque el panel se pinta en un lienzo que nadie mira al tamaño al que se
 * lee.
 *
 * Así que aquí no hay un recordatorio, hay un instrumento: un lienzo de mentira
 * que **mide como uno de verdad y apunta lo que se escribe**, y una revisión de
 * lo apuntado. Cada panel tiene su test, y el test falla si dos textos se pisan,
 * si alguno se sale del panel o si alguno es más pequeño de lo que se lee a la
 * distancia a la que está.
 *
 * Todo en metros, que es como están escritas las medidas de los paneles.
 */

import { ALTO_DE_LINEA } from './canvasPanel'

/**
 * Lo ancho que es una letra respecto a su alto, en la tipografía del sistema.
 *
 * Tirando a ancho a propósito. La medida de verdad depende de la letra —una «i» no ocupa lo
 * que una «M»— y aquí no hay tipografía que preguntar. Quedándose corto, la regla daría por
 * bueno un panel que en el visor se pisa, que es justo lo que ha estado pasando; pasándose,
 * como mucho obliga a dejar un dedo más de aire.
 */
const AVANCE = 0.62

/**
 * Lo más pequeña que puede verse una letra, en **grados** de ángulo visual.
 *
 * **Antes era una medida en metros, y en metros no se lee.** Lo que decide si una letra se
 * lee no es lo que mide, es lo que ocupa en el ojo: los mismos cuatro milímetros son una
 * mancha en un panel a metro y medio y se leen de sobra en uno a un palmo. El suelo estaba
 * puesto en 4 mm —0,23° a un metro, que es lo que un ojo sano **distingue**, parado y con
 * buena luz, no lo que alguien lee de un vistazo mientras juega—, así que el instrumento
 * daba por bueno lo que dentro del visor es una mancha. Reportado así: «la mayoría de los
 * textos de dentro de los juegos se solapan y no son legibles».
 *
 * Tres cuartos de grado es la altura de una letra cómoda de leer sin acercarse. Los botones
 * de los menús se pintan a 25 mm y los paneles están a metro y pico —1,2° de sobra—, así
 * que esto no aprieta lo que está bien: caza lo que `drawText` **encoge para que quepa** en
 * un botón demasiado estrecho, que es donde salían letras de 8 mm.
 */
export const MIN_ANGULO = 0.75

/**
 * A qué distancia se mira un panel cuando quien lo mide no dice otra cosa, en metros.
 *
 * Es donde están los paneles de casi todos: delante, a metro y pico. Los juegos de mesa
 * —la torre de tower-tumble— los tienen mucho más cerca y lo dicen al medir.
 */
export const DISTANCIA_TIPICA = 1.2

/** Lo más pequeña que puede salir una letra en un panel a esa distancia, en metros. */
export function altoMinimo(distancia: number): number {
  return 2 * distancia * Math.tan((MIN_ANGULO * Math.PI) / 180 / 2)
}

/**
 * La fuente más pequeña que se le puede pedir al lienzo, en píxeles.
 *
 * No es lo que se lee —eso lo dice `altoMinimo`, en metros—, es lo que el navegador sabe colocar:
 * por debajo de unos pocos píxeles calcula la posición de cada letra con medidas que no valen, y
 * el del visor las amontona. Los paneles pedían la letra en metros sobre un lienzo escalado, a
 * 0,03 px, y así se vieron: «las letras están completamente pegadas, una sobre la otra».
 */
export const MIN_FUENTE_PX = 8

/** Un texto que se ha escrito en el panel: qué, dónde y qué caja ocupa. */
export interface Escrito {
  readonly texto: string
  /** El centro de su caja, en coordenadas del panel. */
  readonly x: number
  readonly y: number
  readonly ancho: number
  readonly alto: number
  /** El tamaño de la fuente con que se pidió, en píxeles del lienzo. */
  readonly fuentePx?: number
}

/** Si dos cajas se pisan. */
function seTocan(a: Escrito, b: Escrito): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho &&
    Math.abs(a.y - b.y) * 2 < a.alto + b.alto
  )
}

/**
 * Un lienzo de mentira: mide como uno de verdad y apunta lo que se escribe.
 *
 * Lleva la cuenta de la transformación —los paneles escriben con `translate` y
 * un `scale(1, -1)` para deshacer la `y` hacia abajo—, así que lo apuntado está
 * ya en coordenadas del panel y no en las del lienzo.
 */
export function lienzoQueApunta(): { ctx: CanvasRenderingContext2D; escritos: Escrito[] } {
  const escritos: Escrito[] = []
  // `escala` es cuánto mide una unidad del lienzo en coordenadas del panel. Los paneles dibujan
  // en metros y escriben el texto a su tamaño en píxeles (`panelFont`), así que dentro de
  // `drawText` una unidad es un píxel de la textura y lo apuntado se pasa a metros con ella.
  let estado = { x: 0, y: 0, escala: 1, escalaY: 1, font: '' }
  const pila: (typeof estado)[] = []

  /** El tamaño declarado en la fuente, en unidades del lienzo (píxeles para el texto). */
  const tamano = (): number => {
    const medida = /([\d.]+)px/.exec(estado.font)
    return medida == null ? 0 : Number(medida[1])
  }

  const ctx = {
    get font() {
      return estado.font
    },
    set font(valor: string) {
      estado.font = valor
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    save: () => {
      pila.push({ ...estado })
    },
    restore: () => {
      estado = pila.pop() ?? estado
    },
    translate: (x: number, y: number) => {
      estado = { ...estado, x: estado.x + x * estado.escala, y: estado.y + y * estado.escalaY }
    },
    scale: (x: number, y: number) => {
      estado = { ...estado, escala: estado.escala * Math.abs(x), escalaY: estado.escalaY * y }
    },
    measureText: (texto: string) => ({ width: texto.length * tamano() * AVANCE }),
    // La `y` que llega es siempre 0: los paneles la ponen con `translate` antes de
    // escribir, que es lo que este lienzo lleva apuntado.
    fillText: (texto: string, x: number) => {
      const alto = tamano() * estado.escala
      const ancho = texto.length * alto * AVANCE
      const origen = estado.x + x * estado.escala
      const centro =
        ctx.textAlign === 'left'
          ? origen + ancho / 2
          : ctx.textAlign === 'right'
            ? origen - ancho / 2
            : origen
      escritos.push({ texto, x: centro, y: estado.y, ancho, alto: alto * ALTO_DE_LINEA, fuentePx: tamano() })
    },
    // Devolver la transformación a la de partida es lo único que se sigue de
    // las formas: lo escrito después va en las coordenadas del lienzo, no en las
    // del trozo que se estuviera pintando.
    setTransform: () => {
      estado = { ...estado, x: 0, y: 0, escala: 1, escalaY: 1 }
    },
    // Lo demás que dibuja formas no se apunta: aquí se revisa el texto.
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, escritos }
}

/** Un panel, para saber si algo se sale. */
export interface Panel {
  readonly width: number
  readonly height: number
}

/**
 * Qué está mal en lo escrito. Lista vacía es que se lee.
 *
 * Devuelve frases y no un `false` porque un test que dice «el panel no se lee» no
 * sirve de nada: hay que saber **qué** palabra se pisa con cuál.
 */
export function problemasDeLegibilidad(
  escritos: readonly Escrito[],
  {
    panel,
    distancia = DISTANCIA_TIPICA,
    minAlto = altoMinimo(distancia),
  }: { panel: Panel; distancia?: number; minAlto?: number },
): string[] {
  const problemas: string[] = []

  for (const escrito of escritos) {
    if (escrito.fuentePx != null && escrito.fuentePx < MIN_FUENTE_PX) {
      problemas.push(
        `«${escrito.texto}» se pide a ${escrito.fuentePx.toFixed(2)} px: por debajo de ${MIN_FUENTE_PX} el navegador del visor amontona las letras`,
      )
    }
    if (escrito.alto / ALTO_DE_LINEA < minAlto) {
      problemas.push(
        `«${escrito.texto}» sale a ${((escrito.alto / ALTO_DE_LINEA) * 1000).toFixed(1)} mm, por debajo de ${(minAlto * 1000).toFixed(1)} mm a ${distancia} m`,
      )
    }
    const fuera =
      Math.abs(escrito.x) + escrito.ancho / 2 > panel.width / 2 + 1e-6 ||
      Math.abs(escrito.y) + escrito.alto / 2 > panel.height / 2 + 1e-6
    if (fuera) problemas.push(`«${escrito.texto}» se sale del panel`)
  }

  for (let i = 0; i < escritos.length; i++) {
    for (let j = i + 1; j < escritos.length; j++) {
      if (seTocan(escritos[i], escritos[j])) {
        problemas.push(`«${escritos[i].texto}» se pisa con «${escritos[j].texto}»`)
      }
    }
  }

  return problemas
}
