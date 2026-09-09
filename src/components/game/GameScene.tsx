'use client'

import { Suspense, lazy, useSyncExternalStore } from 'react'
import { useGame } from '../../lib/gameStore'
import { AIR_HOCKEY_CSS_VARIABLES } from '../../lib/palette'
import { HUD } from '../ui/HUD'
import { StartScreen } from '../ui/StartScreen'

// El Canvas de R3F depende de WebGL y de `window`, así que se carga aparte y
// solo en cliente. Con `lazy` de React y no con `next/dynamic`: el juego se
// monta también dentro de otras aplicaciones, que no tienen por qué ser Next.
const GameCanvas = lazy(() =>
  import('./GameCanvas').then((mod) => ({ default: mod.GameCanvas })),
)

/**
 * Si el juego ya se está pintando en el navegador.
 *
 * Es una suscripción a algo que nunca cambia porque lo que distingue los dos
 * valores es *quién* pregunta: en un render de servidor no hay WebGL con el que
 * montar el Canvas, y pintar en la hidratación lo mismo que se prerenderizó es
 * lo que evita el aviso de desajuste.
 */
const NEVER_CHANGES = () => () => {}
const useOnClient = () =>
  useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  )

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]">
      <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
        Setting up the table…
      </p>
    </div>
  )
}

/**
 * La pantalla de juego de escritorio: el Canvas siempre montado y, encima, el
 * menú o el marcador según toque.
 *
 * El Canvas no se desmonta al volver al menú a propósito: la sesión inmersiva
 * se pide desde el DOM y necesita encontrar la escena ya en el árbol, o al
 * ponerse el visor no se ve nada.
 */
export function GameScene() {
  const { gameState } = useGame()
  const onClient = useOnClient()

  return (
    <div
      // Durante la partida el cursor lleva el mazo: una flecha de escritorio
      // encima de la mesa distrae de dónde está de verdad.
      className={`air-hockey relative h-full w-full ${
        gameState === 'playing' ? 'cursor-none' : ''
      }`}
      // La paleta, aquí y no en `styles.css`: así el CSS, la escena y la
      // interfaz del visor leen los mismos literales sin ningún paso de build
      // (ver `lib/palette.ts`). Y en este elemento, que es el que lleva la
      // clase `.air-hockey`: las variables no salen del juego.
      style={AIR_HOCKEY_CSS_VARIABLES}
    >
      {onClient ? (
        <Suspense fallback={<SceneLoading />}>
          <GameCanvas />
        </Suspense>
      ) : (
        <SceneLoading />
      )}
      {gameState === 'menu' ? <StartScreen /> : <HUD />}
    </div>
  )
}
