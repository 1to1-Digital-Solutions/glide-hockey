'use client'

import { useRef, type Ref, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import { PUCK_RADIUS } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'
import { puckGlow } from '../../lib/puckGlow'
/** Grosor del disco. Lo justo para que se le vea el canto desde el borde. */
const PUCK_HEIGHT = 0.022

/**
 * El disco.
 *
 * No sabe dónde está: lo coloca el bucle de la partida moviendo su grupo (ver
 * `Rink`). Así la posición no pasa por el estado de React, que a sesenta
 * fotogramas por segundo repintaría el árbol entero. Lo que sí sabe es lo
 * rápido que va (`speedRef`, que escribe el bucle): con la velocidad crece
 * su brillo con la velocidad (`lib/puckGlow.ts`), que es lo que deja
 * seguirlo en el visor cuando cruza la mesa en medio segundo.
 */
export function Puck({
  ref,
  speedRef,
  environment,
}: {
  ref?: Ref<Group>
  /** Velocidad del disco en m/s, escrita cada fotograma por el bucle de la mesa. */
  speedRef?: RefObject<number>
  /** Los reflejos de la sala, los mismos que lleva el tablero. */
  environment?: Texture
}) {
  const body = useRef<Mesh>(null)

  useFrame(() => {
    const glow = puckGlow(speedRef?.current ?? 0)
    const material = body.current?.material as MeshStandardMaterial | undefined
    if (material != null) material.emissiveIntensity = glow.emissive

  })

  return (
    <group ref={ref}>
      <mesh ref={body} position={[0, PUCK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={PALETTE.puck}
          roughness={0.3}
          metalness={0.15}
          emissive={PALETTE.puck}
          emissiveIntensity={0.12}
          envMap={environment ?? null}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Tapa más clara: da la cara superior del disco y le pone un punto de
          referencia al ojo cuando cruza la mesa a toda velocidad. */}
      <mesh position={[0, PUCK_HEIGHT + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PUCK_RADIUS * 0.62, 32]} />
        <meshBasicMaterial color={PALETTE.primaryBright} toneMapped={false} />
      </mesh>
    </group>
  )
}
