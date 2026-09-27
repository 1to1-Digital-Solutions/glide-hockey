import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENERY_KEY } from './ajustes'
import { DUEL_SETUP } from './duel'
import { getDuelTally } from './duelTally'
import { DEFAULT_GOALS, MAX_GOALS, MIN_GOALS } from './gameConfig'
import { clampGoalTarget, useGame, useGameStoreValue } from './gameStore'
import { getBestEndlessStreak, getBestPoints } from './highScore'
import { semillaDeLaMesa } from './opponent'
import type { Resultado } from './semilla'
import { LEVEL_COUNT } from './levels'
import { OWN_SCENERY_KEY } from './scenery'

/**
 * El estado de la partida. Las reglas viven en sus módulos —el marcador en
 * `gameMode.ts`, la física en `puckPhysics.ts`—; lo que se prueba aquí es lo
 * que solo pasa jugando: cómo acaba una partida sin fin, que es el único modo
 * que no lo decide el marcador sino quien juega.
 */

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Agota la cuenta atrás del saque: un tic por segundo, uno por vuelta. */
function esperarAlSaque(hook: { result: { current: { gameState: string } } }): void {
  for (let i = 0; i < 10 && hook.result.current.gameState === 'countdown'; i += 1) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/** Monta el store, elige la partida sin fin y saca. */
function sinFin() {
  const hook = renderHook(() => useGameStoreValue())
  act(() => hook.result.current.setEndless(true))
  act(() => hook.result.current.startGame())
  esperarAlSaque(hook)
  return hook
}

describe('la partida sin fin', () => {
  it('no la cierra el marcador: sigue viva por muchos goles que caigan', () => {
    const { result } = sinFin()

    for (let i = 0; i < 12; i += 1) act(() => result.current.scorePlayer())

    expect(result.current.outcome).toBeNull()
  })

  it('la cierra quien juega, y cuenta como ganada si va por delante', () => {
    // Es su única salida con resumen: sin esto, dejarla no dejaría marca.
    const { result } = sinFin()

    act(() => result.current.scorePlayer())
    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('won')
  })

  it('e ir por detrás al dejarla cuenta como perdida', () => {
    const { result } = sinFin()

    act(() => result.current.scoreOpponent())
    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('lost')
  })

  it('empatada al dejarla cuenta como ganada: se aguantó', () => {
    const { result } = sinFin()

    act(() => result.current.endRun())

    expect(result.current.outcome).toBe('won')
  })
})

describe('cuántos goles dura una partida', () => {
  it('lo que se pide, si cabe en el rango', () => {
    expect(clampGoalTarget(5)).toBe(5)
  })

  it('lo que se sale del rango se recorta a los topes', () => {
    expect(clampGoalTarget(0)).toBe(MIN_GOALS)
    expect(clampGoalTarget(999)).toBe(MAX_GOALS)
  })

  it('un número con decimales se redondea: no hay medio gol', () => {
    expect(clampGoalTarget(4.6)).toBe(5)
  })

  it('lo que no es número se queda en lo de siempre', () => {
    // Llega de lo guardado en el navegador y del control del menú, que en el
    // visor puede dar un valor vacío.
    expect(clampGoalTarget(Number.NaN)).toBe(DEFAULT_GOALS)
  })
})

describe('el reto', () => {
  it('ganar una ronda no acaba nada: encadena la siguiente', () => {
    // Es lo que hace que el reto no tenga final: solo lo cierra perder.
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)

    const ronda = hook.result.current.round
    for (let i = 0; i < 20 && hook.result.current.round === ronda; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(5000))
    }

    expect(hook.result.current.round).toBeGreaterThan(ronda ?? 0)
    expect(hook.result.current.outcome).toBeNull()
  })

  it('la dificultad la manda la ronda, no lo elegido en el menú', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setDifficulty('impossible'))
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.startGame())

    // `difficulty` sigue siendo lo elegido en el menú; el que manda es
    // `activeDifficulty`, que sale de la ronda.
    expect(hook.result.current.difficulty).toBe('impossible')
    expect(hook.result.current.activeDifficulty).not.toBe('impossible')
  })
})

describe('los niveles', () => {
  it('solo se puede elegir entre los abiertos', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setGameMode('levels'))

    act(() => hook.result.current.setLevel(LEVEL_COUNT))

    expect(hook.result.current.level).toBe(1)
  })

  it('ganar el primero lo apunta con estrellas y abre el siguiente', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)

    for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.outcome).toBe('won')
    expect(hook.result.current.levelResult?.passed).toBe(true)
    expect(hook.result.current.levelResult?.unlocked).toBe(2)
  })

  it('el nivel que se juega no cambia aunque se toque el menú a media partida', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    const jugando = hook.result.current.activeLevel

    act(() => hook.result.current.setLevel(1))

    expect(hook.result.current.activeLevel).toBe(jugando)
  })
})

describe('lo que se guarda al terminar', () => {
  it('la puntuación de una partida de prueba se guarda como récord', () => {
    // Se guarda al final y no gol a gol: durante la partida el récord tiene que
    // seguir siendo la marca a batir.
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)

    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.outcome).toBe('won')
    expect(hook.result.current.isRecord).toBe(true)
    expect(hook.result.current.bestPoints).toBe(hook.result.current.points)
  })

  it('repetir un nivel ya pasado no vuelve a abrir el siguiente', () => {
    // Abrir se abre una vez: sin esto, el resumen prometería un nivel nuevo
    // cada vez que se repite el primero.
    const primera = renderHook(() => useGameStoreValue())
    act(() => primera.result.current.setGameMode('levels'))
    act(() => primera.result.current.startGame())
    esperarAlSaque(primera)
    for (let i = 0; i < 40 && primera.result.current.gameState !== 'finished'; i += 1) {
      act(() => primera.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(primera.result.current.levelResult?.unlocked).toBe(2)

    const otra = renderHook(() => useGameStoreValue())
    act(() => otra.result.current.setGameMode('levels'))
    act(() => otra.result.current.setLevel(1))
    act(() => otra.result.current.startGame())
    esperarAlSaque(otra)
    for (let i = 0; i < 40 && otra.result.current.gameState !== 'finished'; i += 1) {
      act(() => otra.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(otra.result.current.levelResult?.passed).toBe(true)
    expect(otra.result.current.levelResult?.unlocked).toBeNull()
  })

  it('en niveles no hay récord de puntos: lo que cuenta son las estrellas', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setGameMode('levels'))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)

    for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(hook.result.current.isRecord).toBe(false)
    expect(hook.result.current.levelStars[0]).toBeGreaterThan(0)
  })

  it('la racha de la partida sin fin se guarda al dejarla', () => {
    const { result } = sinFin()

    act(() => result.current.scorePlayer())
    act(() => result.current.scorePlayer())
    act(() => result.current.endRun())

    // En la partida sin fin la marca no son los puntos, es la racha: eso es lo
    // que enseña el resumen y lo que se guarda.
    expect(result.current.gameState).toBe('finished')
    expect(result.current.bestStreak).toBeGreaterThan(0)
    expect(getBestEndlessStreak()).toBe(result.current.bestStreak)
    expect(result.current.bestPoints).toBe(result.current.bestStreak)
  })
})

describe('cambiar de modo', () => {
  it('no se puede a media partida', () => {
    // Los puntos y el modo en el que se consiguieron son un par: con el resumen
    // en pantalla, cambiar de modo copiaría esa puntuación al récord del otro.
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('practice')
  })

  it('desde el menú sí', () => {
    const hook = renderHook(() => useGameStoreValue())

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('challenge')
  })
})

describe('los goles y el sin fin con la partida terminada', () => {
  /** Una partida de prueba ganada a los goles por defecto, con el resumen en pantalla. */
  function ganada() {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(hook.result.current.outcome).toBe('won')
    return hook
  }

  it('subir el objetivo no la devuelve a estar en juego', () => {
    // El final se lee del objetivo en cada render: cambiarlo reescribía un resultado ya decidido.
    const hook = ganada()

    act(() => hook.result.current.setGoalTarget(DEFAULT_GOALS + 2))

    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.goalTarget).toBe(DEFAULT_GOALS)
  })

  it('pasar a sin fin tampoco', () => {
    const hook = ganada()

    act(() => hook.result.current.setEndless(true))

    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.endless).toBe(false)
  })

  it('de vuelta en el menú se eligen como siempre', () => {
    const hook = ganada()
    act(() => hook.result.current.resetGame())

    act(() => hook.result.current.setGoalTarget(DEFAULT_GOALS + 2))
    act(() => hook.result.current.setEndless(true))

    expect(hook.result.current.goalTarget).toBe(DEFAULT_GOALS + 2)
    expect(hook.result.current.endless).toBe(true)
  })
})

describe('volver al menú', () => {
  it('deja la mesa lista para otra partida', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.playerGoals).toBe(0)
  })

  it('los goles del menú se recortan al rango', () => {
    const hook = renderHook(() => useGameStoreValue())

    act(() => hook.result.current.setGoalTarget(999))

    expect(hook.result.current.goalTarget).toBe(MAX_GOALS)
  })
})

describe('usar el store sin haberlo montado', () => {
  it('avisa con un error claro en vez de romper en otro sitio', () => {
    // Sin esto, el fallo saldría como «no se puede leer points de null» en el
    // componente que lo pida, que no es donde está el error.
    expect(() => renderHook(() => useGame())).toThrow(/GameProvider/)
  })
})

/**
 * El saque espera a que el mazo esté en la mano.
 *
 * **Con el visor puesto la partida empezaba sin él**: el disco salía y no había con qué
 * pararlo, porque coger el mazo es un gesto que se aprende justo en esos tres segundos. En
 * escritorio no aplica —el ratón lleva el mazo desde el primer fotograma—, así que solo se
 * espera dentro de una sesión.
 */
describe('el saque con el visor puesto', () => {
  it('no pasa del último segundo sin el mazo en la mano', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())

    // La cuenta baja hasta el último segundo y ahí se queda.
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.countdown).toBe(1)
    expect(hook.result.current.gameState).toBe('countdown')
  })

  it('y lo dice: mientras espera, el juego avisa de que falta cogerlo', () => {
    // El 1 clavado sin explicación es lo que se reportó del visor: «el countdown se queda
    // parado en el 1 sin ninguna explicación». La cuenta atrás escribe qué falta y el mazo se
    // enciende, y las dos cosas cuelgan de esta señal.
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.esperandoElMazo).toBe(true)

    act(() => hook.result.current.setMalletHeld(true))
    expect(hook.result.current.esperandoElMazo).toBe(false)
  })

  it('fuera del visor no espera a nadie: ahí el mazo va con el ratón', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.esperandoElMazo).toBe(false)
  })

  it('en cuanto se coge, saca', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    act(() => hook.result.current.setMalletHeld(true))
    act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.gameState).toBe('playing')
  })

  it('en escritorio no espera a nada', () => {
    // El ratón lleva el mazo desde el primer fotograma: esperar sería no empezar nunca.
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())

    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.gameState).toBe('playing')
  })
})

/**
 * Dejar la partida pregunta antes.
 *
 * **Se pulsa sin querer y se pierden los goles.** Con el visor puesto no se ve lo que hay a
 * los lados y el brazo pasa por donde pasa. Lo que hace que preguntar no salga caro es que
 * la mesa se para: el disco no corre mientras la pregunta está en pantalla.
 */
describe('dejar la partida', () => {
  it('pregunta en vez de salir', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.askToQuit())

    expect(hook.result.current.prompt).toBe('quit')
    expect(hook.result.current.gameState).not.toBe('menu')
  })

  it('seguir jugando la devuelve donde estaba', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.keepPlaying())

    expect(hook.result.current.prompt).toBeNull()
  })

  it('y confirmar sí sale', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.prompt).toBeNull()
    expect(hook.result.current.gameState).toBe('menu')
  })

  it('empezar otra se lleva la pregunta por delante', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.startGame())

    expect(hook.result.current.prompt).toBeNull()
  })
})

/**
 * La cuenta atrás espera a que la demostración termine.
 *
 * Empezar mientras el tutorial explica el gesto es empezar sin él: el saque llegaba con la explicación a medias. Solo pasa
 * con el visor puesto y solo la primera vez, que es justo cuando más importa.
 */
describe('esperar a la demostración', () => {
  it('mientras corre, la cuenta atrás no baja', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setTutorialRunning(true))
    act(() => hook.result.current.startGame())
    const desde = hook.result.current.countdown

    act(() => void vi.advanceTimersByTime(5000))

    expect(hook.result.current.countdown).toBe(desde)
    expect(hook.result.current.gameState).toBe('countdown')
  })

  it('y en cuanto termina, echa a andar', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.setTutorialRunning(true))
    act(() => hook.result.current.startGame())
    act(() => void vi.advanceTimersByTime(5000))

    const parada = hook.result.current.countdown

    act(() => hook.result.current.setTutorialRunning(false))
    act(() => void vi.advanceTimersByTime(1100))

    expect(hook.result.current.countdown).toBeLessThan(parada)
  })
})

describe('el escenario, que es del arcade', () => {
  it('el botón del decorado escribe el escenario del arcade', () => {
    // Es lo que llaman los dos menús —el de la web y el del visor—: una sola preferencia, la
    // misma que enseña el panel del salón, y no una del juego que la contradiga.
    window.localStorage.removeItem(SCENERY_KEY)
    const hook = renderHook(() => useGameStoreValue())

    act(() => hook.result.current.setScenery('room'))

    expect(hook.result.current.scenery).toBe('room')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()

    act(() => hook.result.current.setScenery('place'))
    expect(hook.result.current.scenery).toBe('place')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('lo que se elige en el salón llega a la partida sin recargar', () => {
    window.localStorage.removeItem(SCENERY_KEY)
    const hook = renderHook(() => useGameStoreValue())

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(hook.result.current.scenery).toBe('room')
    window.localStorage.removeItem(SCENERY_KEY)
  })

  it('la clave propia del juego no manda y se borra al montar la partida, sin trasladarla', () => {
    // Con «tu habitación» guardada en la clave propia de esta cabina no se puede quedar sin
    // la sala: manda lo que diga el salón, y sin nada elegido allí, el sitio dibujado.
    window.localStorage.removeItem(SCENERY_KEY)
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    const hook = renderHook(() => useGameStoreValue())

    expect(hook.result.current.scenery).toBe('place')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })
})

/** Hasta que la máquina cierre la partida en curso, gol a gol. */
function perderLaPartida(hook: { result: { current: ReturnType<typeof useGameStoreValue> } }): void {
  for (let i = 0; i < 40 && hook.result.current.gameState !== 'finished'; i += 1) {
    act(() => hook.result.current.scoreOpponent())
  }
}

describe('el reto que pasa el salón', () => {
  it('entra ya en el reto, con su cuenta atrás y sin pasar por el menú', () => {
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 4_000_000_000 } }))
    expect(hook.result.current.gameMode).toBe('challenge')
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.round).toBe(1)
    expect(hook.result.current.enReto).toBe(true)
    expect(hook.result.current.seed).toBe(semillaDeLaMesa(4_000_000_000, 0, 1))
  })

  it('la mesa de cada ronda sale de la semilla y de la ronda', () => {
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 7 } }))
    esperarAlSaque(hook)
    const primera = hook.result.current.seed
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(5000))
    }
    expect(hook.result.current.round).toBe(2)
    expect(hook.result.current.seed).toBe(semillaDeLaMesa(7, 0, 2))
    expect(hook.result.current.seed).not.toBe(primera)
  })

  it('al perder se lo cuenta al salón una sola vez, con sus puntos y como reto', () => {
    const onTerminar = vi.fn<(resultado: Resultado) => void>()
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 7 }, onTerminar }))
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())
    perderLaPartida(hook)
    const puntos = hook.result.current.points
    // Ni un repintado del anfitrión ni un gol que llegue con la partida ya
    // acabada —el disco seguía rodando— la vuelven a contar.
    hook.rerender()
    act(() => hook.result.current.scorePlayer())
    act(() => void vi.advanceTimersByTime(5000))

    expect(hook.result.current.outcome).toBe('lost')
    expect(onTerminar).toHaveBeenCalledTimes(1)
    expect(onTerminar).toHaveBeenCalledWith({ modo: 'challenge', puntos, reto: true })
    // Y el récord se sigue guardando como siempre.
    expect(getBestPoints('challenge')).toBeGreaterThanOrEqual(puntos)
  })

  it('aunque no sea récord, cuenta los puntos de la partida', () => {
    localStorage.setItem('glide-hockey:best-points:challenge', '9000')
    const onTerminar = vi.fn<(resultado: Resultado) => void>()
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 7 }, onTerminar }))
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())
    perderLaPartida(hook)

    expect(hook.result.current.isRecord).toBe(false)
    expect(onTerminar).toHaveBeenCalledWith({ modo: 'challenge', puntos: hook.result.current.points, reto: true })
  })

  it('la partida de después ya no es el reto, ni juega su mesa', () => {
    const onTerminar = vi.fn<(resultado: Resultado) => void>()
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 7 }, onTerminar }))
    esperarAlSaque(hook)
    perderLaPartida(hook)

    act(() => hook.result.current.startGame())
    expect(hook.result.current.enReto).toBe(false)
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    esperarAlSaque(hook)
    perderLaPartida(hook)

    expect(onTerminar).toHaveBeenCalledTimes(2)
    expect(onTerminar.mock.calls[1]?.[0]).toEqual({ modo: 'challenge', puntos: 0, reto: false })
  })

  it('dejarla a medias no cuenta como terminada', () => {
    const onTerminar = vi.fn<(resultado: Resultado) => void>()
    const hook = renderHook(() => useGameStoreValue({ reto: { semilla: 7 }, onTerminar }))
    esperarAlSaque(hook)
    act(() => hook.result.current.askToQuit())
    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.enReto).toBe(false)
    expect(onTerminar).not.toHaveBeenCalled()
  })

  it('sin reto, cualquier partida se cuenta al acabar, en su modo', () => {
    const onTerminar = vi.fn<(resultado: Resultado) => void>()
    const hook = renderHook(() => useGameStoreValue({ onTerminar }))
    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.enReto).toBe(false)
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(onTerminar).toHaveBeenCalledTimes(1)
    expect(onTerminar).toHaveBeenCalledWith({ modo: 'practice', puntos: hook.result.current.points, reto: false })
  })

  it('sin nada, la mesa juega con el número de partida, como siempre', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    expect(hook.result.current.gameMode).toBe('practice')
  })
})

describe('un gol con la partida ya decidida', () => {
  // El disco sigue rodando cuando la partida se decide: si entra, no es de ninguna partida.
  it('no cambia ni los puntos ni el marcador ni el récord', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    const alAcabar = hook.result.current
    const record = getBestPoints('practice')
    expect(alAcabar.outcome).toBe('won')
    expect(record).toBe(alAcabar.points)

    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scoreOpponent())

    expect(hook.result.current.points).toBe(alAcabar.points)
    expect(hook.result.current.playerGoals).toBe(alAcabar.playerGoals)
    expect(hook.result.current.opponentGoals).toBe(alAcabar.opponentGoals)
    expect(hook.result.current.streak).toBe(alAcabar.streak)
    expect(getBestPoints('practice')).toBe(record)
    expect(hook.result.current.isRecord).toBe(true)
  })

  it('ni fuera de partida, en el menú', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scoreOpponent())

    expect(hook.result.current.points).toBe(0)
    expect(hook.result.current.playerGoals).toBe(0)
    expect(hook.result.current.opponentGoals).toBe(0)
  })
})

describe('el duelo', () => {
  type Hook = ReturnType<typeof renderHook<ReturnType<typeof useGameStoreValue>, unknown>>

  /** Juega la partida de quien tiene el mando: `a` goles suyos y `b` de la máquina. */
  function jugar(hook: Hook, a: number, b: number): void {
    esperarAlSaque(hook)
    for (let i = 0; i < a; i += 1) act(() => hook.result.current.scorePlayer())
    for (let i = 0; i < b; i += 1) act(() => hook.result.current.scoreOpponent())
  }

  /** Monta el store, elige el duelo y empieza la partida del primero. */
  function duelo(onTerminar?: (resultado: Resultado) => void): Hook {
    const hook = renderHook(() => useGameStoreValue({ onTerminar }))
    act(() => hook.result.current.setGameMode('duel'))
    act(() => hook.result.current.startGame())
    return hook
  }

  it('juega el primero, se pasa el mando y juega el segundo', () => {
    const hook = duelo()
    expect(hook.result.current.duel?.player).toBe(0)

    jugar(hook, 3, DUEL_SETUP.goalTarget)
    expect(hook.result.current.gameState).toBe('finished')
    // El traspaso: la partida del primero ya cuenta, y le toca al segundo.
    expect(hook.result.current.duel).toEqual({
      player: 0,
      matches: [{ scored: 3, conceded: DUEL_SETUP.goalTarget }, null],
      next: 1,
      over: false,
      winner: null,
    })

    act(() => hook.result.current.startGame())
    expect(hook.result.current.duel?.player).toBe(1)
    expect(hook.result.current.playerGoals).toBe(0)
  })

  it('los dos juegan contra la misma máquina: mismo nivel, mismos goles y misma semilla', () => {
    const hook = duelo()
    // Lo elegido en la práctica no cuenta en el duelo.
    const primera = hook.result.current
    expect(primera.activeDifficulty).toBe(DUEL_SETUP.difficulty)
    expect(primera.activeGoalTarget).toBe(DUEL_SETUP.goalTarget)

    jugar(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())
    const segunda = hook.result.current

    expect(segunda.runId).toBe(primera.runId + 1)
    expect(segunda.seed).toBe(primera.seed)
    expect(segunda.activeDifficulty).toBe(primera.activeDifficulty)
    expect(segunda.activeGoalTarget).toBe(primera.activeGoalTarget)
  })

  it('otro duelo es otra semilla', () => {
    const hook = duelo()
    const antes = hook.result.current.seed
    jugar(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())
    jugar(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.startGame())

    expect(hook.result.current.seed).not.toBe(antes)
  })

  it('al acabar se sabe quién gana y se apunta en el marcador de la pareja', () => {
    const hook = duelo()
    jugar(hook, DUEL_SETUP.goalTarget, 2)
    act(() => hook.result.current.startGame())
    jugar(hook, 1, DUEL_SETUP.goalTarget)

    expect(hook.result.current.duel?.over).toBe(true)
    expect(hook.result.current.duel?.winner).toBe(0)
    expect(hook.result.current.duel?.next).toBeNull()
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })

    // Otra vez es un duelo nuevo, que empieza el primero.
    act(() => hook.result.current.startGame())
    expect(hook.result.current.duel?.player).toBe(0)
    expect(hook.result.current.duel?.matches).toEqual([null, null])
  })

  it('con la misma ventaja es empate, y se apunta como empate', () => {
    const hook = duelo()
    jugar(hook, DUEL_SETUP.goalTarget, 4)
    act(() => hook.result.current.startGame())
    jugar(hook, DUEL_SETUP.goalTarget, 4)

    expect(hook.result.current.duel?.over).toBe(true)
    expect(hook.result.current.duel?.winner).toBeNull()
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('volver al menú deja el duelo: el siguiente lo empieza el primero', () => {
    const hook = duelo()
    jugar(hook, 0, DUEL_SETUP.goalTarget)
    act(() => hook.result.current.resetGame())
    act(() => hook.result.current.startGame())

    expect(hook.result.current.duel?.player).toBe(0)
    expect(hook.result.current.duel?.matches).toEqual([null, null])
  })

  it('no hay récord ni se le cuenta al salón: los goles son de dos personas', () => {
    const onTerminar = vi.fn()
    const hook = duelo(onTerminar)
    jugar(hook, DUEL_SETUP.goalTarget, 0)

    expect(hook.result.current.isRecord).toBe(false)
    expect(hook.result.current.bestPoints).toBe(0)
    expect(getBestPoints('duel')).toBe(0)
    expect(getBestPoints('practice')).toBe(0)
    expect(onTerminar).not.toHaveBeenCalled()
  })

  it('fuera del duelo no hay duelo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.duel).toBeNull()
  })
})
