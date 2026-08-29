'use client'

import { useEffect } from 'react'
import { GameProvider } from '../components/GameProvider'
import { GameScene } from '../components/game/GameScene'
import { endXrSession } from '../components/xr/xrStore'
import { setAssetsBase } from '../lib/assets'
import { ExitProvider } from './exit'

export interface AirHockeyProps {
  /**
   * De dónde cuelgan los ficheros estáticos del juego: los perfiles de mando de
   * WebXR, sin los cuales el visor se queda sin mandos. Por defecto la raíz del
   * sitio, que es donde los sirve su propia web.
   */
  assetsBase?: string
}

/**
 * El juego entero **con su Canvas y su sesión**, listo para montar dentro de
 * cualquier aplicación de React que quiera una página de juego.
 *
 * Ocupa lo que mida su contenedor —dale una altura— y no sabe nada de rutas,
 * layout ni metadatos: quien lo monta decide dónde vive y qué hay alrededor.
 *
 * Para montarlo DENTRO de un Canvas y una sesión que ya existen —lo que hace el
 * salón inmersivo de xrcade, y lo que permite volver sin quitarse el visor— hay
 * que usar `<AirHockeyScene>`. Este de aquí abre su propia sesión, y en un
 * documento solo cabe una. El contrato completo está en
 * `docs/montar-el-juego.md`.
 */
export function AirHockey({ assetsBase }: AirHockeyProps) {
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  // Quitar el juego tiene que devolver el visor a quien lo montó: la sesión no
  // se cierra sola al desmontar el árbol (ver `xr/xrStore.ts`). Aquí y no en la
  // escena porque es el borde del montaje, lo mismo que promete `unmount()`.
  useEffect(() => () => endXrSession(), [])

  return (
    <GameProvider>
      {/* Aquí salir es cerrar la sesión: esta web es el juego y no hay ningún
          sitio al que volver. En el salón significa lo contrario. */}
      <ExitProvider onExit={endXrSession}>
        <GameScene />
      </ExitProvider>
    </GameProvider>
  )
}
