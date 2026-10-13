/**
 * Cuándo se enciende y cuándo se apaga cada ayuda visual. Sin three y sin React.
 *
 * **Qué problema resuelve.** A un juego de visor se entra de pie, con las manos ocupadas y sin
 * nada que leer: si al entrar no se ve qué hay que hacer, lo único que queda es el tutorial —y
 * el tutorial es la red de seguridad, no el camino—. Las ayudas son lo que enseña el gesto sin
 * palabras: una marca en el suelo que dice dónde ponerse, la silueta de lo que hay que coger,
 * el mando de verdad con su botón encendido, una raya que dice adónde va lo que se golpea.
 *
 * **Y el fallo que hay que no cometer es dejarlas puestas.** Una ayuda permanente deja de ser
 * ayuda y pasa a ser decorado que estorba: tapa el juego, compite por los píxeles y sigue
 * explicando algo que quien juega ya sabe. Por eso cada ayuda declara **dos formas de
 * apagarse** y le basta cualquiera de las dos:
 *
 * - el **hito** que la vuelve inútil —en cuanto el gesto se hace una vez, sobra—, y
 * - un **plazo**, por si ese hito no llega nunca: quien se queda mirando el techo tampoco
 *   tiene por qué quedarse con el fantasma del mazo delante el resto de la tanda.
 *
 * Los hitos son los mismos que ya usa el tutorial (`lib/tutorial.ts`): los apuntan los sitios
 * que ya saben lo que pasa —coger, golpear—, así que una ayuda no necesita escuchar nada ni
 * pararle el juego a nadie. Se **deduce**.
 *
 * Es el mismo fichero en los trece juegos; lo que cambia de uno a otro —qué ayudas hay y qué
 * hito apaga cada una— va en su `lib/guionDeAyudas.ts`.
 *
 * ## De dónde sale esto
 *
 * Se buscaron referencias antes de escribirlo, y lo que más enseñó fue **lo que no hay**:
 *
 * - **Resaltar lo agarrable está documentado y tiene reglas.** Meta lo llama *affordances* y
 *   *signifiers* y pide enseñar los cuatro estados —apuntado, cogido, sostenido, fallado— con
 *   brillo, aplastamiento o latido (developers.meta.com/horizon/design/hands-best-practices y
 *   .../hands-plain-language-principles, principio 16), y **avisa expresamente contra el
 *   realce que se enciende y se apaga de golpe**: molesta y cansa. De ahí sale `CRUCE`: aquí
 *   nada aparece ni desaparece en un fotograma. Half-Life: Alyx hace lo mismo con los guantes
 *   —«el objeto brilla para que sepas a qué estás apuntando»— frente al «malla amarilla
 *   escandalosa» de otros juegos (roadtovr.com, *Inside XR Design*).
 * - **Enseñar el gesto sin palabras también**, y con nombre: *Instructed Motion*, que es lo
 *   que hacen las flechas de Beat Saber; sin ellas «los movimientos serían caóticos y la gente
 *   agitaría los brazos al azar» (roadtovr.com, *Inside XR Design*). Owlchemy Labs
 *   (Job Simulator) lo lleva al extremo contrario al tutorial: se lo das a alguien y le dices
 *   «haz lo que quieras», y lo que enseña es el entorno (venturebeat.com).
 * - **Y de apagarlas no dice nada nadie.** Ni Meta, ni Valve, ni las charlas: el realce de lo
 *   agarrable se documenta como un **estado permanente** de la interacción, y el arco de
 *   teletransporte como un control, no como una ayuda que sobra al aprender. Esa es la parte
 *   que aquí se añade, y es la que más falta hace: un realce permanente en un juego que dura
 *   un minuto es decorado que tapa el juego. Por eso el plazo y el hito no son un detalle de
 *   implementación — son lo único de este fichero que no estaba escrito en ningún sitio.
 */

/**
 * Lo menos y lo más que puede durar una ayuda que no se llega a resolver, en segundos.
 *
 * El suelo es lo que tarda alguien en bajar la vista y entender un dibujo con el visor puesto;
 * el techo es donde una ayuda deja de serlo. No son gustos: los dos extremos los vigila
 * `problemasDelGuion`, que es lo que impide que la próxima ayuda que alguien añada se quede
 * puesta para siempre «solo mientras se prueba».
 */
export const MINIMO = 4
export const MAXIMO = 20

/**
 * Cuánto tarda una ayuda en aparecer del todo o en irse del todo, en segundos.
 *
 * **Nada aparece ni desaparece de golpe.** Un objeto que se enciende o se apaga en un
 * fotograma se lee, con el visor puesto, como un parpadeo de la escena —que es justo lo que
 * llevamos tandas persiguiendo—, y encima roba la mirada a destiempo.
 */
export const CRUCE = 0.45

/** Cuánto y cómo de rápido late lo que está esperando a que alguien lo coja. */
export const LATIDO = { fuerza: 0.12, velocidad: 3.2 } as const

/**
 * De qué color se pintan **todas** las ayudas, en los trece juegos.
 *
 * Escrito aquí y no sacado de la paleta de cada juego a propósito, por lo mismo que la marca
 * del mando (`MandoDeVerdad.tsx`, de donde sale este ámbar): una ayuda no es decorado, es una
 * frase, y tiene que separarse del decorado — del verde de un tapete, de la tierra de una
 * jaula y del salón de quien juega, que es el escenario que nadie eligió. Y tiene que ser la
 * misma en todos: quien aprende en un juego que lo que late en ámbar es lo que hay que hacer
 * no vuelve a preguntárselo en el siguiente.
 */
export const COLOR_DE_LA_AYUDA = '#ffc233'

/**
 * Una ayuda: cómo se llama, qué la apaga y cuánto aguanta si no se hace nada.
 *
 * `Hito` es el nombre que el juego le da a lo que quien juega ya ha hecho, que es el mismo que
 * usa su tutorial.
 */
export interface Ayuda<Hito extends string = string> {
  /** Cómo se llama. Es lo único que la escena mira para decidir si la pinta. */
  readonly id: string
  /** El hito que la apaga: en cuanto se hace una vez, la ayuda sobra. */
  readonly hasta: Hito
  /** Y si ese hito no llega, a los cuántos segundos se va sola. */
  readonly caduca: number
  /**
   * El hito que la enciende, si no se enciende de entrada.
   *
   * Sirve para lo que solo tiene sentido enseñar después: la marca del objetivo no dice nada
   * a quien todavía no tiene el mazo en la mano.
   */
  readonly desde?: Hito
}

/** El guion de un juego: todas sus ayudas. */
export type Guion<Hito extends string> = readonly Ayuda<Hito>[]

/** Lo que quien juega ya ha hecho. Se acumula: hacer algo no se deshace. */
export type Hechos<Hito extends string> = Readonly<Record<Hito, boolean>>

/**
 * ¿Se enseña esta ayuda ahora mismo?
 *
 * @param segundos Cuánto lleva **esta** ayuda pudiéndose enseñar, no lo que lleva la tanda.
 *   Cada una tiene su reloj porque no todas empiezan a la vez: la que espera a un hito
 *   (`desde`) arranca cuando ese hito llega, y medirle el plazo desde el principio de la
 *   tanda la dejaría caducada antes de aparecer.
 */
export function ayudaEncendida<Hito extends string>(
  ayuda: Ayuda<Hito>,
  hechos: Hechos<Hito>,
  segundos: number,
): boolean {
  if (hechos[ayuda.hasta]) return false
  if (ayuda.desde !== undefined && !hechos[ayuda.desde]) return false
  return segundos < ayuda.caduca
}

/** El reloj de cada ayuda y cuáles se están enseñando, entre un fotograma y el siguiente. */
export interface EstadoDeLasAyudas {
  /** Cuánto lleva cada ayuda pudiéndose enseñar, por su nombre. */
  readonly relojes: Record<string, number>
  /** Las que se enseñan en este fotograma. */
  readonly encendidas: Set<string>
}

/** Nada enseñándose y todos los relojes a cero. */
export function sinAyudas(): EstadoDeLasAyudas {
  return { relojes: {}, encendidas: new Set() }
}

/**
 * Avanza el reloj de cada ayuda y deja apuntado cuáles se enseñan.
 *
 * **Muta lo que recibe a propósito**: es el mismo objeto que vive entre fotogramas, y
 * devolver uno nuevo noventa veces por segundo es basura que recoger. Lo mismo hace el
 * enganche del agarre, por lo mismo.
 *
 * Una ayuda que todavía no puede enseñarse tiene el reloj **parado en cero**: así, cuando
 * llegue su hito, le queda su plazo entero.
 */
export function avanzarLasAyudas<Hito extends string>(
  guion: Guion<Hito>,
  hechos: Hechos<Hito>,
  estado: EstadoDeLasAyudas,
  delta: number,
): EstadoDeLasAyudas {
  estado.encendidas.clear()
  for (const ayuda of guion) {
    const puede = ayuda.desde === undefined || hechos[ayuda.desde]
    const reloj = puede ? (estado.relojes[ayuda.id] ?? 0) + Math.max(0, delta) : 0
    estado.relojes[ayuda.id] = reloj
    if (ayudaEncendida(ayuda, hechos, reloj)) estado.encendidas.add(ayuda.id)
  }
  return estado
}

/**
 * Lo que se ve de una ayuda este fotograma, acercándose a lo que toca sin saltos.
 *
 * Se lleva en la escena y no aquí porque depende del fotograma —y porque el momento exacto en
 * que se cumple un hito no está en `Hechos`, que solo dice que ya pasó—. Esto es la cuenta,
 * que sí se puede probar: de 0 a 1 en `cruce` segundos, y de 1 a 0 en los mismos.
 *
 * @param cruce Cuánto tarda el viaje entero. Un cruce de cero —o el reloj parado— salta
 *   directamente a donde toca, que es lo que haría un desvanecido instantáneo.
 */
export function acercarse(actual: number, objetivo: number, delta: number, cruce: number = CRUCE): number {
  const paso = cruce > 0 ? Math.max(0, delta) / cruce : Infinity
  return objetivo > actual ? Math.min(objetivo, actual + paso) : Math.max(objetivo, actual - paso)
}

/**
 * El latido de lo que está esperando: un factor alrededor de 1 con el que escalar o subir la
 * opacidad.
 *
 * Es lo que separa una ayuda del decorado. Con `fuerza` a cero se queda quieta, que es lo que
 * pide `prefers-reduced-motion`.
 */
export function latido(
  segundos: number,
  fuerza: number = LATIDO.fuerza,
  velocidad: number = LATIDO.velocidad,
): number {
  return 1 + fuerza * Math.sin(segundos * velocidad)
}

/**
 * Por dónde va una demostración que se repite: en qué vuelta está y cuánto lleva de esa vuelta.
 *
 * Una silueta que hace el gesto una sola vez se la pierde quien estuviera mirando a otro lado,
 * que al entrar es la mitad de la gente. Se repite hasta que la ayuda se apaga, y **cada vuelta
 * se puede hacer en otro sitio** —otro agujero, otra altura—, que es lo que dice que el gesto
 * vale para todos y no solo para ese.
 */
export function pase(segundos: number, periodo: number): { vuelta: number; avance: number } {
  if (!(periodo > 0)) return { vuelta: 0, avance: 0 }
  const desde = Math.max(0, segundos)
  return { vuelta: Math.floor(desde / periodo), avance: (desde % periodo) / periodo }
}

/**
 * Qué le falla a un guion de ayudas. Devuelve **frases**, no un `false`.
 *
 * Como el instrumento que mide la legibilidad de un panel: un test que solo dijera «el guion
 * está mal» obligaría a leerse el guion entero para saber qué. Lo que caza es lo que se cuela
 * sin querer —una ayuda repetida, un plazo que se puso «mientras se prueba» y se quedó, una
 * que se enciende y se apaga con lo mismo—, y cada juego se lo pasa desde su propio test.
 */
export function problemasDelGuion(guion: Guion<string>): string[] {
  const problemas: string[] = []
  const vistas = new Set<string>()
  for (const ayuda of guion) {
    if (vistas.has(ayuda.id)) problemas.push(`la ayuda «${ayuda.id}» está dos veces en el guion`)
    vistas.add(ayuda.id)
    if (ayuda.caduca < MINIMO) {
      problemas.push(
        `la ayuda «${ayuda.id}» dura ${ayuda.caduca} s: por debajo de ${MINIMO} s no da tiempo ni a mirarla`,
      )
    }
    if (ayuda.caduca > MAXIMO) {
      problemas.push(
        `la ayuda «${ayuda.id}» dura ${ayuda.caduca} s: pasados ${MAXIMO} s deja de ser una ayuda y es decorado`,
      )
    }
    if (ayuda.desde !== undefined && ayuda.desde === ayuda.hasta) {
      problemas.push(
        `la ayuda «${ayuda.id}» se enciende y se apaga con el mismo hito, «${ayuda.hasta}»: no se vería nunca`,
      )
    }
  }
  return problemas
}
