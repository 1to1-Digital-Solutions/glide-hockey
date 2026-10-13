'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { ExitRing } from '../xr/ExitRing'
import { getXrStore } from '../xr/xrStore'
import { GameWorld } from './GameWorld'

/**
 * El Canvas de la web del juego: uno de sus anfitriones, no el juego.
 *
 * El juego en sí es `<GameWorld>`, que son objetos de three y nada más. Lo que
 * se pone alrededor —el Canvas, la sesión de WebXR, la cámara de escritorio—
 * es de quien lo hospeda, y esta web es un anfitrión como el salón de xrcade.
 * Que su propia web se monte igual que el salón no es simetría gratuita: es
 * cómo se prueba el juego con el visor sin levantar el hub entero, y lo que
 * hace que un fallo del contrato salga aquí y no allí.
 */

/**
 * Órbita de la cámara de escritorio. Se apaga en cuanto empieza la partida:
 * girar la cámara arrastrando compite con mover el mazo, que se hace con el
 * mismo ratón.
 */
function DesktopControls() {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()

  return (
    <OrbitControls
      enabled={
        mode == null && (gameState === 'menu' || gameState === 'finished')
      }
      enablePan={false}
      minDistance={1}
      maxDistance={5}
      // No se puede mirar por debajo de la mesa: al otro lado no hay nada.
      maxPolarAngle={Math.PI / 2.1}
      target={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}
    />
  )
}

export function GameCanvas() {
  return (
    <Canvas
      // "percentage" = PCFShadowMap. El valor por defecto de R3F es
      // PCFSoftShadowMap, deprecado en three 0.185 (avisa por consola).
      shadows="percentage"
      // Asomado sobre la mesa desde su borde: más alto que de pie y un poco
      // atrás, que es desde donde se ven las dos porterías a la vez. A la
      // altura de los ojos la portería del fondo queda casi de canto y el
      // disco se pierde contra la banda.
      camera={{ position: [0, 2.65, 1.5], fov: 46, near: 0.05, far: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <XR store={getXrStore()}>
        {/* El jugador, de pie en el cero. El mundo se dibuja a su alrededor, no
            al revés: es lo mismo que hace el salón, así que el juego se monta
            idéntico en los dos sitios. */}
        <XROrigin position={[0, 0, 0]} />
        <GameWorld hasDomUi />
        <DesktopControls />
        {/* La salida común, sosteniendo B o Y: en el salón la pone el salón. */}
        <ExitRing />
      </XR>
    </Canvas>
  )
}
