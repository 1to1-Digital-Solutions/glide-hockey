'use client'

import { GoalSign, signAspect } from '../xr/GoalSign'
import { sitioDelCartel } from '../../lib/scoreboardSign'
import { useGame } from '../../lib/gameStore'
import type { Medal } from '../../lib/goal'

/**
 * Dónde cuelga el cartel, con las medidas del cartel de verdad: encima del marcador del fondo
 * (`sitioDelCartel`). Fuera del componente para que los tests lo midan donde queda.
 */
export const SITIO_DEL_CARTEL = sitioDelCartel(signAspect())

/**
 * El cartel del objetivo, colgado encima del marcador del fondo.
 *
 * Aquí solo se junta lo de cada lado: qué dice sale del store (`cartel`), dónde va lo decide
 * `sitioDelCartel` y lo pinta el componente común a todos los juegos del salón.
 *
 * Cuelga de la interfaz, junto al marcador: sube y baja con los ojos de quien juega igual que él
 * (`XRUiHeight`), así que sigue quedando justo encima y a la altura de la vista.
 *
 * @param alCelebrar Lo que el juego hace al cruzar un listón: el golpe en la mano del mazo. El
 *   sonido lo pone la escena, que lo oye también quien juega sin visor.
 */
export function CartelDelMarcador({ alCelebrar }: { alCelebrar?: (medalla: Medal) => void }) {
  const { cartel, medalla } = useGame()

  if (cartel == null) return null

  return (
    <GoalSign
      view={cartel}
      position={SITIO_DEL_CARTEL.position}
      rotation={SITIO_DEL_CARTEL.rotation}
      distance={SITIO_DEL_CARTEL.distancia}
      celebrate={medalla}
      onCelebrate={alCelebrar}
    />
  )
}
