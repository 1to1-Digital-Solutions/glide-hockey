'use client'

import { GameProvider } from '../components/GameProvider'
import { GameWorld } from '../components/game/GameWorld'
import { setAssetsBase } from '../lib/assets'
import type { HostAnchor } from '../lib/hostAnchor'
import type { Resultado, Reto } from '../lib/semilla'
import { ExitProvider } from './exit'

export interface GlideHockeySceneProps {
  /**
   * De dónde cuelgan los ficheros estáticos del juego (los perfiles de mando de
   * WebXR, que se copian de `public/`). Los sirve el anfitrión, bajo su propio
   * prefijo: dos juegos en el mismo origen se pisarían.
   *
   * Los perfiles los pide el store de WebXR, que aquí es del anfitrión: hay que
   * crearlo con `baseAssetPath` apuntando a `<assetsBase>/webxr-profiles/` o el
   * jugador se queda sin mandos (ver `docs/montar-el-juego.md`).
   */
  assetsBase?: string
  /**
   * Dónde y con qué rumbo plantar el mundo del juego, si quien monta la escena
   * lo sabe: el salón de xrcade presta el anclaje con el que tiene plantado su
   * arco de cabinas.
   *
   * **Sin él, el mundo se planta delante de donde se mire al entrar**, que es
   * lo único que se sabe en la web propia del juego. Dentro del salón eso
   * descoloca: leer las cabinas de la izquierda obliga a girar la cabeza, y el
   * juego salía girado hacia allí.
   */
  anchor?: HostAnchor
  /**
   * Devolver al jugador a donde estaba. Lo llama el juego desde su interfaz
   * inmersiva; qué significa volver lo decide quien monta.
   */
  onExit: () => void
  /**
   * La partida que se juega, si es un reto (el del día, o el código de «reta mi
   * puntuación»).
   *
   * Con él la escena entra **ya jugando** el reto (`challenge`, el modo del
   * récord), sin tutorial y con los tiros de la máquina sacados de la semilla:
   * misma semilla, misma máquina en cada ronda. Sin él, el juego abre su menú y
   * juega como siempre.
   */
  reto?: Reto
  /**
   * Se llama una vez al acabar cada partida —no al dejarla a medias—, con el
   * modo, los puntos aunque no sean récord y si era la partida del `reto`.
   */
  onTerminar?: (resultado: Resultado) => void
}

/**
 * Glide Hockey como ESCENA: lo que se pinta dentro del Canvas de otro.
 *
 * Es el contrato con el que xrcade monta un juego dentro de su salón. No crea
 * Canvas, no abre ni cierra la sesión inmersiva y no pinta una sola etiqueta de
 * DOM: solo objetos de three. Así, entrar en el juego y volver al salón son
 * montar y desmontar un trozo de escena, y la sesión ni se entera — que es lo
 * que permite pasar de un juego al salón sin quitarse el visor.
 *
 * Para montarlo con su interfaz 2D y su propia sesión —lo que quiere una página
 * web normal— está `<GlideHockey>`, que es esta escena con un Canvas alrededor.
 *
 * El contrato completo, en `docs/montar-el-juego.md`.
 */
export function GlideHockeyScene({ assetsBase, anchor, onExit, reto, onTerminar }: GlideHockeySceneProps) {
  // Durante el render y no en un efecto: el store de WebXR resuelve su base de
  // ficheros la primera vez que alguien lo pide, que puede ser antes de que
  // corra ningún efecto. Escribir la misma base dos veces no cambia nada, así
  // que repetir el render es inocuo.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  return (
    <GameProvider reto={reto} onTerminar={onTerminar}>
      <ExitProvider onExit={onExit}>
        <GameWorld anchor={anchor} />
      </ExitProvider>
    </GameProvider>
  )
}
