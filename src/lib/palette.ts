/**
 * La paleta del juego: el único sitio donde se escribe un color suyo.
 *
 * Los mismos colores los piden tres capas que no se hablan —el CSS de las
 * pantallas de escritorio, la escena de three y la interfaz del visor, que no
 * tiene CSS del que tirar—, y escritos a mano en cada una se desvían sin que
 * nadie lo decida. Aquí están los que **identifican al juego**, que son justo
 * los que más de una capa necesita; los neutros de una sola capa se quedan con
 * nombre junto al componente que los pinta.
 */

import type { CSSProperties } from 'react'
import type { Difficulty } from './gameConfig'

export const PALETTE = {
  /** Fondo del juego y de los paneles del visor: azul de sala oscura. */
  background: '#0b1220',
  /** Texto y números. */
  foreground: '#ffffff',
  /** El cian del juego: lo que está activo, encendido o elegido. */
  primary: '#38bdf8',
  /** Los dos extremos del degradado del botón principal. */
  primaryBright: '#7dd3fc',
  primaryDeep: '#0284c7',
  /** Tinta del botón principal: sobre ese cian claro, el blanco no se lee. */
  primaryInk: '#042335',
  /** Naranja del disco, que es también el acento de los datos del jugador. */
  puck: '#f97316',
  /** Rojo del rival: su mazo, su marcador y los goles encajados. */
  rival: '#f43f5e',
  /** Blanco frío de la superficie de la mesa. */
  table: '#e6edf5',
  /** Azul oscuro del marco y las bandas. */
  rail: '#152238',
} as const

/**
 * Color de cada dificultad: progresa de verde (fácil) a rojo (imposible).
 * Señal visual de riesgo, siempre acompañada de texto para no depender solo
 * del color.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#15803d',
  medium: '#65a30d',
  hard: '#d97706',
  expert: '#ea580c',
  impossible: '#dc2626',
}

/**
 * La paleta como variables CSS, que es lo que consumen las pantallas de
 * escritorio (`src/game/styles.css`).
 *
 * Las pone el juego sobre su propio contenedor, en línea (ver `GameScene`), y
 * no las escribe el CSS: el juego se publica como código, sin ningún paso de
 * construcción propio, así que la única forma de que el CSS y la escena lean
 * los mismos literales es que se los dé quien pinta el contenedor.
 *
 * Cuelgan del contenedor y nunca de `:root`: montado dentro de otra aplicación,
 * un `--color-primary` global le cambiaría el aspecto al anfitrión.
 */
export const GLIDE_HOCKEY_CSS_VARIABLES = {
  '--color-background': PALETTE.background,
  '--color-foreground': PALETTE.foreground,
  '--color-primary': PALETTE.primary,
  '--color-primary-bright': PALETTE.primaryBright,
  '--color-primary-deep': PALETTE.primaryDeep,
  '--color-primary-ink': PALETTE.primaryInk,
  '--color-accent': PALETTE.puck,
  '--color-rival': PALETTE.rival,
} as CSSProperties
