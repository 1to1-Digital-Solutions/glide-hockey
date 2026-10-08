import { DIFFICULTY_ORDER, TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { MODOS_DEL_MENU } from './gameMode'
import { CONFORTS } from './golpeRecibido'
import { GRADOS_DEL_MENU } from './plantillaDelMenu'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * Las medidas del menú inmersivo que se pueden comprobar sin visor.
 *
 * Aquí solo hay aritmética: cuánto mide una barra y si cabe en su botón. Importa porque una
 * barra que se sale del botón se queda flotando en el aire delante del panel, y eso **no se
 * ve en ninguna pantalla**: hay que ponerse el visor para notarlo. La geometría vive en
 * `components/xr/XRMenu.tsx` y lee de aquí.
 */

/** Lo que mide el botón de un nivel, en metros. */
export const LEVEL_BUTTON: [number, number] = [0.12, 0.11]

/** Dónde apoya la barra dentro de su botón, y cuánto aire se le deja por arriba. */
export const LEVEL_BAR_BOTTOM = -0.02
const LEVEL_BAR_MARGIN = 0.008

/**
 * Lo que mide de alto la barra del nivel `index`, en metros.
 *
 * Sale del botón y no de un número suelto: era `0.026 + index * 0.014`, y la quinta barra
 * medía 8,2 cm dentro de un botón de 11, así que se salía por arriba. Aquí la más alta ocupa
 * lo que hay entre su suelo y el borde del botón menos un margen, y las de en medio se
 * reparten el resto: un nivel más encoge el escalón en vez de desbordar.
 */
export function levelBarHeight(index: number, total: number = DIFFICULTY_ORDER.length): number {
  const maximo = LEVEL_BUTTON[1] / 2 - LEVEL_BAR_BOTTOM - LEVEL_BAR_MARGIN
  const minimo = maximo / 3
  if (total <= 1) return maximo
  return minimo + (index / (total - 1)) * (maximo - minimo)
}

/**
 * Lo que ocupa la línea que explica el modo elegido.
 *
 * El panel crece por abajo en vez de apretar las filas: apretarlas las pisaría entre
 * sí, y eso solo se ve con el visor puesto. Lo de arriba se queda donde estaba, así
 * que quien ya sabía dónde pulsar lo sigue encontrando en el mismo sitio.
 */
export const MENU_HINT_BAND = 0.18

/**
 * Lo que ocupa la fila del confort del golpe recibido, arriba del todo.
 *
 * Va arriba y no entre las demás porque entre ellas no queda ni un centímetro (ver
 * `MENU_ROW`), y el panel crece hacia los dos lados a partes iguales: todas las filas bajan
 * media banda, así que por abajo queda el mismo margen que había y arriba sale el hueco.
 */
export const MENU_COMFORT_BAND = 0.17

/** El panel del menú, en metros. */
export const MENU_PANEL = { width: 0.78, height: 1.0 + MENU_HINT_BAND + MENU_COMFORT_BAND }

/** Dónde empieza la línea del modo, por su borde de arriba. */
export const MENU_HINT_Y = -0.37 - MENU_COMFORT_BAND / 2

/**
 * A qué tamaño se escribe cada cosa del panel del menú, en metros de alto de letra.
 *
 * **Una sola lista para quien pinta y para quien mide.** `dibujarLosNombres` escribe con estos
 * tamaños y `menu.legible.test.ts` comprueba que todo lo que el lienzo apunta está en ella: una
 * letra escrita a mano, o encogida para caber, no pasa sin verse.
 *
 * A 30 mm los rótulos y a 24 el decorado y la explicación, con el panel a 1,45 m y medidos fila
 * a fila con el escorzo, se quedaban entre 0,79° y 1,15°: por debajo de lo que se lee de un
 * vistazo (`MIN_READING_DEGREES`). Por eso crece la letra y el panel se acerca (`XR_UI.panel`).
 * El nombre del confort, un poco más: va en la fila de arriba del todo, la más lejana y la más
 * escorzada para quien juega con los ojos bajos, y a 34 mm se quedaba en 1,38°.
 */
export const MENU_TEXT = { label: 0.034, scenery: 0.034, hint: 0.034, comfort: 0.038, medal: 0.034, mode: 0.029 } as const

/**
 * Lo ancho que puede ocupar la frase de si el modo cuenta para medalla, que va en la línea del
 * rótulo «Modo», pegada al borde derecho: el panel menos sus márgenes y lo que ocupa el rótulo.
 */
export const MENU_MEDAL_WIDTH = 0.55

/** Lo que mide cada clase de botón del menú. */
export const MENU_BUTTON = {
  /** Cuatro en la fila desde que hay duelo: a 22 cm no cabían en los 78 del panel. */
  mode: [0.17, 0.13] as [number, number],
  level: LEVEL_BUTTON,
  small: [0.11, 0.11] as [number, number],
  play: [0.28, 0.12] as [number, number],
}

/**
 * A qué altura va cada fila del menú, en metros desde el centro del panel.
 *
 * **Creció.** Las filas iban tan juntas que el nombre de una se metía en la de arriba: el
 * rótulo «Modo» llegaba a 0,355 y la banda del récord empezaba en 0,335, así que la palabra
 * se pintaba encima del botón del decorado. Con el visor puesto eso se ve como lo que es,
 * letras solapadas, y deja el menú sin poder leerse.
 */
const BAJADA = MENU_HINT_BAND / 2 - MENU_COMFORT_BAND / 2
export const MENU_ROW = {
  comfort: 0.58 + BAJADA,
  record: 0.44 + BAJADA,
  mode: 0.245 + BAJADA,
  level: 0.02 + BAJADA,
  goals: -0.2 + BAJADA,
  actions: -0.38 + BAJADA,
} as const

/**
 * Cuánto sube el nombre de una fila por encima de sus botones, en metros.
 *
 * Las filas son iconos y barras, y un icono dice **qué pasa** pero no **de qué es la fila**:
 * cinco barras en línea no se leen como «nivel» hasta que alguien lo dice.
 */
export const MENU_ROW_LABEL_RISE = 0.1

/** Lo alto que se escribe el nombre de una fila. */
export const MENU_ROW_LABEL_SIZE = MENU_TEXT.label

/** El alto de los botones de cada fila, para poder medir si algo se pisa. */
export const MENU_ROW_HEIGHT: Record<keyof typeof MENU_ROW, number> = {
  comfort: MENU_BUTTON.small[1],
  record: MENU_BUTTON.small[1],
  mode: MENU_BUTTON.mode[1],
  level: MENU_BUTTON.level[1],
  goals: MENU_BUTTON.small[1],
  actions: MENU_BUTTON.play[1],
}

/**
 * Dónde van las cifras del récord, en la fila de arriba.
 *
 * Con el récord en medio de la fila, «Tu habitación» a la letra que se lee llega debajo de sus
 * cifras. Va a la derecha, que es un dato y no se pulsa.
 */
export const MENU_RECORD_X = 0.26

/**
 * Dónde va cada botón del confort, de izquierda a derecha: apagado, suave y entero. Pegados al
 * borde derecho, para dejarle al nombre de la fila todo el ancho que queda a su izquierda.
 */
export const MENU_COMFORT_X = [0.08, 0.2, 0.32] as const

/**
 * El nombre de cada modo, **dentro de su botón y debajo del icono**.
 *
 * Con el visor, los modos eran cuatro dibujos y un solo rótulo, «Modo»: un disco, unos rombos, una
 * escalera y dos discos no dicen «Práctica», «Niveles», «Reto» y «Duelo» a quien no los ha visto
 * nunca. Debajo del botón no cabe —ahí está el rótulo de la fila siguiente—, así que el icono sube
 * (`MENU_MODE_ICON_RISE`) y el nombre va en la franja de abajo del botón, a `MENU_TEXT.mode`: la
 * letra más pequeña que sigue leyéndose desde donde se juega y con la que «Challenge», el más
 * largo, cabe en el botón sin encogerse. Lo miden `menu.legible.test.ts`, en los dos idiomas.
 */
export const MENU_MODE_ICON_RISE = 0.016

/** A qué altura va el nombre del modo, desde el centro de su botón. */
export const MENU_MODE_LABEL_DROP = -0.044

/** De centro a centro entre dos botones de modo: dos centímetros de aire entre ellos. */
const MODE_STEP = 0.19

/** Una caja de pulsación del menú: centro y medidas, en coordenadas del panel. */
export interface MenuBox {
  readonly position: [number, number, number]
  readonly size: [number, number, number]
}

function caja(x: number, y: number, [width, height]: readonly [number, number]): MenuBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/**
 * Todas las cajas de pulsación del menú, con su nombre.
 *
 * El componente las usa de aquí, así que no puede haber una que los tests no vean: las cajas son
 * invisibles, y un rótulo que se mete en una no lo canta nadie más (`menu.legible.test.ts`).
 */
export const MENU_BOXES = {
  // Los modos, repartidos alrededor del centro: recorren la lista, así que un modo nuevo tiene su
  // botón sin que nadie se acuerde de añadirlo aquí.
  ...Object.fromEntries(
    MODOS_DEL_MENU.map((mode, index) => [
      `modo ${mode}`,
      caja((index - (MODOS_DEL_MENU.length - 1) / 2) * MODE_STEP, MENU_ROW.mode, MENU_BUTTON.mode),
    ]),
  ),
  ...Object.fromEntries(
    DIFFICULTY_ORDER.map((level, index) => [`nivel ${level}`, caja((index - 2) * 0.135, MENU_ROW.level, LEVEL_BUTTON)]),
  ),
  menos: caja(-0.19, MENU_ROW.goals, MENU_BUTTON.small),
  mas: caja(0.19, MENU_ROW.goals, MENU_BUTTON.small),
  'sin fin': caja(0.32, MENU_ROW.goals, MENU_BUTTON.small),
  escenario: caja(-0.28, MENU_ROW.record, MENU_BUTTON.small),
  jugar: caja(0, MENU_ROW.actions, MENU_BUTTON.play),
  salir: caja(0.28, MENU_ROW.actions, MENU_BUTTON.small),
  // Las tres opciones del confort, a la derecha de su nombre, que va en la misma línea: encima
  // no hay sitio, que es el borde del panel.
  ...Object.fromEntries(
    CONFORTS.map((confort, index) => [`confort ${confort}`, caja(MENU_COMFORT_X[index], MENU_ROW.comfort, MENU_BUTTON.small)]),
  ),
} as Record<string, MenuBox>

/**
 * Dónde nace el menú del visor: a la distancia de la columna (`COLUMNA` de `GameWorld.tsx`, metro y
 * medio) pero casi de frente, a `azimut` grados a la izquierda, por debajo de `GRADOS_DEL_MENU`
 * (la plantilla común): quien entra en la cabina lo encuentra donde mira. A la misma distancia, la
 * letra ocupa en el ojo lo mismo que en la columna.
 *
 * Se aparta al empezar: el final y el aviso de salir siguen en la columna, a 55°, fuera de donde
 * se juega. A CALIBRAR CON EL VISOR: `azimut`.
 */
export const MENU_DEL_VISOR = { distancia: 1.5, azimut: GRADOS_DEL_MENU - 1 } as const

/**
 * El sitio del menú del visor en la fase de menú, en coordenadas de la mesa (su centro, a la altura
 * del tablero), que es de donde cuelga la interfaz: el centro, a la altura de los ojos de referencia.
 * Lo leen la web (`GameWorld.tsx`) y el port de Godot (`reparto.ts`).
 */
export function sitioDelMenu(): [number, number, number] {
  const azimut = (MENU_DEL_VISOR.azimut * Math.PI) / 180
  return [
    -MENU_DEL_VISOR.distancia * Math.sin(azimut),
    REFERENCE_EYE_HEIGHT - TABLE_HEIGHT,
    -MENU_DEL_VISOR.distancia * Math.cos(azimut) - TABLE_CENTER_Z,
  ]
}
