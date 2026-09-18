import { DIFFICULTY_ORDER } from './gameConfig'

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

/** El panel del menú, en metros. */
export const MENU_PANEL = { width: 0.78, height: 1.0 + MENU_HINT_BAND }

/** Dónde empieza la línea del modo, por su borde de arriba. */
export const MENU_HINT_Y = -0.37

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
 */
export const MENU_TEXT = { label: 0.034, scenery: 0.034, hint: 0.034 } as const

/** Lo que mide cada clase de botón del menú. */
export const MENU_BUTTON = {
  mode: [0.22, 0.13] as [number, number],
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
export const MENU_ROW = {
  record: 0.44 + MENU_HINT_BAND / 2,
  mode: 0.245 + MENU_HINT_BAND / 2,
  level: 0.02 + MENU_HINT_BAND / 2,
  goals: -0.2 + MENU_HINT_BAND / 2,
  actions: -0.38 + MENU_HINT_BAND / 2,
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
  'modo practice': caja(-0.25, MENU_ROW.mode, MENU_BUTTON.mode),
  'modo levels': caja(0, MENU_ROW.mode, MENU_BUTTON.mode),
  'modo challenge': caja(0.25, MENU_ROW.mode, MENU_BUTTON.mode),
  ...Object.fromEntries(
    DIFFICULTY_ORDER.map((level, index) => [`nivel ${level}`, caja((index - 2) * 0.135, MENU_ROW.level, LEVEL_BUTTON)]),
  ),
  menos: caja(-0.19, MENU_ROW.goals, MENU_BUTTON.small),
  mas: caja(0.19, MENU_ROW.goals, MENU_BUTTON.small),
  'sin fin': caja(0.32, MENU_ROW.goals, MENU_BUTTON.small),
  escenario: caja(-0.28, MENU_ROW.record, MENU_BUTTON.small),
  jugar: caja(0, MENU_ROW.actions, MENU_BUTTON.play),
  salir: caja(0.28, MENU_ROW.actions, MENU_BUTTON.small),
} as Record<string, MenuBox>
