'use client'

import { type Ref } from 'react'
import { type Group, type Texture } from 'three'
import { MALLET_RADIUS } from '../../lib/gameConfig'

/** Alto de la base que roza la mesa y del pomo que se agarra. */
const BASE_HEIGHT = 0.028
const KNOB_HEIGHT = 0.045

/**
 * Un mazo, el del jugador o el de la máquina.
 *
 * Como el disco, no sabe dónde está: lo coloca el bucle de la partida (ver
 * `Rink`). Lo único suyo es el color, que es lo que distingue de un vistazo de
 * quién es cada mitad de la mesa.
 *
 * **Y los reflejos de la sala, los mismos que llevan la mesa y el disco.** Es el objeto que
 * está a un palmo de los ojos toda la partida: sin ellos tenía menos acabado que la mesa que
 * hay debajo, y eso se nota mucho más que al revés. No cuesta una llamada de dibujo más — el
 * mapa ya está cargado y se comparte.
 */
export function Mallet({
  color,
  environment,
  ref,
}: {
  color: string
  /** Los reflejos de la sala, los mismos que lleva el tablero. */
  environment?: Texture
  ref?: Ref<Group>
}) {
  return (
    <group ref={ref}>
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[MALLET_RADIUS, MALLET_RADIUS, BASE_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.1}
          envMap={environment ?? null}
          envMapIntensity={0.5}
        />
      </mesh>

      <mesh position={[0, BASE_HEIGHT + KNOB_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, KNOB_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          envMap={environment ?? null}
          envMapIntensity={0.4}
        />
      </mesh>
    </group>
  )
}
