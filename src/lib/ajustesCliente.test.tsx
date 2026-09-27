import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_LANG,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  GRAB_MODE_KEY,
  HAND_KEY,
  LANG_COOKIE,
  PLAY_HEIGHT_KEY,
  PLAY_HEIGHT_OFFSET_KEY,
  SCENERY_KEY,
  TURN_MODE_KEY,
  VOLUME_KEYS,
} from './ajustes'
import {
  currentLang,
  setHand,
  setLang,
  setScenery,
  setVolume,
  settingsStorage,
  useGrabMode,
  useHand,
  useLang,
  usePlayHeight,
  usePlayHeightOffset,
  useScenery,
  useTurnMode,
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

describe('a qué altura se juega', () => {
  it('empieza de pie, que es como se jugaba antes de haber esto', () => {
    const { result } = renderHook(() => usePlayHeight())

    expect(result.current).toBe('standing')
  })

  it('lo que se elige en el arcade llega a la cabina sin recargar', () => {
    // Es lo que hace que valga de algo: quien lo pide está **dentro** del
    // salón, con el visor puesto, y el juego montado en esta misma página.
    // Recargar para enterarse sería cerrar la sesión inmersiva.
    const { result } = renderHook(() => usePlayHeight())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_KEY, 'eyes')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('eyes')
  })

  it('una altura que no existe deja el mundo donde estaba', () => {
    // Almacenamiento manipulado o de otra versión: la escena no se mueve.
    const { result } = renderHook(() => usePlayHeight())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_KEY, 'de-rodillas')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('standing')
  })
})

describe('la altura fina del salón', () => {
  it('sin la clave el mundo no se mueve', () => {
    const { result } = renderHook(() => usePlayHeightOffset())

    expect(result.current).toBe(0)
  })

  it('con −15 el mundo baja 0,15 m, y llega a la cabina sin recargar', () => {
    const { result } = renderHook(() => usePlayHeightOffset())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_OFFSET_KEY, '-15')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBeCloseTo(-0.15, 10)
  })

  it('en el servidor es cero', () => {
    function Altura() {
      return <>{usePlayHeightOffset()}</>
    }

    expect(renderToString(<Altura />)).toBe('0')
  })
})

describe('cómo se sujeta lo que se coge', () => {
  it('empieza manteniendo el gatillo, como enseña el tutorial', () => {
    const { result } = renderHook(() => useGrabMode())

    expect(result.current).toBe('hold')
  })

  it('lo que se elige en el arcade llega a la cabina sin recargar', () => {
    const { result } = renderHook(() => useGrabMode())

    act(() => {
      window.localStorage.setItem(GRAB_MODE_KEY, 'toggle')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('toggle')
  })

  it('un agarre que no existe deja el de siempre', () => {
    const { result } = renderHook(() => useGrabMode())

    act(() => {
      window.localStorage.setItem(GRAB_MODE_KEY, 'con-la-boca')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('hold')
  })
})

describe('cuándo se gira el decorado con el stick', () => {
  it('sin nada guardado, solo sentado', () => {
    const { result } = renderHook(() => useTurnMode())

    expect(result.current).toBe('auto')
  })

  it('lo que se elige en el arcade llega a la cabina sin recargar', () => {
    const { result } = renderHook(() => useTurnMode())

    act(() => {
      window.localStorage.setItem(TURN_MODE_KEY, 'stick')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('stick')
  })

  it('un giro que no existe deja el de siempre', () => {
    const { result } = renderHook(() => useTurnMode())

    act(() => {
      window.localStorage.setItem(TURN_MODE_KEY, 'con-la-cabeza')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('auto')
  })
})

describe('qué se ve alrededor con el visor', () => {
  it('empieza con el sitio dibujado', () => {
    const { result } = renderHook(() => useScenery())

    expect(result.current).toBe('place')
  })

  it('lo que se elige en el salón llega a la cabina sin recargar', () => {
    // Lo que hace el panel del salón: escribe la clave y avisa por el evento. El juego está
    // montado en esta misma página y el visor sigue puesto, así que o llega así o no llega.
    const { result } = renderHook(() => useScenery())

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('room')
  })

  it('lo que elige el menú del juego escribe la clave del arcade y se ve a la vez', () => {
    // Una sola preferencia: el botón del juego y el panel del salón leen y escriben lo mismo.
    const { result } = renderHook(() => useScenery())

    act(() => setScenery('room'))
    expect(result.current).toBe('room')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')

    // Volver a lo de partida borra la clave, como los volúmenes.
    act(() => setScenery('place'))
    expect(result.current).toBe('place')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('un escenario que no existe deja el sitio dibujado', () => {
    const { result } = renderHook(() => useScenery())

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'passthrough')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('place')
  })

  it('con el almacenamiento lleno, lo elegido dura lo que dure la visita', () => {
    // Si la escritura falla y la lectura va al almacenamiento, el botón se enciende y el
    // decorado no cambia: la elección se pierde en el mismo fotograma.
    const { result } = renderHook(() => useScenery())
    const guarda = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })

    act(() => setScenery('room'))
    expect(guarda).toHaveBeenCalled()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
    expect(result.current).toBe('room')

    // Volver al de partida sí se guarda (borrar no ocupa sitio), y entonces manda lo guardado.
    act(() => setScenery('place'))
    expect(result.current).toBe('place')

    // Y si el almacenamiento se recupera, lo guardado vuelve a mandar sobre lo recordado.
    guarda.mockRestore()
    act(() => setScenery('room'))
    act(() => {
      window.localStorage.removeItem(SCENERY_KEY)
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current).toBe('place')
  })

  it('en el servidor se pinta el de partida, para que la hidratación cuadre', () => {
    // El menú de la web enseña cuál está elegido: si el servidor leyera otra cosa que el primer
    // render del navegador, React vería dos árboles distintos.
    window.localStorage.setItem(SCENERY_KEY, 'room')

    function Escenario() {
      return <output>{useScenery()}</output>
    }

    expect(renderToString(<Escenario />)).toContain('place')
  })
})

describe('con qué mano se juega', () => {
  beforeEach(() => {
    // Vacía también lo que una prueba de almacenamiento capado dejara recordado en memoria.
    setHand('right')
  })

  it('sin nada guardado, la derecha', () => {
    const { result } = renderHook(() => useHand())

    expect(result.current).toBe('right')
  })

  it('la izquierda guardada en el salón es la izquierda', () => {
    window.localStorage.setItem(HAND_KEY, 'left')

    const { result } = renderHook(() => useHand())

    expect(result.current).toBe('left')
  })

  it('lo que se cambia en el salón llega a la cabina sin recargar', () => {
    // El panel del salón escribe la clave y avisa por el evento; otra pestaña, por `storage`.
    const { result } = renderHook(() => useHand())

    act(() => {
      window.localStorage.setItem(HAND_KEY, 'left')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })
    expect(result.current).toBe('left')

    act(() => {
      window.localStorage.removeItem(HAND_KEY)
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current).toBe('right')
  })

  it('una mano que no existe deja la derecha', () => {
    const { result } = renderHook(() => useHand())

    act(() => {
      window.localStorage.setItem(HAND_KEY, 'zurda')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('right')
  })

  it('elegirla aquí escribe la clave del arcade y se ve a la vez', () => {
    const { result } = renderHook(() => useHand())

    act(() => setHand('left'))
    expect(result.current).toBe('left')
    expect(window.localStorage.getItem(HAND_KEY)).toBe('left')

    act(() => setHand('right'))
    expect(result.current).toBe('right')
    expect(window.localStorage.getItem(HAND_KEY)).toBeNull()
  })

  it('con el almacenamiento lleno, lo elegido dura lo que dure la visita', () => {
    const { result } = renderHook(() => useHand())
    const guarda = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })

    act(() => setHand('left'))
    expect(window.localStorage.getItem(HAND_KEY)).toBeNull()
    expect(result.current).toBe('left')

    guarda.mockRestore()
  })

  it('en el servidor se pinta con la derecha, para que la hidratación cuadre', () => {
    window.localStorage.setItem(HAND_KEY, 'left')

    function Mano() {
      return <output>{useHand()}</output>
    }

    expect(renderToString(<Mano />)).toContain('right')
  })
})
