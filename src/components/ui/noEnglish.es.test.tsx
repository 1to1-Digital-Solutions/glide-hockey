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
 * The Spanish version says nothing in English: the start screen, the scoreboard while playing the
 * challenge and the end of that challenge, painted with the game in Spanish, go through the
 * common detector (`lib/noEnglish.ts`). It is what would catch a phrase written by hand in a
 * component without going through `t()`.
 */

const KEYS = TEXT_KEYS.map((key) => [key, texto('es', key)] as const)

/** What is read from the page: the text and what the screen reader says. */
function whatIsRead(): string {
  const labels = [...document.querySelectorAll('[aria-label],[title]')].map(
    (node) => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`,
  )
  return [document.body.textContent ?? '', ...labels].join('\n')
}

let game: GameStore | null = null
/** What whoever plays does, by hand: the match store the start screen and the scoreboard paint. */
function Controller({ onRender }: { onRender: (store: GameStore) => void }) {
  const store = useGame()
  useEffect(() => {
    onRender(store)
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

describe('in Spanish nothing slips through in English', () => {
  it('neither on the start screen, nor playing the challenge, nor at its end', () => {
    render(
      <GameProvider>
        <Controller onRender={(store) => void (game = store)} />
        <StartScreen />
        <HUD />
      </GameProvider>,
    )
    expect(document.body.textContent).toContain('Jugar')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])

    // The menu opens on the challenge, which is the mode that gives a medal.
    expect(game!.gameMode).toBe('challenge')
    act(() => game!.startGame())
    // The countdown of the serve, as in `gameStore.test.tsx`.
    for (let i = 0; i < 10 && game!.gameState === 'countdown'; i += 1) act(() => void vi.advanceTimersByTime(1000))
    act(() => game!.scorePlayer())
    expect(game!.gameState).toBe('playing')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])

    for (let i = 0; i < MAX_GOALS && game!.gameState === 'playing'; i += 1) act(() => game!.scoreOpponent())
    expect(game!.gameState).toBe('finished')
    expect(document.body.textContent).toContain('Reto terminado')
    expect(document.body.textContent).toContain('Otro reto')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])
  })
})
