'use client'

import { GoalSign, signAspect } from '../xr/GoalSign'
import { signPlacement } from '../../lib/scoreboardSign'
import { useGame } from '../../lib/gameStore'
import type { Medal } from '../../lib/goal'

/**
 * Dónde cuelga el cartel, con las medidas del cartel de verdad: encima del marcador del fondo
 * (`sitioDelCartel`). Fuera del componente para que los tests lo midan donde queda.
 */
export const SIGN_PLACEMENT = signPlacement(signAspect())

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
export function ScoreboardSign({ alCelebrar: onCelebrate }: { alCelebrar?: (medalla: Medal) => void }) {
  const { cartel, medal: medalla } = useGame()

  if (cartel == null) return null

  return (
    <GoalSign
      view={cartel}
      position={SIGN_PLACEMENT.position}
      rotation={SIGN_PLACEMENT.rotation}
      distance={SIGN_PLACEMENT.distance}
      celebrate={medalla}
      onCelebrate={onCelebrate}
    />
  )
}
