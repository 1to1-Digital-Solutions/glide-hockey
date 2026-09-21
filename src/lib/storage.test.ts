import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoredPreference, gameStorage } from './storage'

/**
 * Lo que se prueba aquí no es «guardar y leer», que es lo fácil: es que el
 * juego **siga jugándose** cuando el navegador no deja guardar nada. En modo
 * privado, o con el almacenamiento vetado por política, tocar `localStorage`
 * lanza; si eso subiera, el juego se caería al arrancar por una preferencia
 * prescindible.
 */

/** El almacenamiento de un navegador en modo privado: lanza en vez de fallar. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('bloqueado', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('cuota agotada', 'QuotaExceededError')
    },
  } as unknown as Storage
}

const numero = (raw: string | null): number => {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Una preferencia de mentira con clave fija. */
function contador() {
  return createStoredPreference<number>({
    key: 'glide-hockey:test:contador',
    parse: numero,
    serialize: String,
  })
}

/** Y otra con una clave por variante, como la del récord por modo. */
function porModo() {
  return createStoredPreference<number, [string]>({
    key: (mode: string) => `glide-hockey:test:${mode}`,
    parse: numero,
    serialize: String,
  })
}

afterEach(() => {
  // En este orden: mientras el getter de `localStorage` esté falseado, limpiarlo
  // lanzaría y tumbaría el test siguiente por el fallo del anterior.
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('el almacenamiento del navegador', () => {
  it('en el navegador es el de siempre', () => {
    expect(gameStorage()).toBe(window.localStorage)
  })

  it('en el servidor no hay ninguno', () => {
    // Es lo que mantiene igual el HTML que se prerenderiza y el que se hidrata:
    // si aquí se leyera algo, React avisaría de que no cuadran.
    vi.stubGlobal('window', undefined)
    expect(gameStorage()).toBeNull()
  })

  it('si el navegador prohíbe tocarlo, es como no tenerlo', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(gameStorage()).toBeNull()
  })
})

describe('una preferencia guardada entre visitas', () => {
  it('lo guardado se vuelve a leer en la siguiente visita', () => {
    const pref = contador()
    pref.save(7)

    expect(pref.get()).toBe(7)
    // Otra pestaña, u otra visita, lee lo mismo.
    expect(contador().get()).toBe(7)
  })

  it('sin nada guardado, el valor de entrada', () => {
    expect(contador().get()).toBe(0)
  })

  it('lo guardado es entrada externa: solo se acepta lo que vale', () => {
    localStorage.setItem('glide-hockey:test:contador', 'lo que sea')
    expect(contador().get()).toBe(0)
  })

  it('en el servidor siempre el valor de entrada, aunque haya algo guardado', () => {
    const pref = contador()
    pref.save(7)
    expect(pref.getServer()).toBe(0)
  })

  it('con una clave por variante, cada variante guarda la suya', () => {
    const pref = porModo()
    pref.save(3, 'facil')
    pref.save(9, 'dificil')

    expect(pref.get('facil')).toBe(3)
    expect(pref.get('dificil')).toBe(9)
  })

  it('avisa a quien la mira cuando cambia, y deja de hacerlo al soltarla', () => {
    const pref = contador()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    pref.save(3)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    pref.save(4)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('también escucha a las otras pestañas', () => {
    // `useSyncExternalStore` solo vuelve a leer cuando se le avisa: sin esto, un
    // cambio hecho en otra pestaña no aparecería hasta recargar.
    const pref = contador()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    window.dispatchEvent(new StorageEvent('storage'))
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  describe('cuando el navegador no deja guardar', () => {
    it('leer da el valor de entrada en vez de lanzar', () => {
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(blockedStorage())
      expect(contador().get()).toBe(0)
    })

    it('guardar no rompe, y lo elegido vale al menos para esta visita', () => {
      // Sin esto, con el almacenamiento bloqueado pulsar una opción del menú no hacía
      // **nada**: la escritura fallaba en silencio y la relectura devolvía lo de antes,
      // así que el botón se quedaba sin marcar. Lo que no se pudo guardar se recuerda en
      // memoria hasta que se cierre la pestaña; entre visitas se pierde, que es lo que
      // significa no tener almacenamiento.
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(blockedStorage())
      const pref = contador()
      const listener = vi.fn()
      pref.subscribe(listener)

      expect(() => pref.save(9)).not.toThrow()

      expect(pref.get()).toBe(9)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('sin almacenamiento ninguno, ni lectura ni escritura rompen', () => {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
      const pref = contador()
      expect(() => pref.save(9)).not.toThrow()
      expect(pref.get()).toBe(9)
    })
  })
})
