import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { MUSIC_VOLUME, musicUrl, saveMusic } from './music'
import { saveMuted } from './muted'
import { useGameMusic } from './useGameMusic'

/**
 * La música de fondo, vista desde la escena.
 *
 * Lo que se prueba es lo que solo pasa aquí: que no se descargue si se entra
 * con la música apagada, que el silencio la calle, que se pare al quitar la
 * escena y que, si el navegador rechaza el primer intento —que es lo normal,
 * porque exige un gesto—, vuelva a probar en cuanto lo haya.
 *
 * El elemento de audio va de mentira porque jsdom no reproduce nada. El almacén
 * es el de verdad: la música se enciende y se apaga como lo hacen los dos
 * menús, guardándola en el navegador.
 */

/** Los reproductores creados, en orden, para mirar qué se les pidió. */
const players: {
  src: string
  loop: boolean
  volume: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}[] = []

/** Si el navegador deja sonar sin gesto previo. */
let allowsAutoplay = true

class FakeAudio {
  loop = false
  volume = 1
  play = vi.fn(() => (allowsAutoplay ? Promise.resolve() : Promise.reject(new Error('gesto'))))
  pause = vi.fn()

  constructor(public src: string) {
    players.push(this as unknown as (typeof players)[number])
  }
}

beforeEach(() => {
  players.length = 0
  allowsAutoplay = true
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function Harness({ children }: { children: ReactNode }) {
  return <GameContext.Provider value={useGameStoreValue()}>{children}</GameContext.Provider>
}

const renderMusic = () => renderHook(() => useGameMusic(), { wrapper: Harness })

describe('la música de fondo', () => {
  // Cada prueba desmonta lo suyo: la preferencia avisa a todo el que esté
  // escuchando, así que un hook de una prueba anterior que siguiera montado
  // reaccionaría a los cambios de la siguiente y crearía reproductores de más.

  it('suena en bucle y bajita, desde donde le toque', () => {
    const hook = renderMusic()

    expect(players).toHaveLength(1)
    expect(players[0].src).toBe(musicUrl())
    expect(players[0].loop).toBe(true)
    expect(players[0].volume).toBe(MUSIC_VOLUME)
    expect(players[0].play).toHaveBeenCalled()
    hook.unmount()
  })

  it('entrando con la música apagada no se descarga nada', () => {
    act(() => saveMusic(false))
    const hook = renderMusic()

    expect(players).toHaveLength(0)
    hook.unmount()
  })

  it('el silencio la calla, aunque la música esté encendida', () => {
    const hook = renderMusic()
    act(() => saveMuted(true))

    expect(players[0].pause).toHaveBeenCalled()
    hook.unmount()
  })

  it('apagarla la para, y volver a encenderla la reanuda con el mismo reproductor', () => {
    const hook = renderMusic()
    act(() => saveMusic(false))
    expect(players[0].pause).toHaveBeenCalled()

    act(() => saveMusic(true))
    // El mismo elemento: volver a crearlo pediría el fichero otra vez.
    expect(players).toHaveLength(1)
    expect(players[0].play).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('quitar la escena se lleva la música', () => {
    const hook = renderMusic()
    hook.unmount()

    expect(players[0].pause).toHaveBeenCalled()
  })

  it('si el navegador la rechaza, vuelve a probar al primer gesto', async () => {
    allowsAutoplay = false
    const hook = renderMusic()
    expect(players[0].play).toHaveBeenCalledTimes(1)

    allowsAutoplay = true
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    expect(players[0].play).toHaveBeenCalledTimes(2)
    hook.unmount()
  })
})
