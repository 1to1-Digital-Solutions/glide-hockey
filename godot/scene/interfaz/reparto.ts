/**
 * Dónde va cada pieza de la interfaz de Glide Hockey en Godot, y lo que mide.
 *
 * **Son las cotas de la web, no unas nuevas.** Las del menú están en `lib/xrMenuLayout.ts` y se
 * importan tal cual; estas otras viven en la web dentro de componentes de React
 * (`components/game/GameWorld.tsx` y `components/xr/XRHud.tsx`), que el motor no puede cargar, y
 * por eso se copian aquí con los mismos números y el mismo nombre en la web al lado de cada una.
 * Si allí cambia una, aquí tiene que cambiar la misma; los tests del motor
 * (`interfaz.motor.test.ts`) miden los paneles con estas cotas y con el instrumento de la web, así
 * que una cota que se aparte y deje de leerse sale en rojo.
 *
 * Todo en metros y en el espacio de la mesa (su centro, a la altura del tablero), que es de donde
 * cuelga la interfaz en la web.
 */
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '@/lib/gameConfig'
import { EYE_HEIGHTS, eyesAt, panelRotation, type PanelPose, type Point } from '@/lib/panelReading'
import { HALF_LENGTH } from '@/lib/puckPhysics'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '@/lib/uiHeight'

export type Triple = [number, number, number]

/**
 * La columna del menú, del final y del aviso de salir: a metro y medio y 55° a la izquierda de
 * quien juega, fuera de la mesa (`COLUMNA` de `GameWorld.tsx`).
 */
export const COLUMNA = { distancia: 1.5, azimut: 55 } as const

/** Lo que se agranda la columna para leerse a esa distancia (`ESCALA_DE_LA_COLUMNA`). */
export const ESCALA_DE_LA_COLUMNA = 1.4

/** Y el botón de parar, que se mira de reojo (`ESCALA_DEL_BOTON`). */
export const ESCALA_DEL_BOTON = 2.6

const AZIMUT = (COLUMNA.azimut * Math.PI) / 180

/** Cada pieza de la interfaz del visor, en coordenadas de la mesa (`XR_UI`). */
export const XR_UI = {
  /** El marcador, al fondo, sobre la portería de la máquina. */
  scoreboard: [0, 0.5, -HALF_LENGTH - 0.05] as Triple,
  /** La columna, pasada del espacio de quien juega al de la mesa. */
  panel: [-COLUMNA.distancia * Math.sin(AZIMUT), REFERENCE_EYE_HEIGHT - TABLE_HEIGHT, -COLUMNA.distancia * Math.cos(AZIMUT) - TABLE_CENTER_Z] as Triple,
  /** La cuenta atrás, flotando sobre el punto de saque. */
  countdown: [0, 0.34, 0] as Triple,
  /** El tutorial, sobre la mesa y a la altura de la vista. */
  tutorial: [0, 0.72, 0] as Triple,
}

/** El botón de parar va donde la columna: mientras se juega, la columna está vacía (`XR_QUIT`). */
export const XR_QUIT = XR_UI.panel

/** Lo que se inclina el marcador hacia quien juega (`rotation={[-0.18, 0, 0]}` en `GameWorld`). */
export const INCLINACION_DEL_MARCADOR = -0.18

/** Del espacio de la mesa al de quien juega: los pies en el origen y el `−Z` delante. */
export function delEspacioDelJugador(pieza: readonly [number, number, number]): Triple {
  return [pieza[0], pieza[1] + TABLE_HEIGHT, pieza[2] + TABLE_CENTER_Z]
}

/** Cómo se gira cada pieza para mirar a los ojos de referencia (`XR_UI_ROTATION`). */
export const XR_UI_ROTATION = {
  panel: panelRotation(delEspacioDelJugador(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)),
  quit: panelRotation(delEspacioDelJugador(XR_QUIT), eyesAt(REFERENCE_EYE_HEIGHT)),
  tutorial: panelRotation(delEspacioDelJugador(XR_UI.tutorial), eyesAt(REFERENCE_EYE_HEIGHT)),
}

/**
 * Desde dónde se lee un panel: a cada altura de ojos y con el mundo de pie o a la altura de ellos,
 * con lo que sube el mundo y lo que sube la interfaz sobre él (`vistasDelPanel`).
 */
export function vistasDelPanel(
  pieza: readonly [number, number, number],
  rotation: PanelPose['rotation'],
): { donde: string; pose: PanelPose; ojos: Point }[] {
  const [x, y, z] = delEspacioDelJugador(pieza)
  return EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAltura) => ({
      donde: `ojos a ${ojos} m${aLaAltura ? ', mundo a su altura' : ''}`,
      pose: { position: [x, y + worldRise(ojos, aLaAltura) + uiRiseOverWorld(ojos, aLaAltura), z] as const, rotation },
      ojos: eyesAt(ojos),
    })),
  )
}

/** Lo escrito en la columna, llevado a la escala a la que se pinta (`aLaEscalaDeLaColumna`). */
export function aLaEscala<T extends { x: number; y: number; ancho: number; alto: number }>(escritos: readonly T[], k = ESCALA_DE_LA_COLUMNA): T[] {
  return escritos.map((e) => ({ ...e, x: e.x * k, y: e.y * k, ancho: e.ancho * k, alto: e.alto * k }))
}

/** Una caja de pulsación: centro y medidas en el plano del panel (`hitBox` de `XRHud.tsx`). */
export interface Caja {
  x: number
  y: number
  width: number
  height: number
}

const caja = (x: number, y: number, [width, height]: readonly [number, number]): Caja => ({ x, y, width, height })

/**
 * Lo que se agranda el panel del tutorial del kit. El kit trae las letras del tutorial de Hole
 * Patrol (el contador a 30 mm) y en Glide Hockey el tutorial va sobre la mesa, a 1,2 m de los ojos:
 * la web subió su contador a 36 mm porque a 30 no llegaba a lo que se lee de un vistazo desde ahí
 * (`TUTORIAL_TEXT` de `XRTutorial.tsx`). El panel entero se agranda en esa proporción, que es lo
 * que pide el contador sin un segundo tutorial.
 */
export const ESCALA_DEL_TUTORIAL = 0.036 / 0.03

/** El marcador (`SCOREBOARD_SIZE` y `ROW` de `XRHud.tsx`). */
export const MARCADOR = { width: 0.52, height: 0.34 } as const
export const FILAS_DEL_MARCADOR = { goals: 0.06, points: -0.065, round: -0.135 } as const
/** A qué alto van las cifras del marcador: goles, puntos y ronda. */
export const CIFRAS_DEL_MARCADOR = { goals: 0.13, points: 0.055, round: 0.04 } as const

/** El aviso de coger el mazo, que sustituye al último segundo de la cuenta (`AVISO_DEL_MAZO`). */
export const AVISO_DEL_MAZO: [number, number] = [0.62, 0.2]
export const LETRA_DEL_AVISO = { phrase: 0.036 } as const
/** Las cifras de la cuenta atrás. */
export const CIFRA_DE_LA_CUENTA = 0.26

/** El final de la partida (`XRGameOver`): panel, franja del resultado, puntos y tres botones. */
export const FINAL = { width: 0.6, height: 0.42 } as const
export const BOTON_DE_ACCION: [number, number] = [0.24, 0.11]
export const BOTON_PEQUENO: [number, number] = [0.1, 0.1]
export const CAJAS_DEL_FINAL = {
  again: caja(-0.12, -0.13, BOTON_DE_ACCION),
  menu: caja(0.11, -0.13, BOTON_PEQUENO),
  exit: caja(0.24, -0.13, BOTON_PEQUENO),
} as const
export const CIFRA_DEL_FINAL = 0.11

/** El aviso de dejar la partida (`CONFIRM_SIZE`, `CONFIRM_BOXES`, `CONFIRM_TEXT`). */
export const AVISO: [number, number] = [0.72, 0.42]
export const CAJAS_DEL_AVISO = {
  stay: caja(0, -0.04, [0.44, 0.1]),
  menu: caja(-0.155, -0.16, [0.37, 0.1]),
  leave: caja(0.2, -0.16, [0.26, 0.1]),
} as const
export const LETRA_DEL_AVISO_DE_SALIR = { title: 0.05, body: 0.034, button: 0.034 } as const

/** El botón de parar y, en la partida sin fin, el de terminarla, a su derecha (`XRQuitButton`). */
export const CAJAS_DE_PARAR = {
  quit: caja(0, 0, BOTON_PEQUENO),
  end: caja(0.13, 0, BOTON_PEQUENO),
} as const
