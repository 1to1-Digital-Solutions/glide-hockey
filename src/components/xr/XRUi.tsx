'use client'

import { EXIT_ARROW } from './canvasPanel'
import { PANEL_ORDER } from './buttonHighlight'
import { NO_RAYCAST } from '../raycast'
import { Shape } from 'three'

import { type ReactNode, useRef, useState } from 'react'
import { pulsePressed } from '../../lib/haptics'
import { type ThreeEvent } from '@react-three/fiber'
import { PALETTE } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import {
  DIGIT_ADVANCE,
  DIGIT_SEGMENTS,
  SEGMENT_LAYOUT,
  SEGMENT_THICKNESS,
  digitsOf,
} from '../../lib/xrDigits'
import { pressCounts, pressTime } from '../../lib/xrPress'

/**
 * Piezas de interfaz para las sesiones inmersivas.
 *
 * En VR/AR no hay DOM, así que menú, marcador y botones son geometría. Todo lo
 * de aquí es local: ni fuentes, ni texturas, ni nada que salga a la red (ver
 * `lib/xrDigits.ts` para el porqué de los números dibujados a mano).
 */

/**
 * El realce del botón apuntado: el acento del salón, el mismo en todos los juegos, para que el
 * gesto de apuntar se aprenda una vez.
 */
const HIGHLIGHT_COLOR = COMMON_PALETTE.accent

/**
 * Y con el que se enciende al apretarlo, que es otra cosa que apuntarlo.
 *
 * El botón **se hunde y cambia de color** en vez de desaparecer: encoge por debajo de su
 * tamaño de reposo —que a un metro se lee como que se mete hacia dentro— y el halo pasa del
 * acento al blanco del texto y sube de intensidad. Reportado con el visor puesto: «cuando se pulsa el
 * botón, el botón debería de seguir ahí (reaccionar bien, como hundiéndose, cambiando de
 * color y eso bien, pero no desapareciendo)».
 */
const PRESSED_COLOR = COMMON_PALETTE.text

/** Lo que encoge un botón apretado, desde el 1,08 que crece al apuntarlo. */
const PRESSED_SCALE = 0.98
/** Lo que está apagado o es secundario: el neutro suave de los paneles del salón. */
export const DIM_COLOR = COMMON_PALETTE.mutedText

/** Dónde está un botón y cuánto ocupa su zona sensible. */
export interface XrHitBox {
  position: [number, number, number]
  size: [number, number, number]
}

/**
 * Panel de fondo. En AR es lo que despega la interfaz de la habitación.
 *
 * Del color del juego y translúcido: es el mismo fondo, dejando ver lo que hay
 * detrás.
 */
export function XRPanel({
  width,
  height,
  color = PALETTE.background,
  opacity = 0.86,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
}) {
  return (
    /*
      **Sin escribir profundidad, y con su sitio en el orden.** Es un plano transparente de
      un panel, y a milímetros de los botones que lleva encima la ordenación por profundidad
      no decide nada fiable: basta inclinar la cabeza hacia un botón del borde para que el
      fondo se pinte DESPUÉS de él y, escribiendo profundidad, se lo lleve por delante
      (ver `buttonHighlight.tsx`).
    */
    <mesh position={[0, 0, -0.02]} renderOrder={PANEL_ORDER.back}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Botón 3D.
 *
 * Tres decisiones que vienen de cómo se apunta un botón en el visor:
 *
 * - **Se resuelve al pulsar, no al soltar.** `onClick` exige pulsar y soltar
 *   sobre el mismo objeto; apuntando a pulso a un metro, el rayo se sale del
 *   botón entre una cosa y la otra y la pulsación se pierde.
 * - **Un doble roce es una sola pulsación**, que aquí un botón recibe más de un
 *   puntero. Quién cuenta lo decide `lib/xrPress.ts`.
 * - **El foco se ve.** El botón apuntado crece *y* se enciende con un halo:
 *   forma y color, nunca solo color.
 *
 * La zona sensible es una caja invisible mayor que el dibujo: apuntando en el
 * aire, un objetivo del tamaño exacto del icono se falla constantemente. Que
 * sea invisible no la excluye del raycasting — los punteros miran si hay
 * listeners, no si se ve.
 */
export function XRPressable({
  box,
  onSelect,
  children,
  disabled = false,
}: {
  box: XrHitBox
  onSelect: () => void
  children: ReactNode
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const lastPress = useRef<number | null>(null)

  const handle = (event: ThreeEvent<PointerEvent>) => {
    setPressed(true)
    // El evento se para también con el botón apagado: si no, atravesaría hasta
    // lo que haya detrás del panel.
    event.stopPropagation()

    const now = pressTime()
    if (!pressCounts(now, lastPress.current, disabled)) return
    lastPress.current = now

    // El mando que ha pulsado contesta. Dentro del visor no se dibuja, así que este toque es
    // lo único que dice que el botón ha oído; con el ratón no hay mando y no pasa nada.
    pulsePressed(event)

    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = box.size

  return (
    <group
      position={box.position}
      scale={pressed ? PRESSED_SCALE : active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerUp={() => setPressed(false)}
      onPointerOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      {children}

      {/* Halo de foco: por detrás del dibujo, para enmarcarlo sin taparlo.
          **Sin escribir profundidad y con su sitio en el orden.** Un plano transparente
          de un panel sí apunta su profundidad salvo que se le diga que no, y a
          milímetros de sus vecinos la ordenación por profundidad se da la vuelta en
          cuanto se inclina la cabeza hacia un botón del borde: entonces el halo se
          pintaba antes que el fondo del panel y lo borraba, y el botón se veía como un
          agujero a la escena. El porqué entero, en `buttonHighlight.tsx`.
          Apretado se enciende más y cambia de color: es lo único que dice, desde
          dentro, que el botón ha oído. */}
      <mesh position={[0, 0, -0.014]} visible={active || pressed} renderOrder={PANEL_ORDER.behind}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={pressed ? PRESSED_COLOR : HIGHLIGHT_COLOR}
          transparent
          depthWrite={false}
          opacity={pressed ? 0.55 : 0.34}
          toneMapped={false}
        />
      </mesh>

      <mesh visible={false}>
        <boxGeometry args={box.size} />
      </mesh>
    </group>
  )
}

/**
 * Un número, en segmentos.
 *
 * `size` es la altura de una cifra en metros; el ancho y el grosor salen de
 * ella, así que el conjunto escala sin descuadrarse (ver `lib/xrDigits.ts`).
 */
export function XRNumber({
  value,
  size = 0.09,
  color = PALETTE.foreground,
  position = [0, 0, 0],
}: {
  value: number
  size?: number
  color?: string
  position?: [number, number, number]
}) {
  const digits = digitsOf(value)
  const advance = size * DIGIT_ADVANCE
  const width = (digits.length - 1) * advance

  return (
    <group position={position}>
      {digits.map((digit, index) => (
        <group key={index} position={[index * advance - width / 2, 0, 0]}>
          {DIGIT_SEGMENTS[digit].map((segment) => {
            const { x, y, horizontal } = SEGMENT_LAYOUT[segment]
            const long = size * 0.42
            const thin = size * SEGMENT_THICKNESS
            return (
              <mesh key={segment} position={[x * size, y * size, 0]}>
                <planeGeometry
                  args={horizontal ? [long, thin] : [thin, long]}
                />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

/** Una placa de botón: el fondo sobre el que va el icono. */
export function XRPlate({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number
  height: number
  color: string
  opacity?: number
}) {
  return (
    // Por delante del fondo del panel y del halo, y sin escribir profundidad: las capas de
    // un panel se declaran, no se deducen (ver `buttonHighlight.tsx`).
    <mesh position={[0, 0, -0.006]} renderOrder={PANEL_ORDER.face}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Triángulo de «jugar», apuntando a la derecha.
 *
 * Sin girarlo: `CircleGeometry` pone su primer vértice en el ángulo 0, que es
 * la derecha. Girado −90° ese vértice acababa abajo y el botón se leía como
 * «descargar», no como «play».
 */
export function XRPlayIcon({ size = 0.06 }: { size?: number }) {
  return (
    <mesh>
      {/* Un círculo de tres lados es un triángulo, y ahorra una geometría
          propia para la única forma que no es un rectángulo. */}
      <circleGeometry args={[size, 3]} />
      <meshBasicMaterial color={PALETTE.primaryInk} toneMapped={false} />
    </mesh>
  )
}

/** La flecha de salir, como forma plana: la misma que se pinta en los lienzos. */
const FORMA_DE_SALIR = (() => {
  const { tip: punta, shaft: cuerpo, thickness: grosor, elbow: codo, wings: alas } = EXIT_ARROW
  const forma = new Shape()
  forma.moveTo(punta, 0)
  forma.lineTo(codo, alas)
  forma.lineTo(codo, grosor / 2)
  forma.lineTo(cuerpo, grosor / 2)
  forma.lineTo(cuerpo, -grosor / 2)
  forma.lineTo(codo, -grosor / 2)
  forma.lineTo(codo, -alas)
  forma.closePath()
  return forma
})()

/**
 * La flecha de **salir del juego**: volver al arcade.
 *
 * **Una sola forma para los trece.** Cada juego decía «salir» a su manera —la palabra
 * «Exit», un aspa, una puerta, una puerta con flecha— y el aspa, además, significa «cerrar
 * esto» en varios paneles. Reportado con el visor puesto: «no se entiende cuál es el botón de
 * salir del juego: a veces aparece un cuadrado, otras veces pone "leave"… habría que
 * unificarlo». La forma sale de `FLECHA_DE_SALIR`, la misma que pintan en su lienzo los
 * juegos que dibujan el menú con texto.
 */
export function XRExitIcon({
  size = 0.05,
  color = PALETTE.foreground,
}: {
  size?: number
  color?: string
}) {
  return (
    <mesh scale={size} raycast={NO_RAYCAST}>
      <shapeGeometry args={[FORMA_DE_SALIR]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Tres barras: «volver al menú». */
export function XRMenuIcon({
  size = 0.05,
  color = PALETTE.foreground,
}: {
  size?: number
  color?: string
}) {
  return (
    <group>
      {[-1, 0, 1].map((row) => (
        <mesh key={row} position={[0, row * size * 0.32, 0]}>
          <planeGeometry args={[size, size * 0.16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Altavoz con o sin ondas: el interruptor de sonido del visor.
 *
 * El estado se lee **por forma antes que por color** —las ondas están o no
 * están, y callado se tacha con una barra— porque el menú se mira a un metro y
 * con el visor puesto, donde un cian y un gris se parecen bastante.
 */
/**
 * Una nota musical: la cabeza y su plica. Dice si la música de fondo suena o
 * está apagada, con el mismo tachón en diagonal que el altavoz callado, para
 * que los dos interruptores se lean igual sin leer nada.
 */
export function XRMusicIcon({
  playing,
  size = 0.05,
}: {
  playing: boolean
  size?: number
}) {
  const color = playing ? PALETTE.foreground : DIM_COLOR

  return (
    <group>
      {/* La cabeza de la nota, ovalada por estar algo tumbada. */}
      <mesh position={[-size * 0.18, -size * 0.3, 0]} rotation={[0, 0, -0.35]} scale={[1.3, 1, 1]}>
        <circleGeometry args={[size * 0.22, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* La plica, subiendo por la derecha de la cabeza. */}
      <mesh position={[-size * 0.02, size * 0.05, 0]}>
        <planeGeometry args={[size * 0.09, size * 0.75]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Y el corchete, doblando hacia la derecha arriba del todo. */}
      <mesh position={[size * 0.14, size * 0.34, 0]} rotation={[0, 0, -0.5]}>
        <planeGeometry args={[size * 0.34, size * 0.09]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {playing ? null : (
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[size * 1.05, size * 0.11]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function XRSoundIcon({
  muted,
  size = 0.05,
}: {
  muted: boolean
  size?: number
}) {
  const color = muted ? DIM_COLOR : PALETTE.foreground

  return (
    <group position={[-size * 0.12, 0, 0]}>
      {/* Cuerpo y campana del altavoz, mirando a la derecha. Un círculo de
          tres lados es un triángulo, y girado media vuelta deja el vértice a la
          izquierda: es la campana abriéndose hacia donde sale el sonido. */}
      <mesh position={[-size * 0.46, 0, 0]}>
        <planeGeometry args={[size * 0.3, size * 0.42]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[-size * 0.16, 0, 0]} rotation={[0, 0, Math.PI]}>
        <circleGeometry args={[size * 0.44, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Sonando, dos ondas saliendo de la campana; callado, un tachón en
          diagonal donde estarían. */}
      {muted ? (
        <mesh position={[size * 0.42, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[size * 0.62, size * 0.11]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : (
        [0, 1].map((index) => (
          <mesh key={index} position={[size * (0.42 + index * 0.24), 0, 0]}>
            <planeGeometry args={[size * 0.09, size * (0.34 + index * 0.3)]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        ))
      )}
    </group>
  )
}

/**
 * Lo que se pinta alrededor, dicho con un dibujo: con la sala, cuatro paredes
 * cerradas; con la habitación, el marco de una ventana abierta.
 *
 * Cambia la **forma** y no solo el color, que dentro del visor cambia con la
 * luz de la escena y no puede ser la única señal (WCAG 1.4.1).
 */
export function XRSceneryIcon({
  room,
  lit = true,
  size = 0.05,
}: {
  room: boolean
  lit?: boolean
  size?: number
}) {
  const color = lit ? PALETTE.foreground : DIM_COLOR
  const grosor = size * 0.12

  return (
    <group>
      {/* El marco, siempre. */}
      {[
        [0, size * 0.34, size * 0.8, grosor],
        [0, -size * 0.34, size * 0.8, grosor],
        [-size * 0.34, 0, grosor, size * 0.8],
        [size * 0.34, 0, grosor, size * 0.8],
      ].map(([x, y, ancho, alto], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <planeGeometry args={[ancho, alto]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}

      {/* Cerrado, el interior lleno; abierto, solo el travesaño de la ventana. */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={room ? [size * 0.68, grosor] : [size * 0.56, size * 0.56]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Signo de más o de menos, para los selectores de cantidad. */
export function XRSignIcon({
  sign,
  size = 0.05,
  color = PALETTE.foreground,
}: {
  sign: 'plus' | 'minus'
  size?: number
  color?: string
}) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[size, size * 0.22]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {sign === 'plus' ? (
        <mesh>
          <planeGeometry args={[size * 0.22, size]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}
