'use client'

import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Matrix4, Quaternion, RingGeometry, Vector3, type Group } from 'three'

import { EXIT_BUTTONS, HOLD_IDLE, holdStep } from '../../lib/holdToExit'
import { PALETA } from '../../lib/paleta'
import { endXrSession } from './xrStore'

/**
 * El aro de «mantén para salir» en la web propia del juego: sostener un segundo el B o el Y cierra
 * la sesión, y mientras se sostiene un aro se llena delante de los ojos.
 *
 * Es la misma salida que el salón (`xrcade/src/components/salon/AroDeSalir.tsx` y, en Godot,
 * `exit_ring.gd`), con la misma cuenta (`lib/holdToExit.ts`) y el mismo aro: así quien aprende a
 * salir de un juego en el salón sale igual del juego abierto suelto. **Solo lo monta el Canvas de
 * la web del juego**: dentro del salón ya lo pone el salón, y dos aros serían dos salidas. Fuera
 * del visor no hay mandos, y no hace nada.
 */

/** Las medidas del aro, las del salón: a medio metro, unos once grados de ancho. */
export const EXIT_RING = { inner: 0.04, outer: 0.052, distance: 0.5, segments: 48 } as const

/** Lo que ocupa en el índice cada tramo del aro (`RingGeometry` con un solo anillo: dos triángulos). */
const INDICES_POR_TRAMO = 6

const posicion = new Vector3()
const giro = new Quaternion()
const delante = new Vector3()
const uno = new Vector3(1, 1, 1)
const pose = new Matrix4()
const inversa = new Matrix4()

/** Si alguno de los dos mandos tiene apretado uno de los botones de salir. */
function apretado(mandos: readonly ({ gamepad: Record<string, { state?: string } | undefined> } | undefined)[]): boolean {
  return mandos.some((mando) => EXIT_BUTTONS.some((boton) => mando?.gamepad[boton]?.state === 'pressed'))
}

export function AroDeSalir({ onExit = endXrSession }: { onExit?: () => void }) {
  const mode = useXR((state) => state.mode)
  const izquierdo = useXRInputSourceState('controller', 'left')
  const derecho = useXRInputSourceState('controller', 'right')
  const grupo = useRef<Group>(null)
  const cuenta = useRef(HOLD_IDLE)

  // Una vuelta entera desde las doce y hacia la derecha (el ángulo baja); lo que se llena es la
  // misma geometría con menos tramos pintados.
  const relleno = useMemo(
    () => new RingGeometry(EXIT_RING.inner, EXIT_RING.outer, EXIT_RING.segments, 1, Math.PI / 2, -Math.PI * 2),
    [],
  )
  const pista = useMemo(() => new RingGeometry(EXIT_RING.inner, EXIT_RING.outer, EXIT_RING.segments, 1), [])
  useEffect(
    () => () => {
      relleno.dispose()
      pista.dispose()
    },
    [relleno, pista],
  )

  useFrame(({ camera }, delta) => {
    const g = grupo.current
    if (g === null) return
    const paso = holdStep(cuenta.current, mode != null && apretado([izquierdo, derecho]), delta)
    cuenta.current = paso.state
    g.visible = paso.progress > 0
    g.userData.progress = paso.progress
    if (g.visible) {
      relleno.setDrawRange(0, Math.ceil(EXIT_RING.segments * paso.progress) * INDICES_POR_TRAMO)
      // Delante de los ojos, mirándolos, pase lo que pase con los grupos de los que cuelga.
      camera.getWorldPosition(posicion)
      camera.getWorldQuaternion(giro)
      delante.set(0, 0, -EXIT_RING.distance).applyQuaternion(giro).add(posicion)
      pose.compose(delante, giro, uno)
      if (g.parent !== null) {
        g.parent.updateWorldMatrix(true, false)
        pose.premultiply(inversa.copy(g.parent.matrixWorld).invert())
      }
      pose.decompose(g.position, g.quaternion, g.scale)
    }
    if (paso.exit) {
      // Un toque en las dos manos: se ha entendido el gesto, como en el salón.
      for (const mando of [izquierdo, derecho]) {
        const actuadores = (mando?.inputSource.gamepad as { hapticActuators?: readonly { pulse?: (fuerza: number, ms: number) => unknown }[] } | undefined)
          ?.hapticActuators
        void actuadores?.[0]?.pulse?.(0.5, 80)
      }
      onExit()
    }
  })

  return (
    <group ref={grupo} name="aro-de-salir" visible={false} userData={{ role: 'aro-de-salir', progress: 0 }}>
      {/* Por encima de todo lo del juego: sin profundidad y pintado el último. */}
      <mesh geometry={pista} renderOrder={1000} raycast={() => null} position={[0, 0, -0.001]}>
        <meshBasicMaterial color={PALETA.texto} transparent opacity={0.28} depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh name="aro-de-salir-relleno" geometry={relleno} renderOrder={1001} raycast={() => null}>
        <meshBasicMaterial color={PALETA.acento} transparent depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
