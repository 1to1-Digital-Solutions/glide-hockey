'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { useXR } from '@react-three/xr'
import type { Group } from 'three'

import { usePlayHeight } from '../../lib/settingsClient'
import {
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  uiRiseOverWorld,
  type HeightTracker,
} from '../../lib/uiHeight'

/**
 * Pone lo que cuelgue de aquí a la altura de los ojos de quien juega.
 *
 * Las cotas de la interfaz se midieron con una persona delante, y esa persona quedó dentro
 * del código: a alguien de metro y medio los paneles le quedan por encima de la vista cómoda
 * —y ahí están los ajustes y el botón de salir— y a alguien de dos metros, a la altura del
 * pecho. Es de las pocas cosas que no se pueden ajustar a mano, porque nadie va a entrar en
 * un menú que no alcanza para subir el menú.
 *
 * **Se coloca y se queda quieta.** Una interfaz que persiguiera la cabeza subiría al ponerse
 * de puntillas y bajaría al agacharse, justo mientras se apunta a un botón. Solo un cambio
 * grande y sostenido —sentarse— la vuelve a colocar (ver `lib/uiHeight.ts`).
 *
 * Se mueve por referencia y no por estado: es una cota que cambia como mucho dos veces por
 * sesión, y repintar el árbol por ella sería repintarlo por nada.
 *
 * Fuera del visor no hay a quién medir y el grupo se queda en cero, que es donde han estado
 * siempre las cotas.
 */
export function XRUiHeight({ children }: { children: ReactNode }) {
  const grupo = useRef<Group>(null)
  const seguimiento = useRef<HeightTracker>(startTracking())
  const mode = useXR((state) => state.mode)
  const conSuelo = useXR((state) => hasFloorReference(state.session?.enabledFeatures))
  // Si el mundo entero ya ha bajado, la interfaz vino con él y no le hace
  // falta corrección propia (ver `uiRiseOverWorld`).
  const aLaAlturaDeLosOjos = usePlayHeight() === 'eyes'

  useFrame(({ camera }, delta) => {
    const node = grupo.current
    if (node == null) return

    if (mode == null) {
      // Fuera de sesión no hay estatura que seguir, y la próxima empieza a medir de cero.
      seguimiento.current = startTracking()
      node.position.y = 0
      return
    }

    // Sin suelo, el origen es el punto donde arrancó la sesión y la cota de la cabeza no
    // mide desde el suelo: no es una estatura y no se puede usar como tal.
    const medida = conSuelo && isPlausibleEyeHeight(camera.position.y) ? camera.position.y : null
    seguimiento.current = trackHeight(seguimiento.current, medida, 1 - Math.exp(-3.5 * delta), delta)
    node.position.y = uiRiseOverWorld(seguimiento.current.held, aLaAlturaDeLosOjos)
  })

  return <group ref={grupo}>{children}</group>
}
