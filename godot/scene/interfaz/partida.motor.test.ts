/**
 * La sesión de Glide Hockey en Godot (`partida.ts`) contra lo que hace el `gameStore` de la web.
 *
 * Son las mismas reglas que prueban `gameStore.test.tsx` y `losDosMenus.test.ts` en la web, que
 * no entran en el motor porque montan React: qué se puede elegir y cuándo, la cuenta atrás, el
 * marcador y los puntos, el final de cada modo, lo que se guarda, la escalera del reto y el
 * contrato del reto del salón. Corre dentro del motor, con los tests de dominio.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { DUEL_SETUP } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { COUNTDOWN_SECONDS, DEFAULT_GOALS, MAX_GOALS, MIN_GOALS } from '@/lib/gameConfig'
import { getBestEndlessStreak, getBestPoints } from '@/lib/highScore'
import { getStarsList, getUnlockedLevel } from '@/lib/progress'
import { goalPoints } from '@/lib/scoring'
import { semillaDeLaMesa } from '@/lib/opponent'
import type { Resultado } from '@/lib/semilla'
import { gameStorage } from '@/lib/storage'

import { Partida, acotarGoles, type OpcionesDeLaPartida } from './partida'

/** Pasa la cuenta atrás entera, a fotogramas de 1/60. */
function sacar(partida: Partida): void {
  for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) partida.tick(1 / 60)
}

/**
 * Una partida con **la práctica** elegida, que es lo que juegan casi todos estos tests: el menú
 * abre en el reto (lo comprueba el primero).
 */
function enPractica(opciones: OpcionesDeLaPartida = {}): Partida {
  const partida = new Partida(opciones)
  partida.setGameMode('practice')
  return partida
}

function marcar(partida: Partida, jugador: number, maquina: number): void {
  for (let i = 0; i < jugador; i++) partida.scorePlayer()
  for (let i = 0; i < maquina; i++) partida.scoreOpponent()
}

describe('la partida en Godot hace lo que el store de la web', () => {
  beforeEach(() => gameStorage()?.clear())

  it('empieza en el menú, con el reto elegido, Fácil y los goles de partida: jugar sin tocar nada es el reto', () => {
    const p = new Partida()
    expect(p.gameState).toBe('menu')
    expect([p.gameMode, p.difficulty, p.goalTarget]).toEqual(['challenge', 'easy', DEFAULT_GOALS])
    expect(p.enReto).toBe(false)
    p.startGame()
    expect([p.gameMode, p.gameState, p.round]).toEqual(['challenge', 'countdown', 1])
    expect(p.cartel('en')?.titulo).toBe('Win games until you lose one')
  })

  it('siempre: no recuerda el modo de la última partida, y la práctica queda a un toque', () => {
    const primera = new Partida()
    primera.setGameMode('practice')
    primera.startGame()
    expect([primera.gameMode, primera.round]).toEqual(['practice', null])
    expect(new Partida().gameMode).toBe('challenge')
  })

  it('los goles se quedan entre el mínimo y el máximo', () => {
    expect(acotarGoles(1)).toBe(MIN_GOALS)
    expect(acotarGoles(99)).toBe(MAX_GOALS)
    expect(acotarGoles(Number.NaN)).toBe(DEFAULT_GOALS)
  })

  it('jugar abre la cuenta atrás y, pasada, se juega; con la partida en marcha no se elige nada', () => {
    const p = enPractica()
    p.startGame()
    expect(p.gameState).toBe('countdown')
    expect(p.cuenta).toBe(COUNTDOWN_SECONDS)
    sacar(p)
    expect(p.gameState).toBe('playing')
    p.setGameMode('challenge')
    p.setGoalTarget(3)
    p.setDifficulty('hard')
    expect([p.gameMode, p.goalTarget, p.difficulty]).toEqual(['practice', DEFAULT_GOALS, 'easy'])
  })

  it('con la pregunta de salir delante la cuenta atrás no corre', () => {
    const p = enPractica()
    p.startGame()
    p.askToQuit()
    sacar(p)
    expect(p.gameState).toBe('countdown')
    p.keepPlaying()
    sacar(p)
    expect(p.gameState).toBe('playing')
  })

  it('con el visor, la cuenta se para en el último segundo hasta que el mazo está en la mano', () => {
    const p = enPractica()
    p.immersive = true
    p.startGame()
    sacar(p)
    expect(p.gameState).toBe('countdown')
    expect(p.esperandoElMazo).toBe(true)
    expect(p.cuenta).toBe(1)
    p.malletHeld = true
    expect(p.esperandoElMazo).toBe(false)
    sacar(p)
    expect(p.gameState).toBe('playing')
  })

  it('los goles antes de sacar no cuentan; en juego suman, restan y llevan la racha', () => {
    const p = enPractica()
    p.startGame()
    p.scorePlayer()
    expect(p.playerGoals).toBe(0)
    sacar(p)
    marcar(p, 2, 0)
    expect(p.points).toBe(goalPoints({ difficulty: 'easy', streak: 1 }) + goalPoints({ difficulty: 'easy', streak: 2 }))
    expect([p.streak, p.bestStreak]).toEqual([2, 2])
    p.scoreOpponent()
    expect(p.streak).toBe(0)
    expect(p.bestStreak).toBe(2)
    expect(p.hitos.goal).toBe(true)
  })

  it('la práctica acaba al llegar a los goles, guarda el récord y lo cuenta una vez', () => {
    const contados: Resultado[] = []
    const p = enPractica({ alTerminar: (r) => contados.push(r) })
    p.setGoalTarget(3)
    p.startGame()
    sacar(p)
    marcar(p, 3, 0)
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('won')
    expect(p.isRecord).toBe(true)
    expect(getBestPoints('practice')).toBe(p.points)
    p.scorePlayer()
    // Ganada sin encajar: la primera vez trae la hazaña (`hazanas.ts`).
    expect(contados).toEqual([{ modo: 'practice', puntos: p.points, reto: false, hazanas: ['GH_SHUTOUT'] }])
    // La siguiente con menos puntos no es récord.
    p.startGame()
    sacar(p)
    marcar(p, 0, 3)
    expect(p.outcome).toBe('lost')
    expect(p.isRecord).toBe(false)
    expect(contados).toHaveLength(2)
  })

  it('la práctica sin fin la termina quien juega, y su récord es la mejor racha', () => {
    const p = enPractica()
    p.setEndless(true)
    p.startGame()
    sacar(p)
    marcar(p, 4, 1)
    expect(p.gameState).toBe('playing')
    p.endRun()
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('won')
    expect(getBestEndlessStreak()).toBe(4)
    expect(p.isRecord).toBe(true)
  })

  it('en los niveles, ganar da estrellas y abre el siguiente; perder no abre nada', () => {
    const p = enPractica()
    p.setGameMode('levels')
    p.startGame()
    sacar(p)
    marcar(p, p.activeGoalTarget, 0)
    expect(p.levelResult).toEqual({ stars: 3, passed: true, unlocked: 2 })
    expect(getUnlockedLevel()).toBe(2)
    expect(getStarsList().split(',')[0]).toBe('3')
    p.resetGame()
    expect(p.activeLevel).toBe(2)
    p.startGame()
    sacar(p)
    marcar(p, 0, p.activeGoalTarget)
    expect(p.levelResult).toEqual({ stars: 0, passed: false, unlocked: null })
    expect(getUnlockedLevel()).toBe(2)
  })

  it('en el reto, ganar la ronda pasa a la siguiente con mesa nueva, y perder lo acaba', () => {
    const p = enPractica()
    p.setGameMode('challenge')
    p.startGame()
    sacar(p)
    const mesa = p.runId
    marcar(p, 0, 1)
    marcar(p, p.activeGoalTarget, 0)
    expect(p.gameState).toBe('countdown')
    expect(p.round).toBe(2)
    expect(p.runId).toBe(mesa + 1)
    expect([p.playerGoals, p.opponentGoals, p.totalPlayerGoals, p.totalOpponentGoals]).toEqual([0, 0, 3, 1])
    sacar(p)
    marcar(p, 0, p.activeGoalTarget)
    expect(p.gameState).toBe('finished')
    expect(p.outcome).toBe('lost')
    expect(getBestPoints('challenge')).toBe(p.points)
  })

  it('el reto del salón entra directo a jugar, con su semilla, y dice que era el reto', () => {
    const contados: Resultado[] = []
    const p = new Partida({ reto: { semilla: 1234 }, alTerminar: (r) => contados.push(r) })
    expect([p.gameMode, p.gameState, p.enReto]).toEqual(['challenge', 'countdown', true])
    expect(p.seed).toBe(semillaDeLaMesa(1234, 1, 1))
    expect(p.seed).not.toBe(new Partida().seed)
    sacar(p)
    marcar(p, 0, p.activeGoalTarget)
    expect(contados).toEqual([{ modo: 'challenge', puntos: 0, reto: true }])
    // Otra partida desde el final ya no es el reto.
    p.startGame()
    expect(p.enReto).toBe(false)
  })

  it('volver al menú no guarda nada y deja todo a cero', () => {
    const p = enPractica()
    p.startGame()
    sacar(p)
    marcar(p, 2, 0)
    p.resetGame()
    expect(p.gameState).toBe('menu')
    expect([p.playerGoals, p.points, p.streak]).toEqual([0, 0, 0])
    expect(getBestPoints('practice')).toBe(0)
  })

  it('el duelo: juega el primero, luego el segundo, contra la misma máquina, y gana quien saca más ventaja', () => {
    const avisos: Resultado[] = []
    const p = enPractica({ alTerminar: (r) => avisos.push(r) })
    expect(p.duelView).toBeNull()
    p.setGameMode('duel')
    p.setDifficulty('impossible')
    p.startGame()
    expect(p.duelView?.player).toBe(0)
    // Lo elegido en la práctica no cuenta: el duelo se juega siempre igual.
    expect([p.activeDifficulty, p.activeGoalTarget]).toEqual([DUEL_SETUP.difficulty, DUEL_SETUP.goalTarget])
    const semilla = p.seed
    sacar(p)
    marcar(p, DUEL_SETUP.goalTarget, 2)
    expect(p.gameState).toBe('finished')
    expect(p.duelView).toMatchObject({ player: 0, next: 1, over: false })

    // El traspaso: la del segundo, con la misma semilla y en otra mesa.
    const mesa = p.runId
    p.startGame()
    expect(p.duelView?.player).toBe(1)
    expect(p.seed).toBe(semilla)
    expect(p.runId).toBe(mesa + 1)
    sacar(p)
    marcar(p, 3, DUEL_SETUP.goalTarget)
    expect(p.duelView).toMatchObject({ over: true, winner: 0, next: null })
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    // Sin récord ni aviso al salón: los goles son de dos personas.
    expect([p.isRecord, p.bestPoints, getBestPoints('duel'), avisos.length]).toEqual([false, 0, 0, 0])

    // Otra vez tras un duelo cerrado es un duelo nuevo, con otra semilla; volver al menú también lo deja.
    p.startGame()
    expect(p.duelView?.player).toBe(0)
    expect(p.seed).not.toBe(semilla)
    sacar(p)
    marcar(p, 0, DUEL_SETUP.goalTarget)
    p.resetGame()
    expect(p.duelo.matches).toEqual([null, null])
  })

  it('el duelo con la misma ventaja es empate, y se apunta como empate', () => {
    const p = enPractica()
    p.setGameMode('duel')
    p.startGame()
    sacar(p)
    marcar(p, DUEL_SETUP.goalTarget, 4)
    p.startGame()
    sacar(p)
    marcar(p, DUEL_SETUP.goalTarget, 4)
    expect(p.duelView).toMatchObject({ over: true, winner: null })
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('las hazañas van en el JSON que se le pasa al salón (`report_result`), una vez en la vida', () => {
    const jsons: string[] = []
    // Lo mismo que hace `contarAlSalon` en `main.ts` con el resultado.
    const p = enPractica({ alTerminar: (r) => jsons.push(JSON.stringify(r)) })
    p.setGoalTarget(3)
    p.startGame()
    sacar(p)
    p.scoreOpponent()
    p.apuntarHazana('GH_OWN_GOAL')
    marcar(p, 3, 0)
    // Con la partida decidida ya no se apunta nada.
    p.apuntarHazana('GH_LONG_SHOT')
    expect(JSON.parse(jsons[0] ?? '{}')).toEqual({ modo: 'practice', puntos: p.points, reto: false, hazanas: ['GH_OWN_GOAL'] })
    p.startGame()
    sacar(p)
    p.apuntarHazana('GH_OWN_GOAL')
    marcar(p, 3, 0)
    expect(JSON.parse(jsons[1] ?? '{}').hazanas).toEqual(['GH_SHUTOUT'])
    p.startGame()
    sacar(p)
    marcar(p, 3, 0)
    expect(JSON.parse(jsons[2] ?? '{}')).not.toHaveProperty('hazanas')
  })

  it('en el reto, la ronda ganada sin encajar se cuenta al perderlo', () => {
    const contados: Resultado[] = []
    const p = new Partida({ reto: { semilla: 7 }, alTerminar: (r) => contados.push(r) })
    sacar(p)
    for (let i = 0; i < 20 && p.challengeRoundNumber === 1; i++) p.scorePlayer()
    sacar(p)
    for (let i = 0; i < 40 && p.gameState !== 'finished'; i++) p.scoreOpponent()
    expect(contados).toHaveLength(1)
    expect(contados[0]?.hazanas).toEqual(['GH_SHUTOUT'])
  })
})

describe('el cartel del objetivo, como en la web', () => {
  beforeEach(() => gameStorage()?.clear())

  const OBJETIVO = {
    medallas: { bronce: 150, plata: 8000, oro: 20000 },
    mejorEs: 'mas',
    unidad: 'points in the challenge',
    record: null,
    modo: 'challenge',
  } as const

  it('en el menú no hay cartel que valga: se cuelga al jugar', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    expect(p.objetivo).toBe(OBJETIVO)
    expect(p.cartel('en')).toBeNull()
    expect(p.medalla).toBeNull()
    expect(p.callado).toEqual({ puntos: false, ronda: false })
  })

  it('con el objetivo: la misión y los listones en la cuenta atrás, y después el que falta y lo que queda', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    p.startGame()
    expect(p.cartel('en')).toMatchObject({ titulo: 'Win games until you lose one', detalle: 'Bronze 150 · Silver 8,000 · Gold 20,000' })
    expect(p.cartel('es')?.titulo).toBe('Gana partidos hasta perder uno')
    expect(p.callado).toEqual({ puntos: true, ronda: true })
    sacar(p)
    expect(p.cartel('en')).toMatchObject({ titulo: 'Bronze at 150 · you have 0', detalle: 'Round 1 · to 3 goals · goal +100' })
    marcar(p, 1, 0)
    expect(p.cartel('es')).toMatchObject({ titulo: 'Bronce a 150 · llevas 100', detalle: 'Ronda 1 · a 3 goles · gol +120' })
    expect(p.medalla).toBeNull()
  })

  it('al cruzar un listón la medalla sube, en la primera ronda encajar no resta, y al acabar dice lo que faltó', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    p.startGame()
    sacar(p)
    marcar(p, 2, 0)
    expect(p.points).toBe(220)
    expect(p.medalla).toBe('bronce')
    expect(p.cartel('en')?.titulo).toBe('Silver at 8,000 · you have 220')
    marcar(p, 0, 3)
    expect(p.gameState).toBe('finished')
    expect(p.medalla).toBe('bronce')
    expect(p.cartel('en')).toMatchObject({ titulo: 'Bronze · 220 points in the challenge', detalle: '7,780 short of silver' })
    expect(p.callado).toEqual({ puntos: true, ronda: false })
    // Otra vez —el botón resaltado del final— vuelve a la misión, sin pasar por el menú.
    p.startGame()
    expect(p.cartel('en')?.titulo).toBe('Win games until you lose one')
  })

  it('dos partidas seguidas: la segunda compara con el récord que hizo la primera, no con el del montaje', () => {
    // El metadato `goal` se lee al montar y no cambia hasta volver al salón: el récord sube con lo
    // que la partida ya le ha contado (`objetivoConLoJugado` del kit), al empezar la siguiente.
    const p = new Partida({ objetivo: { ...OBJETIVO, record: 100 } })
    p.startGame()
    sacar(p)
    marcar(p, 2, 0)
    marcar(p, 0, 3)
    expect([p.gameState, p.points]).toEqual(['finished', 220])
    // El final de la primera, contra la marca de al empezar.
    expect(p.objetivo?.record).toBe(100)
    p.startGame()
    expect(p.objetivo?.record).toBe(220)
    sacar(p)
    marcar(p, 1, 3)
    expect(p.cartel('en')?.titulo).toBe('No medal · 100 points in the challenge')
    // Lo de otro modo no sube el récord del reto.
    p.resetGame()
    p.setGameMode('practice')
    p.startGame()
    expect(p.objetivo?.record).toBe(220)
  })

  it('perder la primera ronda 1–3 con un gol marcado no deja cero; desde la segunda, encajar resta', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    p.startGame()
    sacar(p)
    marcar(p, 1, 3)
    expect([p.gameState, p.points]).toEqual(['finished', 100])
    p.startGame()
    sacar(p)
    marcar(p, 3, 0)
    sacar(p)
    const antes = p.points
    p.scoreOpponent()
    expect([p.round, p.points]).toEqual([2, antes - 60])
  })

  it('aprendiendo el reto, la máquina no cuenta; al cerrar el tutorial empieza desde cero y avisa', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    p.startGame()
    sacar(p)
    p.aprendiendo = true
    marcar(p, 1, 5)
    expect([p.playerGoals, p.opponentGoals, p.gameState]).toEqual([1, 0, 'playing'])
    const mesa = p.runId
    p.aprendiendo = false
    p.acabarLaLeccion()
    expect([p.playerGoals, p.points, p.runId, p.gameState]).toEqual([0, 0, mesa + 1, 'countdown'])
    expect(p.cartel('es')?.titulo).toBe('Ahora cuenta para medalla')
    for (let i = 0; i < 160; i++) p.tick(1 / 60)
    expect(p.cartel('es')?.titulo).not.toBe('Ahora cuenta para medalla')
  })

  it('fuera del reto, aprender no cambia nada y cerrar el tutorial no vuelve a empezar', () => {
    const p = enPractica()
    p.startGame()
    sacar(p)
    p.aprendiendo = true
    p.scoreOpponent()
    const mesa = p.runId
    p.acabarLaLeccion()
    expect([p.opponentGoals, p.runId]).toEqual([1, mesa])
  })

  it('la cuenta atrás de la segunda ronda ya no es la misión', () => {
    const p = new Partida({ objetivo: OBJETIVO })
    p.startGame()
    sacar(p)
    marcar(p, 3, 0)
    expect([p.round, p.gameState]).toEqual([2, 'countdown'])
    expect(p.cartel('en')?.detalle).toBe(`Round 2 · to 5 goals · goal +${goalPoints({ difficulty: 'easy', streak: 4 })}`)
  })

  it('en la práctica, con salón, dice bajito que no cuenta; con el juego suelto, nada', () => {
    const conSalon = enPractica({ objetivo: OBJETIVO })
    conSalon.startGame()
    expect(conSalon.cartel('es')).toMatchObject({ titulo: 'Práctica · no cuenta para medalla', discreto: true })
    expect(conSalon.callado).toEqual({ puntos: false, ronda: false })
    const suelto = enPractica()
    suelto.startGame()
    expect(suelto.cartel('en')).toBeNull()
  })

  it('con el juego suelto, en el reto: la misión y el récord guardado aquí', () => {
    gameStorage()?.setItem('glide-hockey:best-points:challenge', '3100')
    const p = new Partida()
    p.startGame()
    expect(p.cartel('en')).toMatchObject({ titulo: 'Win games until you lose one', detalle: 'Your record 3,100' })
  })
})
