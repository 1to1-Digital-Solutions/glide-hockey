'use client'

import { type Ref } from 'react'
import { type Group, type Texture } from 'three'
import { NO_RAYCAST } from '../raycast'
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
 *
 * **Fuera del alcance de los rayos.** Con el visor puesto el mazo va en la mano, y el rayo
 * con el que se pulsa el menú sale de esa misma mano: lo primero que se encuentra es el mazo,
 * que se queda con el evento y deja al botón sin enterarse. Desde dentro eso no se ve como
 * «el mazo está en medio», se ve como que **el botón no funciona**. El arreglo llegó a los
 * demás juegos y a este no —el mismo mazo, el mismo fallo, y en hole-patrol ya estaba
 * escrito—. En escritorio no se pierde nada: ahí no hay rayo.
 */
export function Mallet({
  color,
  environment,
  resaltado = false,
  ref,
}: {
  color: string
  /** Los reflejos de la sala, los mismos que lleva el tablero. */
  environment?: Texture
  /**
   * Que hay que cogerlo **ahora**: se enciende para que se vea cuál es.
   *
   * Lo pide la cuenta atrás mientras espera a tenerlo en la mano. Sin esto, lo único que
   * pasaba era que el 1 se quedaba clavado: «el countdown se queda parado en el 1 sin
   * ninguna explicación. Se podría ayudar al usuario, o que el objeto brille más».
   */
  resaltado?: boolean
  ref?: Ref<Group>
}) {
  return (
    <group ref={ref}>
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow raycast={NO_RAYCAST}>
        <cylinderGeometry
          args={[MALLET_RADIUS, MALLET_RADIUS, BASE_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.1}
          envMap={environment ?? null}
          envMapIntensity={0.5}
          emissive={color}
          emissiveIntensity={resaltado ? 0.9 : 0}
        />
      </mesh>

      <mesh position={[0, BASE_HEIGHT + KNOB_HEIGHT / 2, 0]} castShadow raycast={NO_RAYCAST}>
        <cylinderGeometry
          args={[MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, KNOB_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          envMap={environment ?? null}
          envMapIntensity={0.4}
          emissive={color}
          emissiveIntensity={resaltado ? 0.9 : 0}
        />
      </mesh>
    </group>
  )
}
