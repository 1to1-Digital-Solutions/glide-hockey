'use client'

import { type ReactNode, useRef, useState } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { PALETTE } from '../../lib/palette'
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

/** Azul claro del botón apuntado. */
const HIGHLIGHT_COLOR = '#7dd3fc'
/** Gris azulado de lo que está apagado o es secundario. */
export const DIM_COLOR = '#8398b4'

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
    <mesh position={[0, 0, -0.02]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
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
  const lastPress = useRef<number | null>(null)

  const handle = (event: ThreeEvent<PointerEvent>) => {
    // El evento se para también con el botón apagado: si no, atravesaría hasta
    // lo que haya detrás del panel.
    event.stopPropagation()

    const now = pressTime()
    if (!pressCounts(now, lastPress.current, disabled)) return
    lastPress.current = now

    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = box.size

  return (
    <group
      position={box.position}
      scale={active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}

      {/* Halo de foco: por detrás del dibujo, para enmarcarlo sin taparlo. */}
      <mesh position={[0, 0, -0.014]} visible={active}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={HIGHLIGHT_COLOR}
          transparent
          opacity={0.34}
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
    <mesh position={[0, 0, -0.006]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
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

/** Aspa de «salir». */
export function XRCloseIcon({
  size = 0.05,
  color = PALETTE.foreground,
}: {
  size?: number
  color?: string
}) {
  return (
    <group>
      {[Math.PI / 4, -Math.PI / 4].map((rotation) => (
        <mesh key={rotation} rotation={[0, 0, rotation]}>
          <planeGeometry args={[size, size * 0.2]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
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
