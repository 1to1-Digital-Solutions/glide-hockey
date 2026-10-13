import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENERY_KEY } from './settings'
import { DUEL_SETUP } from './duel'
import { getDuelTally } from './duelTally'
import { DEFAULT_GOALS, MAX_GOALS, MIN_GOALS } from './gameConfig'
import { clampGoalTarget, useGame, useGameStoreValue } from './gameStore'
import { getBestEndlessStreak, getBestPoints } from './highScore'
import { tableSeed } from './opponent'
import type { Goal } from './goal'
import type { GameResult } from './seed'
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

/**
 * Monta el store y deja elegida **la práctica**, que es lo que juegan casi todos estos tests: el
 * menú abre en el reto (lo comprueba «el menú abre en el reto», más abajo).
 */
function enPractica(opciones: Parameters<typeof useGameStoreValue>[0] = {}) {
  const hook = renderHook(() => useGameStoreValue(opciones))
  act(() => hook.result.current.setGameMode('practice'))
  return hook
}

/** Monta el store, elige la partida sin fin y saca. */
function sinFin() {
  const hook = enPractica()
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
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.setDifficulty('impossible'))
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.startGame())

    // `difficulty` sigue siendo lo elegido en el menú; el que manda es
    // `activeDifficulty`, que sale de la ronda.
    expect(hook.result.current.difficulty).toBe('impossible')
    expect(hook.result.current.activeDifficulty).not.toBe('impossible')
  })
})

describe('aprender jugando el reto', () => {
  const OBJETIVO = {
    medals: { bronze: 150, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: null,
    mode: 'challenge',
  } as const

  it('con el tutorial enseñándose, los goles de la máquina no cuentan', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.setLearning(true))
    for (let i = 0; i < 5; i += 1) act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.opponentGoals).toBe(0)
    expect(hook.result.current.gameState).toBe('playing')
  })

  it('al cerrarse el tutorial el reto empieza desde cero, y el cartel avisa un momento de que ya cuenta', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.setLearning(true))
    act(() => hook.result.current.scorePlayer())
    const mesa = hook.result.current.runId
    act(() => hook.result.current.setLearning(false))
    act(() => hook.result.current.finishLesson())

    expect(hook.result.current.playerGoals).toBe(0)
    expect(hook.result.current.points).toBe(0)
    expect(hook.result.current.runId).toBe(mesa + 1)
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.cartel?.title).toBe('Now it counts for a medal')

    act(() => void vi.advanceTimersByTime(2600))
    expect(hook.result.current.cartel?.title).not.toBe('Now it counts for a medal')
  })

  it('fuera del reto, aprender no cambia nada y cerrar el tutorial no vuelve a empezar', () => {
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.setLearning(true))
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.opponentGoals).toBe(1)
    const mesa = hook.result.current.runId
    act(() => hook.result.current.finishLesson())
    expect(hook.result.current.runId).toBe(mesa)
    expect(hook.result.current.opponentGoals).toBe(1)
  })

  it('y en el menú tampoco hace nada', () => {
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.finishLesson())
    expect(hook.result.current.gameState).toBe('menu')
  })
})

describe('los niveles', () => {
  it('solo se puede elegir entre los abiertos', () => {
    const hook = enPractica()
    act(() => hook.result.current.setGameMode('levels'))

    act(() => hook.result.current.setLevel(LEVEL_COUNT))

    expect(hook.result.current.level).toBe(1)
  })

  it('ganar el primero lo apunta con estrellas y abre el siguiente', () => {
    const hook = enPractica()
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
    const hook = enPractica()
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
    const hook = enPractica()
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
    const primera = enPractica()
    act(() => primera.result.current.setGameMode('levels'))
    act(() => primera.result.current.startGame())
    esperarAlSaque(primera)
    for (let i = 0; i < 40 && primera.result.current.gameState !== 'finished'; i += 1) {
      act(() => primera.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(primera.result.current.levelResult?.unlocked).toBe(2)

    const otra = enPractica()
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
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('practice')
  })

  it('desde el menú sí', () => {
    const hook = enPractica()

    act(() => hook.result.current.setGameMode('challenge'))

    expect(hook.result.current.gameMode).toBe('challenge')
  })
})

describe('los goles y el sin fin con la partida terminada', () => {
  /** Una partida de prueba ganada a los goles por defecto, con el resumen en pantalla. */
  function ganada() {
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.playerGoals).toBe(0)
  })

  it('los goles del menú se recortan al rango', () => {
    const hook = enPractica()

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
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.waitingForMallet).toBe(true)

    act(() => hook.result.current.setMalletHeld(true))
    expect(hook.result.current.waitingForMallet).toBe(false)
  })

  it('fuera del visor no espera a nadie: ahí el mazo va con el ratón', () => {
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.waitingForMallet).toBe(false)
  })

  it('en cuanto se coge, saca', () => {
    const hook = enPractica()
    act(() => hook.result.current.setImmersive(true))
    act(() => hook.result.current.startGame())
    for (let i = 0; i < 8; i += 1) act(() => void vi.advanceTimersByTime(1000))

    act(() => hook.result.current.setMalletHeld(true))
    act(() => void vi.advanceTimersByTime(1000))

    expect(hook.result.current.gameState).toBe('playing')
  })

  it('en escritorio no espera a nada', () => {
    // El ratón lleva el mazo desde el primer fotograma: esperar sería no empezar nunca.
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.askToQuit())

    expect(hook.result.current.prompt).toBe('quit')
    expect(hook.result.current.gameState).not.toBe('menu')
  })

  it('seguir jugando la devuelve donde estaba', () => {
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.keepPlaying())

    expect(hook.result.current.prompt).toBeNull()
  })

  it('y confirmar sí sale', () => {
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.prompt).toBeNull()
    expect(hook.result.current.gameState).toBe('menu')
  })

  it('empezar otra se lleva la pregunta por delante', () => {
    const hook = enPractica()
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
    const hook = enPractica()
    act(() => hook.result.current.setTutorialRunning(true))
    act(() => hook.result.current.startGame())
    const desde = hook.result.current.countdown

    act(() => void vi.advanceTimersByTime(5000))

    expect(hook.result.current.countdown).toBe(desde)
    expect(hook.result.current.gameState).toBe('countdown')
  })

  it('y en cuanto termina, echa a andar', () => {
    const hook = enPractica()
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
    const hook = enPractica()

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
    const hook = enPractica()

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

    const hook = enPractica()

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
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 4_000_000_000 } }))
    expect(hook.result.current.gameMode).toBe('challenge')
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.round).toBe(1)
    expect(hook.result.current.inChallenge).toBe(true)
    expect(hook.result.current.seed).toBe(tableSeed(4_000_000_000, 0, 1))
  })

  it('la mesa de cada ronda sale de la semilla y de la ronda', () => {
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 } }))
    esperarAlSaque(hook)
    const primera = hook.result.current.seed
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(5000))
    }
    expect(hook.result.current.round).toBe(2)
    expect(hook.result.current.seed).toBe(tableSeed(7, 0, 2))
    expect(hook.result.current.seed).not.toBe(primera)
  })

  it('al perder se lo cuenta al salón una sola vez, con sus puntos y como reto', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
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
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'challenge', points: puntos, challenge: true })
    // Y el récord se sigue guardando como siempre.
    expect(getBestPoints('challenge')).toBeGreaterThanOrEqual(puntos)
  })

  it('aunque no sea récord, cuenta los puntos de la partida', () => {
    localStorage.setItem('glide-hockey:best-points:challenge', '9000')
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())
    perderLaPartida(hook)

    expect(hook.result.current.isRecord).toBe(false)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'challenge', points: hook.result.current.points, challenge: true })
  })

  it('la partida de después ya no es el reto, ni juega su mesa', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    esperarAlSaque(hook)
    perderLaPartida(hook)

    act(() => hook.result.current.startGame())
    expect(hook.result.current.inChallenge).toBe(false)
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    esperarAlSaque(hook)
    perderLaPartida(hook)

    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1]?.[0]).toEqual({ mode: 'challenge', points: 0, challenge: false })
  })

  it('dejarla a medias no cuenta como terminada', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    esperarAlSaque(hook)
    act(() => hook.result.current.askToQuit())
    act(() => hook.result.current.resetGame())

    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.inChallenge).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('sin reto, cualquier partida se cuenta al acabar, en su modo', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = enPractica({ onFinish })
    expect(hook.result.current.gameState).toBe('menu')
    expect(hook.result.current.inChallenge).toBe(false)
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 30 && hook.result.current.gameState !== 'finished'; i += 1) {
      act(() => hook.result.current.scorePlayer())
      act(() => void vi.advanceTimersByTime(1000))
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    // Ganada sin encajar: la primera vez trae la hazaña (`hazanas.ts`).
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'practice',
      points: hook.result.current.points,
      challenge: false,
      feats: ['GH_SHUTOUT'],
    })
  })

  it('sin nada, la mesa juega con el número de partida, como siempre', () => {
    const hook = enPractica()
    act(() => hook.result.current.startGame())
    expect(hook.result.current.seed).toBe(hook.result.current.runId)
    expect(hook.result.current.gameMode).toBe('practice')
  })
})

describe('el menú abre en el reto', () => {
  it('sin tocar nada el modo elegido es el reto, y Jugar empieza la partida que da medalla', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.inChallenge).toBe(false)

    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.round).toBe(1)
    expect(result.current.cartel?.title).toBe('Win games until you lose one')
  })

  it('siempre: no recuerda el modo de la última partida', () => {
    const primera = enPractica()
    act(() => primera.result.current.startGame())
    primera.unmount()

    const segunda = renderHook(() => useGameStoreValue())

    expect(segunda.result.current.gameMode).toBe('challenge')
    expect(localStorage.length).toBe(0)
  })

  it('la práctica sigue a un toque', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('practice'))
    act(() => result.current.startGame())

    expect(result.current.gameMode).toBe('practice')
    expect(result.current.round).toBeNull()
  })
})

describe('el cartel del objetivo', () => {
  const OBJETIVO = {
    medals: { bronze: 150, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: null,
    mode: 'challenge',
  } as const

  /** Pierde la ronda en curso: la máquina mete los goles que hagan falta. */
  function perder(hook: { result: { current: ReturnType<typeof useGameStoreValue> } }): void {
    for (let i = 0; i < MAX_GOALS && hook.result.current.gameState === 'playing'; i += 1) {
      act(() => hook.result.current.scoreOpponent())
    }
  }

  it('en el menú no hay cartel que valga: se cuelga al jugar', () => {
    const { result } = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))

    expect(result.current.gameState).toBe('menu')
    expect(result.current.goal).toBe(OBJETIVO)
    expect(result.current.cartel).toBeNull()
    expect(result.current.medal).toBeNull()
    expect(result.current.omitted).toEqual({ points: false, round: false })
  })

  it('con el objetivo del salón: la misión y los listones en la cuenta atrás, y después el que falta', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())

    expect(hook.result.current.cartel).toMatchObject({
      title: 'Win games until you lose one',
      detail: 'Bronze 150 · Silver 8,000 · Gold 20,000',
    })
    // El marcador de debajo ya calla lo que el cartel va a decir.
    expect(hook.result.current.omitted).toEqual({ points: true, round: true })

    esperarAlSaque(hook)
    expect(hook.result.current.cartel).toMatchObject({
      title: 'Bronze at 150 · you have 0',
      detail: 'Round 1 · to 3 goals · goal +100',
    })
    expect(hook.result.current.medal).toBeNull()

    act(() => hook.result.current.scorePlayer())
    // Lo que queda dice lo que vale el próximo gol, que con la racha ya es más.
    expect(hook.result.current.cartel).toMatchObject({
      title: 'Bronze at 150 · you have 100',
      detail: 'Round 1 · to 3 goals · goal +120',
    })
  })

  it('al cruzar un listón la medalla sube, en la primera ronda encajar no resta, y al acabar el cartel dice lo que faltó', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)

    act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.medal).toBeNull()
    act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.medal).toBe('bronze')
    expect(hook.result.current.cartel?.title).toBe('Silver at 8,000 · you have 220')

    // En la primera ronda del reto, un gol encajado no resta (`concededPenalty`).
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.medal).toBe('bronze')

    // Y perdiendo la ronda se queda lo marcado: al acabar, el cartel dice lo que faltó.
    perder(hook)
    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.points).toBe(220)
    expect(hook.result.current.cartel).toMatchObject({
      title: 'Bronze · 220 points in the challenge',
      detail: '7,780 short of silver',
    })
    // La ronda en que se quedó vuelve al marcador; los puntos siguen en el cartel.
    expect(hook.result.current.omitted).toEqual({ points: true, round: false })

    // Repetir —el botón resaltado al acabar— vuelve a la misión, sin pasar por el menú.
    act(() => hook.result.current.startGame())
    expect(hook.result.current.gameMode).toBe('challenge')
    expect(hook.result.current.cartel?.title).toBe('Win games until you lose one')
    expect(hook.result.current.medal).toBeNull()
  })

  it('al acabar, el récord del salón es el de antes de la partida, aunque el salón ya haya subido el suyo', () => {
    let delSalon: Goal = { ...OBJETIVO, record: 100 }
    const hook = renderHook(() =>
      useGameStoreValue({ goal: delSalon, onFinish: ({ points: puntos }) => void (delSalon = { ...delSalon, record: puntos }) }),
    )
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())
    act(() => hook.result.current.scorePlayer())
    perder(hook)
    // El salón ha apuntado la partida y vuelve a pintar el juego con su récord nuevo.
    hook.rerender()

    expect(delSalon.record).toBe(220)
    expect(hook.result.current.cartel).toMatchObject({ title: 'Bronze · 220 points in the challenge', footer: 'New record!' })
  })

  it('perder la primera ronda 1–3 con un gol marcado no deja cero', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.scorePlayer())
    perder(hook)
    expect(hook.result.current.gameState).toBe('finished')
    expect(hook.result.current.points).toBe(100)
  })

  it('desde la segunda ronda, encajar resta y se puede bajar de un listón ya cruzado', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    esperarAlSaque(hook)
    expect(hook.result.current.round).toBe(2)
    const antes = hook.result.current.points
    act(() => hook.result.current.scoreOpponent())
    expect(hook.result.current.points).toBe(antes - 60)
  })

  it('la cuenta atrás de la segunda ronda ya no es la misión: sigue el listón, con su ronda', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())

    expect(hook.result.current.round).toBe(2)
    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.cartel?.detail).toMatch(/^Round 2 · to 5 goals · goal \+\d+$/)
  })

  it('en la práctica, dentro del salón, dice bajito que no cuenta', () => {
    const hook = renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    act(() => hook.result.current.setGameMode('practice'))
    act(() => hook.result.current.startGame())

    expect(hook.result.current.cartel).toMatchObject({ title: 'Practice · does not count for a medal', subdued: true })
    expect(hook.result.current.omitted).toEqual({ points: false, round: false })
    esperarAlSaque(hook)
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    expect(hook.result.current.medal).toBeNull()
  })

  it('con el juego abierto suelto: en el reto, la misión y el récord guardado; en la práctica, nada', () => {
    localStorage.setItem('glide-hockey:best-points:challenge', '3100')
    const hook = renderHook(() => useGameStoreValue())
    act(() => hook.result.current.startGame())

    expect(hook.result.current.goal).toBeNull()
    expect(hook.result.current.cartel).toMatchObject({ title: 'Win games until you lose one', detail: 'Your record 3,100' })

    act(() => hook.result.current.resetGame())
    act(() => hook.result.current.setGameMode('practice'))
    act(() => hook.result.current.startGame())
    expect(hook.result.current.cartel).toBeNull()
  })

  it('con el reto del salón, que entra jugando, el cartel está desde el primer fotograma', () => {
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, goal: OBJETIVO }))

    expect(hook.result.current.gameState).toBe('countdown')
    expect(hook.result.current.cartel?.detail).toBe('Bronze 150 · Silver 8,000 · Gold 20,000')
  })
})

describe('un gol con la partida ya decidida', () => {
  // El disco sigue rodando cuando la partida se decide: si entra, no es de ninguna partida.
  it('no cambia ni los puntos ni el marcador ni el récord', () => {
    const hook = enPractica()
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
    const hook = enPractica()
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
  function duelo(onFinish?: (resultado: GameResult) => void): Hook {
    const hook = enPractica({ onFinish })
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
    const onFinish = vi.fn()
    const hook = duelo(onFinish)
    jugar(hook, DUEL_SETUP.goalTarget, 0)

    expect(hook.result.current.isRecord).toBe(false)
    expect(hook.result.current.bestPoints).toBe(0)
    expect(getBestPoints('duel')).toBe(0)
    expect(getBestPoints('practice')).toBe(0)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('fuera del duelo no hay duelo', () => {
    const { result } = enPractica()
    expect(result.current.duel).toBeNull()
  })
})

describe('las hazañas de la partida', () => {
  /** Una práctica a 3 goles, sacada. */
  function practica(onFinish: (resultado: GameResult) => void) {
    const hook = enPractica({ onFinish })
    act(() => hook.result.current.setGoalTarget(3))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    return hook
  }

  it('las de la mesa se apuntan y se cuentan al salón al acabar, una vez en la vida', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = practica(onFinish)
    act(() => hook.result.current.scoreOpponent())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    // 3-1: gana, pero no sin encajar.
    expect(onFinish).toHaveBeenLastCalledWith(expect.objectContaining({ feats: ['GH_OWN_GOAL'] }))

    // Con la partida decidida ya no se apunta nada, y la siguiente no la repite.
    act(() => hook.result.current.recordFeat('GH_LONG_SHOT'))
    act(() => hook.result.current.startGame())
    esperarAlSaque(hook)
    act(() => hook.result.current.scoreOpponent())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    for (let i = 0; i < 3; i += 1) act(() => hook.result.current.scorePlayer())
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1]?.[0]).not.toHaveProperty('feats')
  })

  it('en el reto, la ronda ganada sin encajar se cuenta al perder el reto', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    esperarAlSaque(hook)
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    expect(hook.result.current.round).toBe(2)
    esperarAlSaque(hook)
    perderLaPartida(hook)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', feats: ['GH_SHUTOUT'] }))
  })

  it('casi: la ronda ganada encajando uno no la trae', () => {
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, onFinish }))
    esperarAlSaque(hook)
    act(() => hook.result.current.scoreOpponent())
    for (let i = 0; i < 20 && hook.result.current.round === 1; i += 1) {
      act(() => hook.result.current.scorePlayer())
    }
    esperarAlSaque(hook)
    perderLaPartida(hook)
    expect(onFinish.mock.calls[0]?.[0]).not.toHaveProperty('feats')
  })

  it('dejarla a medias no guarda las de la mesa', () => {
    const hook = practica(vi.fn())
    act(() => hook.result.current.recordFeat('GH_OWN_GOAL'))
    act(() => hook.result.current.resetGame())
    expect(localStorage.getItem('glide-hockey:hazanas')).toBeNull()
  })
})

/**
 * El gancho común de los tests de navegador (`partidaDePrueba.ts`): lo que las capturas comunes
 * piden a la partida sin jugarla.
 */
describe('el gancho de la partida', () => {
  const OBJETIVO: Goal = {
    medals: { bronze: 10, silver: 20, gold: 30 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  afterEach(() => {
    delete globalThis.__runGlideHockey
  })

  it('sin pedirlo no deja nada', () => {
    renderHook(() => useGameStoreValue({ goal: OBJETIVO }))
    expect(globalThis.__runGlideHockey).toBeUndefined()
  })

  it('empieza el reto sin tutorial, fija los puntos, lo acaba contándolo y dice el cartel', () => {
    globalThis.__runGlideHockey = {}
    const onFinish = vi.fn<(resultado: GameResult) => void>()
    const hook = enPractica({ goal: OBJETIVO, onFinish })
    const partida = globalThis.__runGlideHockey
    expect(partida.sign!()).toBeNull()

    act(() => partida.start!())
    expect([hook.result.current.gameMode, hook.result.current.gameState]).toEqual(['challenge', 'countdown'])
    expect(hook.result.current.milestones).toEqual({ grab: true, hit: true, goal: true })
    expect(partida.sign!()?.detail).toContain('Bronze 10')

    act(() => partida.score!(1))
    expect(hook.result.current.gameState).toBe('playing')
    expect(partida.sign!()?.title).toBe('Bronze at 10 · you have 1')
    act(() => partida.score!(10))
    expect(partida.sign!()?.cheer).toBe('Bronze!')

    act(() => partida.end!())
    expect(hook.result.current.gameState).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', points: 10 }))
    expect(partida.sign!()?.title).toMatch(/^Bronze · /)
  })
})
