import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LANG_COOKIE } from '../../lib/settings'
import { MAX_GOALS } from '../../lib/gameConfig'
import { useGame, type GameStore } from '../../lib/gameStore'
import { englishPhrases } from '../../lib/noEnglish'
import { TEXT_KEYS, texto } from '../../lib/textos'
import { GameProvider } from '../GameProvider'
import { HUD } from './HUD'
import { StartScreen } from './StartScreen'

vi.mock('../xr/useImmersiveSupport', () => ({ useImmersiveSupport: () => null }))
vi.mock('../xr/xrStore', () => ({ getXrStore: () => null, endXrSession: () => undefined }))

/**
 * La versión española no dice nada en inglés: la portada, el marcador jugando el reto y el final
 * de ese reto, pintados con el juego en español, pasan por el detector común
 * (`lib/sinIngles.ts`). Es lo que cazaría una frase escrita a mano en un componente sin pasar por
 * `t()`.
 */

const CLAVES = TEXT_KEYS.map((clave) => [clave, texto('es', clave)] as const)

/** Lo que se lee de la página: el texto y lo que dice el lector de pantalla. */
function loQueSeLee(): string {
  const etiquetas = [...document.querySelectorAll('[aria-label],[title]')].map(
    (nodo) => `${nodo.getAttribute('aria-label') ?? ''} ${nodo.getAttribute('title') ?? ''}`,
  )
  return [document.body.textContent ?? '', ...etiquetas].join('\n')
}

let juego: GameStore | null = null
/** Lo que hace quien juega, a mano: el store de la partida que pintan la portada y el marcador. */
function Mando({ alPintar }: { alPintar: (store: GameStore) => void }) {
  const store = useGame()
  useEffect(() => {
    alPintar(store)
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  document.cookie = `${LANG_COOKIE}=es; Path=/`
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.cookie = `${LANG_COOKIE}=; Path=/; Max-Age=0`
})

describe('en español no se escapa nada en inglés', () => {
  it('ni en la portada, ni jugando el reto, ni en su final', () => {
    render(
      <GameProvider>
        <Mando alPintar={(store) => void (juego = store)} />
        <StartScreen />
        <HUD />
      </GameProvider>,
    )
    expect(document.body.textContent).toContain('Jugar')
    expect(englishPhrases(loQueSeLee(), CLAVES)).toEqual([])

    // El menú abre en el reto, que es el modo que da medalla.
    expect(juego!.gameMode).toBe('challenge')
    act(() => juego!.startGame())
    // La cuenta atrás del saque, como en `gameStore.test.tsx`.
    for (let i = 0; i < 10 && juego!.gameState === 'countdown'; i += 1) act(() => void vi.advanceTimersByTime(1000))
    act(() => juego!.scorePlayer())
    expect(juego!.gameState).toBe('playing')
    expect(englishPhrases(loQueSeLee(), CLAVES)).toEqual([])

    for (let i = 0; i < MAX_GOALS && juego!.gameState === 'playing'; i += 1) act(() => juego!.scoreOpponent())
    expect(juego!.gameState).toBe('finished')
    expect(document.body.textContent).toContain('Reto terminado')
    expect(document.body.textContent).toContain('Otro reto')
    expect(englishPhrases(loQueSeLee(), CLAVES)).toEqual([])
  })
})
