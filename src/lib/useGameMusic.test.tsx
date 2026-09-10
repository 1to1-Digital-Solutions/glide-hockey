import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { MUSIC_VOLUME, musicUrl } from './music'
import { MUSIC_FADE_MS } from './musicFade'
import { useGameMusic } from './useGameMusic'
import { DEFAULT_VOLUMES, volumeFactor } from './ajustes'
import { setVolume } from './ajustesCliente'

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
  // Los volúmenes salen de los ajustes del arcade, que cachean lo leído para
  // que `useSyncExternalStore` no repinte sin parar: vaciar `localStorage` a
  // secas dejaría el caché con el valor de la prueba anterior. Se restablecen
  // por la API, que es la que lo invalida.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
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


/**
 * Espera a que termine el fundido.
 *
 * La música ya no entra ni se va de golpe (`lib/musicFade.ts`), así que el volumen final y
 * el `pause()` llegan al acabar la rampa y no en la misma línea. Se espera de verdad y no
 * con relojes falsos porque la rampa va por fotogramas: falsear el reloj sin falsear
 * `requestAnimationFrame` la dejaría parada, y falsear los dos es más maquinaria que los
 * setecientos milisegundos que cuesta esperarla.
 */
async function trasElFundido() {
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, MUSIC_FADE_MS + 120))
  })
}

describe('la música de fondo', () => {
  // Cada prueba desmonta lo suyo: la preferencia avisa a todo el que esté
  // escuchando, así que un hook de una prueba anterior que siguiera montado
  // reaccionaría a los cambios de la siguiente y crearía reproductores de más.

  it('suena en bucle y bajita, desde donde le toque', async () => {
    const hook = renderMusic()
    await trasElFundido()

    expect(players).toHaveLength(1)
    expect(players[0].src).toBe(musicUrl())
    expect(players[0].loop).toBe(true)
    expect(players[0].volume).toBeCloseTo(MUSIC_VOLUME * volumeFactor(DEFAULT_VOLUMES.ambience))
    expect(players[0].play).toHaveBeenCalled()
    hook.unmount()
  })

  it('entrando con la música apagada no se descarga nada', () => {
    act(() => setVolume('ambience', 0))
    const hook = renderMusic()

    expect(players).toHaveLength(0)
    hook.unmount()
  })

  it('quitar los efectos no la calla: son dos canales aparte', () => {
    // Antes el silencio mandaba sobre todo. Ahora los ajustes del arcade
    // separan «sonidos interactivos» de «sonidos ambientales» a propósito: hay
    // quien quiere oír el fondo y no el juego, y quien prefiere lo contrario.
    const hook = renderMusic()
    act(() => setVolume('sfx', true ? 0 : DEFAULT_VOLUMES.sfx))

    expect(players[0].pause).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('apagarla la para, y volver a encenderla la reanuda con el mismo reproductor', async () => {
    const hook = renderMusic()
    act(() => setVolume('ambience', 0))
    await trasElFundido()
    expect(players[0].pause).toHaveBeenCalled()

    act(() => setVolume('ambience', DEFAULT_VOLUMES.ambience))
    // El mismo elemento: volver a crearlo pediría el fichero otra vez.
    expect(players).toHaveLength(1)
    expect(players[0].play).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('quitar la escena se lleva la música', async () => {
    const hook = renderMusic()
    hook.unmount()
    // Bajándola, no cortándola: el salón devuelve la suya justo detrás.
    await trasElFundido()

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
