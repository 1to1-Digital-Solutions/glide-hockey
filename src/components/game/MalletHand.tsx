'use client'

import { useFrame } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'
import { useRef } from 'react'
import { Vector3, type Group } from 'three'

import { siguienteAgarre, type ManoEnLaMesa } from '../../lib/malletGrab'
import { constrainMallet, type Vec2 } from '../../lib/puckPhysics'

/**
 * El mazo en la mano, con el visor puesto.
 *
 * Lee las dos manos cada fotograma, las trae a coordenadas de la mesa y le pasa el destino
 * al mazo mientras se sostenga. Lo que decide cuándo se coge y cuándo se suelta es
 * `lib/malletGrab.ts`, que se prueba sin visor; aquí solo está lo que necesita a three: la
 * pose del mando y el cambio de coordenadas.
 *
 * **Las dos manos, no una elegida.** Quien juega coge el mazo con la que tenga libre y la
 * cambia a media partida, como en una mesa de verdad. Manda la que esté agarrando; si las
 * dos aprietan, la que ya lo llevaba.
 *
 * Fuera de sesión no hace nada: allí el mazo lo lleva el ratón sobre el tablero.
 */
export function MalletHand({
  rink,
  destino,
  onMove,
  onRelease,
}: {
  /** La mesa, para pasar del mundo a sus coordenadas. */
  rink: React.RefObject<Group | null>
  /**
   * Dónde va el mazo ahora mismo. Es el mismo dato que mueve la mesa, no una copia: si
   * fueran dos, coger el mazo se mediría contra un mazo que no es el que se ve.
   */
  destino: React.RefObject<Vec2>
  /** A dónde va el mazo, ya dentro de los límites de la mesa, y que va cogido. */
  onMove: (destino: Vec2, cogido: boolean) => void
  /** Se ha soltado: el mazo vuelve a perseguir en vez de ir en la mano. */
  onRelease: () => void
}) {
  const izquierda = useXRInputSourceState('controller', 'left')
  const derecha = useXRInputSourceState('controller', 'right')

  /** Si el mazo va en la mano. Dónde está lo dice `destino`, que es de la mesa. */
  const cogido = useRef(false)
  // Se reutiliza entre fotogramas: `worldToLocal` muta lo que recibe y esto corre a 90 Hz.
  const punto = useRef(new Vector3())

  useFrame(() => {
    const grupo = rink.current
    if (grupo == null) return

    const mano = manoQueManda(izquierda, derecha, cogido.current)
    let enLaMesa: ManoEnLaMesa | null = null

    if (mano?.object != null) {
      // La pose del mando llega en coordenadas del mundo; la mesa puede estar movida y
      // girada (el salón la coloca donde le toca), así que se trae a las suyas.
      const local = grupo.worldToLocal(punto.current.setFromMatrixPosition(mano.object.matrixWorld))
      enLaMesa = {
        posicion: { x: local.x, z: local.z },
        agarrando: mano.gamepad['xr-standard-squeeze']?.state === 'pressed',
      }
    }

    const siguiente = siguienteAgarre(
      { cogido: cogido.current, destino: destino.current },
      enLaMesa,
    )
    const soltado = cogido.current && !siguiente.cogido
    cogido.current = siguiente.cogido
    if (siguiente.cogido) onMove(constrainMallet(siguiente.destino, 'player'), true)
    else if (soltado) onRelease()
  })

  return null
}

/**
 * Cuál de las dos manos lleva el mazo.
 *
 * Con el mazo ya cogido manda la que siga apretando —cambiar de mano a mitad de un golpe
 * porque la otra rozó el botón sería perderlo—; libre, la primera que apriete.
 */
function manoQueManda<T extends { gamepad: { 'xr-standard-squeeze'?: { state: string } } }>(
  izquierda: T | undefined,
  derecha: T | undefined,
  cogido: boolean,
): T | undefined {
  const aprieta = (m: T | undefined) => m?.gamepad['xr-standard-squeeze']?.state === 'pressed'

  if (cogido) return aprieta(izquierda) ? izquierda : aprieta(derecha) ? derecha : undefined
  if (aprieta(izquierda)) return izquierda
  if (aprieta(derecha)) return derecha
  // Sin nadie apretando se devuelve una cualquiera: hace falta su posición para saber si
  // la mano está encima del mazo cuando apriete.
  return izquierda ?? derecha
}
