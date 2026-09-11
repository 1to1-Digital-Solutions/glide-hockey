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

/** El panel del menú, en metros. */
export const MENU_PANEL = { width: 0.78, height: 1.0 }

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
  record: 0.44,
  mode: 0.245,
  level: 0.02,
  goals: -0.2,
  actions: -0.38,
} as const

/**
 * Cuánto sube el nombre de una fila por encima de sus botones, en metros.
 *
 * Las filas son iconos y barras, y un icono dice **qué pasa** pero no **de qué es la fila**:
 * cinco barras en línea no se leen como «nivel» hasta que alguien lo dice.
 */
export const MENU_ROW_LABEL_RISE = 0.1

/** Lo alto que se escribe el nombre de una fila. */
export const MENU_ROW_LABEL_SIZE = 0.03

/** El alto de los botones de cada fila, para poder medir si algo se pisa. */
export const MENU_ROW_HEIGHT: Record<keyof typeof MENU_ROW, number> = {
  record: MENU_BUTTON.small[1],
  mode: MENU_BUTTON.mode[1],
  level: MENU_BUTTON.level[1],
  goals: MENU_BUTTON.small[1],
  actions: MENU_BUTTON.play[1],
}
