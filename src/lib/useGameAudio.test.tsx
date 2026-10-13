import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { useGameAudio } from './useGameAudio'
import { DEFAULT_VOLUMES } from './settings'
import { setVolume } from './settingsClient'

/**
 * Lo que se comprueba aquí es lo único que el hook añade sobre el reproductor
 * (que tiene sus tests en `audioEngine.test.ts`): que haya **un solo contexto
 * de audio**, que aparezca con el primer sonido y no antes, y que se suelte
 * tanto al silenciar como al quitar la escena.
 *
 * El reproductor va de mentira porque la Web Audio API no existe en jsdom. El
 * almacén, en cambio, es el de verdad: el silencio se cambia como lo cambian
 * los dos menús —guardándolo en el navegador— y así se prueba también el camino
 * de vuelta, que es lo que hace que el juego se calle.
 */
const audio = vi.hoisted(() => ({
  create: vi.fn(),
  play: vi.fn(),
  slide: vi.fn(),
  close: vi.fn(),
  setVolume: vi.fn(),
  setLowpass: vi.fn(),
}))

vi.mock('./audioEngine', () => ({ createGlideHockeyAudio: audio.create }))

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
  act(() => setVolume('sfx', muted ? 0 : DEFAULT_VOLUMES.sfx))
}

const renderAudio = () => renderHook(() => useGameAudio(), { wrapper: Harness })

/** Qué sonidos se han pedido, en orden. */
const played = () => audio.play.mock.calls.map(([sound]) => sound)

describe('useGameAudio', () => {
  beforeEach(() => {
  // Los volúmenes salen de los ajustes del arcade, que cachean lo leído para
  // que `useSyncExternalStore` no repinte sin parar: vaciar `localStorage` a
  // secas dejaría el caché con el valor de la prueba anterior. Se restablecen
  // por la API, que es la que lo invalida.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
    window.localStorage.clear()
    // `restoreMocks` deja los dobles sin implementación antes de cada test.
    audio.create.mockImplementation(() => ({
      play: audio.play,
      slide: audio.slide,
      close: audio.close,
      setVolume: audio.setVolume,
      setLowpass: audio.setLowpass,
    }))
  })

  it('montar la mesa no abre todavía el audio del navegador', () => {
    renderAudio()

    expect(audio.create).not.toHaveBeenCalled()
  })

  it('un solo reproductor para toda la partida', () => {
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.play('bounce')
    result.current.play('goal')

    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(played()).toEqual(['strike', 'bounce', 'goal'])
  })

  it('silenciado no suena nada, ni se abre el audio', () => {
    setMuted(true)
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.play('goal')

    expect(audio.create).not.toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('silenciar suelta el audio del dispositivo, no solo lo calla', () => {
    const { result } = renderAudio()
    result.current.play('strike')

    setMuted(true)

    expect(audio.close).toHaveBeenCalled()
  })

  it('el sonido se apaga y se enciende sin recargar el juego', () => {
    const view = renderAudio()
    view.result.current.play('strike')

    setMuted(true)
    view.result.current.play('bounce')
    expect(played()).toEqual(['strike'])

    setMuted(false)
    view.result.current.play('goal')
    expect(played()).toEqual(['strike', 'goal'])
    // El que se soltó al silenciar no vuelve: hace falta abrir otro.
    expect(audio.create).toHaveBeenCalledTimes(2)
  })

  it('quitar la escena se lleva su audio', () => {
    const view = renderAudio()
    view.result.current.play('strike')

    view.unmount()

    expect(audio.close).toHaveBeenCalled()
  })

  it('el roce va por el mismo reproductor y no lo abre antes del primer golpe', () => {
    const { result } = renderAudio()

    result.current.slide(3)
    expect(audio.create).not.toHaveBeenCalled()

    result.current.play('strike')
    result.current.slide(3)
    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(audio.slide).toHaveBeenCalledWith(3)
  })

  it('silenciado, el roce tampoco suena', () => {
    setMuted(true)
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.slide(3)
    expect(audio.slide).not.toHaveBeenCalled()
  })

  it('el filtro del golpe llega al bus abierto, y sin audio abierto no abre nada', () => {
    const { result } = renderAudio()
    result.current.filtrar(500)
    expect(audio.create).not.toHaveBeenCalled()

    result.current.play('strike')
    result.current.filtrar(700)
    expect(audio.setLowpass).toHaveBeenCalledWith(700)
  })
})
