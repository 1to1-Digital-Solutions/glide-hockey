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
 * Alto de la caja de una línea respecto al tamaño de la letra.
 *
 * No es 1: entre el alto declarado y lo que ocupan de verdad las mayúsculas y los
 * rabos de las letras hay aire, y contarlo entero daría por pisadas dos líneas
 * que se leen perfectamente.
 */
const ALTO_DE_LINEA = 0.8

/**
 * Lo más pequeña que puede salir una letra, en metros.
 *
 * Un panel del visor se lee a un brazo o a metro y pico. Cuatro milímetros a un
 * metro son 0,23°, por debajo del límite de agudeza de un ojo sano —y muy por
 * debajo de lo que resuelve un visor—. Es el suelo, no el objetivo.
 */
export const MIN_ALTO = 0.004

/** Un texto que se ha escrito en el panel: qué, dónde y qué caja ocupa. */
export interface Escrito {
  readonly texto: string
  /** El centro de su caja, en coordenadas del panel. */
  readonly x: number
  readonly y: number
  readonly ancho: number
  readonly alto: number
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
  let estado = { x: 0, y: 0, escalaY: 1, font: '' }
  const pila: (typeof estado)[] = []

  // El lienzo del panel va escalado a metros (`CanvasPanel`), así que el tamaño
  // declarado en la fuente ya viene en metros y no hay nada que convertir.
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
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    save: () => {
      pila.push({ ...estado })
    },
    restore: () => {
      estado = pila.pop() ?? estado
    },
    translate: (x: number, y: number) => {
      estado = { ...estado, x: estado.x + x, y: estado.y + y * estado.escalaY }
    },
    scale: (_x: number, y: number) => {
      estado = { ...estado, escalaY: estado.escalaY * y }
    },
    measureText: (texto: string) => ({ width: texto.length * tamano() * AVANCE }),
    // La `y` que llega es siempre 0: los paneles la ponen con `translate` antes de
    // escribir, que es lo que este lienzo lleva apuntado.
    fillText: (texto: string, x: number) => {
      const alto = tamano()
      const ancho = texto.length * alto * AVANCE
      const centro =
        ctx.textAlign === 'left'
          ? estado.x + x + ancho / 2
          : ctx.textAlign === 'right'
            ? estado.x + x - ancho / 2
            : estado.x + x
      escritos.push({ texto, x: centro, y: estado.y, ancho, alto: alto * ALTO_DE_LINEA })
    },
    // Lo que dibuja formas no se apunta: aquí se revisa el texto.
    clearRect: () => {},
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
  { panel, minAlto = MIN_ALTO }: { panel: Panel; minAlto?: number },
): string[] {
  const problemas: string[] = []

  for (const escrito of escritos) {
    if (escrito.alto / ALTO_DE_LINEA < minAlto) {
      problemas.push(
        `«${escrito.texto}» sale a ${(escrito.alto / ALTO_DE_LINEA * 1000).toFixed(1)} mm, por debajo de ${minAlto * 1000} mm`,
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
