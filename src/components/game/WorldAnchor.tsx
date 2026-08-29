'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'

/**
 * Planta el mundo del juego delante del jugador al entrar en el visor.
 *
 * La escena no puede mover al jugador —el sitio donde está lo decide su
 * anfitrión, y el juego no pone `<XROrigin>` (ver `docs/xrcade.md`)—, así que
 * mueve el decorado: al empezar la sesión, la mesa se coloca donde el jugador
 * esté y encarada hacia donde mire. Sin esto, quien entra mirando a otro lado
 * se encuentra la mesa a la espalda.
 *
 * **Se coloca una vez por sesión y se queda quieta.** Una mesa que persiguiera
 * la cabeza sería injugable: el disco se apunta sobre ella y cualquier deriva
 * mueve el objetivo bajo la mano. Que haya que girarse hacia ella al empezar es
 * lo mismo que pasa con una mesa de verdad.
 *
 * Fuera de sesión inmersiva no transforma nada: en escritorio manda la cámara,
 * que ya mira a la mesa.
 */
export function WorldAnchor({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  const mode = useXR((state) => state.mode)
  const placed = useRef(false)

  // Cada sesión se coloca de nuevo: al volver a entrar, el jugador puede estar
  // en otro sitio de la habitación y mirando a otro lado.
  useEffect(() => {
    placed.current = false
  }, [mode])

  useFrame((state) => {
    const group = ref.current
    if (group == null) return

    if (mode == null) {
      // Al salir del visor se deshace la colocación: la cámara de escritorio
      // apunta a donde está la mesa por defecto, no a donde se quedó.
      if (placed.current) {
        group.position.set(0, 0, 0)
        group.rotation.set(0, 0, 0)
        placed.current = false
      }
      return
    }

    if (placed.current) return
    placed.current = true

    const { camera } = state
    camera.getWorldPosition(gazePosition)
    camera.getWorldQuaternion(gazeQuaternion)

    // El orden YXZ aísla el giro horizontal en el primer ángulo: así la mesa se
    // encara hacia donde mira el jugador sin heredar la inclinación de su
    // cabeza, que la dejaría torcida.
    gazeEuler.setFromQuaternion(gazeQuaternion, 'YXZ')

    // Se trabaja en el espacio del padre —el `<XROrigin>` de quien monta—, así
    // que hay que descontar su orientación en vez de darla por cero.
    let parentYaw = 0
    const parent = group.parent
    if (parent != null) {
      parent.getWorldQuaternion(parentQuaternion)
      parentEuler.setFromQuaternion(parentQuaternion, 'YXZ')
      parentYaw = parentEuler.y
      parent.worldToLocal(gazePosition)
    }

    // Solo el suelo: la altura de la mesa es la suya, no la de los ojos de
    // quien entra.
    group.position.set(gazePosition.x, 0, gazePosition.z)
    group.rotation.set(0, gazeEuler.y - parentYaw, 0)
  })

  return <group ref={ref}>{children}</group>
}

// Reutilizados entre fotogramas: crear vectores dentro de `useFrame` genera
// basura en cada uno de los noventa fotogramas por segundo del visor.
const gazePosition = new Vector3()
const gazeQuaternion = new Quaternion()
const gazeEuler = new Euler()
const parentQuaternion = new Quaternion()
const parentEuler = new Euler()
