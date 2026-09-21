'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'

import { entryPlacement, type HostAnchor } from '../../lib/hostAnchor'

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
export function WorldAnchor({
  children,
  anchor,
}: {
  children: ReactNode
  /**
   * Dónde y con qué rumbo plantarlo, si quien monta la escena lo sabe: el salón
   * de xrcade presta el anclaje con el que tiene plantado su arco de cabinas.
   * Sin él manda la mirada, que es lo único que se sabe en la web del juego.
   */
  anchor?: HostAnchor
}) {
  const ref = useRef<Group>(null)
  const mode = useXR((state) => state.mode)
  const placed = useRef(false)
  /**
   * El anclaje prestado, mientras no se haya usado.
   *
   * Se gasta en la primera colocación: a partir de ahí manda la mirada, que es lo que hace
   * falta al recentrar la sala, porque entonces el espacio de referencia se mueve entero y
   * lo prestado se queda apuntando a donde ya no hay nada.
   */
  const lent = useRef(anchor ?? null)

  // Cada sesión se coloca de nuevo: al volver a entrar, el jugador puede estar
  // en otro sitio de la habitación y mirando a otro lado.
  useEffect(() => {
    placed.current = false
  }, [mode])
  /**
   * **Y al recentrar la sala.** Mantener pulsado el botón del sistema recoloca el espacio de
   * referencia del visor: el mundo entero gira bajo la colocación, que sigue apuntando a
   * donde se miraba antes, y la escena acaba a la espalda. Es el gesto que se hace al volver
   * a ponerse el visor. WebXR lo avisa con el evento `reset` del espacio de referencia.
   */
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  useEffect(() => {
    if (referenceSpace == null) return
    const alRecentrar = () => {
      placed.current = false
    }
    referenceSpace.addEventListener('reset', alRecentrar)
    return () => referenceSpace.removeEventListener('reset', alRecentrar)
  }, [referenceSpace])

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

    // Dónde y con qué rumbo se planta, todavía en coordenadas del mundo: lo que preste el
    // anfitrión si presta algo, y si no, los pies y la mirada de ahora. **Anclar a la mirada
    // dentro del salón descoloca**: leer las cabinas de la izquierda obliga a girar la
    // cabeza, y así el decorado salía girado hacia allí, de lado respecto del cuerpo.
    const sitio = entryPlacement(lent.current, { x: gazePosition.x, z: gazePosition.z }, gazeEuler.y)
    lent.current = null
    gazePosition.set(sitio.x, 0, sitio.z)

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
    group.rotation.set(0, sitio.yaw - parentYaw, 0)
  })

  // El grupo lleva nombre para poder medir desde fuera dónde acabó plantado el
  // decorado: es lo que comprueba el e2e del anclaje, que desde una pantalla no se ve.
  return (
    <group ref={ref} name="world-anchor">
      {children}
    </group>
  )
}

// Reutilizados entre fotogramas: crear vectores dentro de `useFrame` genera
// basura en cada uno de los noventa fotogramas por segundo del visor.
const gazePosition = new Vector3()
const gazeQuaternion = new Quaternion()
const gazeEuler = new Euler()
const parentQuaternion = new Quaternion()
const parentEuler = new Euler()
