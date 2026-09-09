import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_LANG,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  LANG_COOKIE,
  VOLUME_KEYS,
} from './ajustes'
import {
  currentLang,
  setLang,
  setVolume,
  settingsStorage,
  useLang,
  useVolumes,
} from './ajustesCliente'

/**
 * Los ajustes del arcade vistos desde el navegador: que lo que cambia en la
 * portada llegue a lo que ya está pintado dentro de la cabina.
 *
 * Lo que se prueba de verdad es el aviso. Guardar es fácil; lo que se rompe en
 * silencio es que nadie se entere: `localStorage` no avisa a la pestaña que
 * escribe y una cookie no avisa a nadie nunca, así que sin el evento propio el
 * juego se quedaría sonando —o hablando— como estaba hasta la siguiente carga.
 *
 * La instantánea se cachea a propósito (`useSyncExternalStore` compara por
 * identidad), y eso es justo lo que puede quedarse rancio: por eso hay un test
 * de que cambiar el volumen invalida lo cacheado aunque no haya nadie
 * escuchando todavía.
 */

beforeEach(() => {
  // El almacén cachea lo leído, así que vaciar `localStorage` a pelo dejaría la
  // instantánea anterior en pie: se vuelve a lo de partida por donde se cambia.
  window.localStorage.clear()
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
  document.cookie = `${LANG_COOKIE}=; Path=/; Max-Age=0`
})

describe('dónde se guarda', () => {
  it('es el almacenamiento de esta ventana', () => {
    expect(settingsStorage()).toBe(window.localStorage)
  })

  it('no hay dónde si el navegador lo tiene bloqueado', () => {
    // Ventana privada, o cookies de sitio bloqueadas: `localStorage` no
    // devuelve nada, revienta al mirarlo. El juego tiene que seguir.
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('almacenamiento bloqueado')
      },
    })

    try {
      expect(settingsStorage()).toBeNull()
    } finally {
      // `restoreMocks` no deshace un `defineProperty`, y sin esto el resto de
      // los tests del fichero se quedarían sin almacenamiento.
      if (original !== undefined) Object.defineProperty(window, 'localStorage', original)
    }
  })
})

describe('los volúmenes', () => {
  it('empiezan en los de partida', () => {
    const { result } = renderHook(() => useVolumes())

    expect(result.current).toEqual(DEFAULT_VOLUME_SETTINGS)
  })

  it('llegan a lo que ya está pintado en cuanto cambian', () => {
    // Sin el evento propio esto se quedaría en 100: `localStorage` no avisa a la
    // pestaña que escribe, y es la misma pestaña la que monta el juego dentro
    // del salón.
    const { result } = renderHook(() => useVolumes())

    act(() => setVolume('sfx', 30))

    expect(result.current.sfx).toBe(30)
    expect(window.localStorage.getItem(VOLUME_KEYS.sfx)).toBe('30')
  })

  it('no se salen de 0 a 100, ni admiten decimales', () => {
    const { result } = renderHook(() => useVolumes())

    act(() => setVolume('ambience', 140))
    expect(result.current.ambience).toBe(100)

    act(() => setVolume('ambience', -20))
    expect(result.current.ambience).toBe(0)

    act(() => setVolume('ambience', 42.6))
    expect(result.current.ambience).toBe(43)
  })

  it('se enteran también de lo que cambia otra pestaña', () => {
    const { result } = renderHook(() => useVolumes())

    act(() => {
      window.localStorage.setItem(VOLUME_KEYS.ambience, '15')
      window.dispatchEvent(new Event('storage'))
    })

    expect(result.current.ambience).toBe(15)
  })

  it('dejan de escuchar cuando ya no los mira nadie', () => {
    // El juego se monta y se desmonta a cada visita dentro del salón: sin
    // soltar el oyente, cada entrada dejaría uno más pegado a la ventana.
    const primero = renderHook(() => useVolumes())
    const segundo = renderHook(() => useVolumes())

    primero.unmount()
    act(() => setVolume('sfx', 20))
    expect(segundo.result.current.sfx).toBe(20)

    segundo.unmount()
    // Ya sin nadie suscrito, un cambio no puede reventar por avisar a un
    // componente desmontado.
    expect(() => setVolume('sfx', 10)).not.toThrow()
  })

  it('no se quedan con lo leído de antes aunque nadie escuche', () => {
    // La instantánea se cachea, y se invalida al escribir y no en el oyente:
    // puede que todavía no haya ninguno y aun así la próxima lectura tiene que
    // ver lo nuevo.
    setVolume('sfx', 55)

    const { result } = renderHook(() => useVolumes())

    expect(result.current.sfx).toBe(55)
  })
})

describe('lo que se pinta en el servidor', () => {
  it('son los volúmenes de partida, para que la hidratación cuadre', () => {
    // Allí no hay `localStorage` que mirar. Si el servidor pintara otra cosa
    // que el primer render del navegador, React vería dos árboles distintos.
    setVolume('sfx', 15)

    function Volumen() {
      return <output>{useVolumes().sfx}</output>
    }

    expect(renderToString(<Volumen />)).toContain(String(DEFAULT_VOLUMES.sfx))
  })

  it('y el idioma de partida, que la cookie la lee `idiomaDeLaPeticion`', () => {
    function Idioma() {
      return <output>{useLang()}</output>
    }

    setLang('es')

    expect(renderToString(<Idioma />)).toContain(DEFAULT_LANG)
  })
})

describe('el idioma', () => {
  it('empieza en el de partida', () => {
    expect(currentLang()).toBe(DEFAULT_LANG)

    const { result } = renderHook(() => useLang())
    expect(result.current).toBe(DEFAULT_LANG)
  })

  it('viaja en una cookie, para que el servidor pinte ya traducido', () => {
    setLang('es')

    expect(document.cookie).toContain(`${LANG_COOKIE}=es`)
    expect(currentLang()).toBe('es')
  })

  it('sin `Secure` mientras se sirve sin cifrar, o no se guardaría en local', () => {
    // El otro lado de esta misma decisión —con `https:` la cookie sí lo lleva—
    // se prueba en `ajustesCliente.https.test.tsx`, que monta la ventana en
    // https: `window.location` no se puede cambiar a mitad de un fichero.
    setLang('es')

    expect(document.cookie).not.toContain('Secure')
  })

  it('llega a lo que ya está pintado, que una cookie no avisa a nadie', () => {
    const { result } = renderHook(() => useLang())

    act(() => setLang('es'))

    expect(result.current).toBe('es')
  })
})
