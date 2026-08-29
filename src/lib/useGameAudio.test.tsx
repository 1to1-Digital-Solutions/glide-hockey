import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { saveMuted } from './muted'
import { useGameAudio } from './useGameAudio'

/**
 * Lo que se comprueba aquí es lo único que el hook añade sobre el reproductor
 * (que tiene sus tests en `audioEngine.test.ts`): que haya **un solo contexto
 * de audio**, que aparezca con el primer sonido y no antes, y que se suelte
 * tanto al silenciar como al quitar la mesa.
 *
 * El reproductor va de mentira porque la Web Audio API no existe en jsdom. El
 * almacén, en cambio, es el de verdad: el silencio se cambia como lo cambian
 * los dos menús —guardándolo en el navegador— y así se prueba también el camino
 * de vuelta, que es lo que hace que el juego se calle.
 */
const audio = vi.hoisted(() => ({
  create: vi.fn(),
  play: vi.fn(),
  close: vi.fn(),
}))

vi.mock('./audioEngine', () => ({ createAirHockeyAudio: audio.create }))

/** El juego alrededor del hook: el almacén de verdad, con su contexto. */
function Harness({ children }: { children: ReactNode }) {
  return (
    <GameContext.Provider value={useGameStoreValue()}>
      {children}
    </GameContext.Provider>
  )
}

/** Silencia o vuelve a encender, como haría el menú. */
function setMuted(muted: boolean) {
  act(() => saveMuted(muted))
}

const renderAudio = () => renderHook(() => useGameAudio(), { wrapper: Harness })

/** Qué sonidos se han pedido, en orden. */
const played = () => audio.play.mock.calls.map(([sound]) => sound)

describe('useGameAudio', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // `restoreMocks` deja los dobles sin implementación antes de cada test.
    audio.create.mockImplementation(() => ({
      play: audio.play,
      close: audio.close,
    }))
  })

  it('montar la mesa no abre todavía el audio del navegador', () => {
    renderAudio()

    expect(audio.create).not.toHaveBeenCalled()
  })

  it('un solo reproductor para toda la partida', () => {
    const { result } = renderAudio()

    result.current('strike')
    result.current('bounce')
    result.current('goal')

    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(played()).toEqual(['strike', 'bounce', 'goal'])
  })

  it('silenciado no suena nada, ni se abre el audio', () => {
    setMuted(true)
    const { result } = renderAudio()

    result.current('strike')
    result.current('goal')

    expect(audio.create).not.toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('silenciar suelta el audio del dispositivo, no solo lo calla', () => {
    const { result } = renderAudio()
    result.current('strike')

    setMuted(true)

    expect(audio.close).toHaveBeenCalled()
  })

  it('el sonido se apaga y se enciende sin recargar el juego', () => {
    const view = renderAudio()
    view.result.current('strike')

    setMuted(true)
    view.result.current('bounce')
    expect(played()).toEqual(['strike'])

    setMuted(false)
    view.result.current('goal')
    expect(played()).toEqual(['strike', 'goal'])
    // El que se soltó al silenciar no vuelve: hace falta abrir otro.
    expect(audio.create).toHaveBeenCalledTimes(2)
  })

  it('quitar la mesa se lleva su audio', () => {
    const view = renderAudio()
    view.result.current('strike')

    view.unmount()

    expect(audio.close).toHaveBeenCalled()
  })
})
