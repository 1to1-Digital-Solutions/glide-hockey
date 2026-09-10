'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { useXR } from '@react-three/xr'
import type { Group } from 'three'

import { usePlayHeight } from '../../lib/ajustesCliente'
import {
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  worldRise,
  type HeightTracker,
} from '../../lib/uiHeight'

/**
 * Baja el mundo hasta quien juega, si lo ha pedido.
 *
 * **Lo que arregla.** Las cotas de la escena se eligieron con una persona de
 * pie delante, y esa persona quedó dentro del código. Sentado —en una silla, en
 * un sofá, en una silla de ruedas— el mundo entero queda por encima de donde
 * llega el brazo, y no falla nada: simplemente no hay partida. Es la barrera
 * más grande que tenía el arcade, y la única que no se podía sortear jugando
 * peor.
 *
 * **Solo cuando se pide.** La altura de juego se elige una vez en los ajustes
 * del arcade y vale para las trece cabinas (`lib/ajustes.ts`). Adivinarla sería
 * peor que no tenerla: a quien está de pie, mover el suelo bajo los pies le
 * revuelve el estómago, y hay gente baja que prefiere el mundo como es.
 *
 * **Se coloca y se queda quieto.** Un mundo que persiguiera la cabeza subiría
 * al ponerse de puntillas y bajaría al agacharse, justo cuando se está
 * apuntando. Solo un cambio grande y sostenido —sentarse a media partida— lo
 * vuelve a colocar, con el mismo seguimiento que usa la interfaz.
 *
 * Se mueve por referencia y no por estado: es una cota que cambia como mucho
 * dos veces por sesión, y repintar el árbol por ella sería repintarlo por nada.
 *
 * Fuera del visor no hay a quién medir y el grupo se queda en cero, que es
 * donde ha estado siempre la escena.
 */
export function XRWorldHeight({ children }: { children: ReactNode }) {
  const grupo = useRef<Group>(null)
  const seguimiento = useRef<HeightTracker>(startTracking())
  const mode = useXR((state) => state.mode)
  const conSuelo = useXR((state) =>
    hasFloorReference(state.session?.enabledFeatures),
  )
  const aLaAlturaDeLosOjos = usePlayHeight() === 'eyes'

  useFrame(({ camera }, delta) => {
    const node = grupo.current
    if (node == null) return

    if (mode == null) {
      // Fuera de sesión no hay estatura que seguir, y la próxima empieza a
      // medir de cero.
      seguimiento.current = startTracking()
      node.position.y = 0
      return
    }

    // Sin suelo, el origen es el punto donde arrancó la sesión y la cota de la
    // cabeza no mide desde el suelo: no es una estatura y no se puede usar.
    const medida =
      conSuelo && isPlausibleEyeHeight(camera.position.y)
        ? camera.position.y
        : null
    seguimiento.current = trackHeight(
      seguimiento.current,
      medida,
      1 - Math.exp(-3.5 * delta),
      delta,
    )
    node.position.y = worldRise(seguimiento.current.held, aLaAlturaDeLosOjos)
  })

  return <group ref={grupo}>{children}</group>
}
