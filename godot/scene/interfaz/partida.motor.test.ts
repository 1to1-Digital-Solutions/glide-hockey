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
import type { ResultadoConHazanas as Resultado } from '@/lib/hazanas'
import { gameStorage } from '@/lib/storage'

import { Partida, acotarGoles } from './partida'

/** Pasa la cuenta atrás entera, a fotogramas de 1/60. */
function sacar(partida: Partida): void {
  for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) partida.tick(1 / 60)
}

function marcar(partida: Partida, jugador: number, maquina: number): void {
  for (let i = 0; i < jugador; i++) partida.scorePlayer()
  for (let i = 0; i < maquina; i++) partida.scoreOpponent()
}

describe('la partida en Godot hace lo que el store de la web', () => {
  beforeEach(() => gameStorage()?.clear())

  it('empieza en el menú, con la práctica, Fácil y los goles de partida', () => {
    const p = new Partida()
    expect(p.gameState).toBe('menu')
    expect([p.gameMode, p.difficulty, p.goalTarget]).toEqual(['practice', 'easy', DEFAULT_GOALS])
  })

  it('los goles se quedan entre el mínimo y el máximo', () => {
    expect(acotarGoles(1)).toBe(MIN_GOALS)
    expect(acotarGoles(99)).toBe(MAX_GOALS)
    expect(acotarGoles(Number.NaN)).toBe(DEFAULT_GOALS)
  })

  it('jugar abre la cuenta atrás y, pasada, se juega; con la partida en marcha no se elige nada', () => {
    const p = new Partida()
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
    const p = new Partida()
    p.startGame()
    p.askToQuit()
    sacar(p)
    expect(p.gameState).toBe('countdown')
    p.keepPlaying()
    sacar(p)
    expect(p.gameState).toBe('playing')
  })

  it('con el visor, la cuenta se para en el último segundo hasta que el mazo está en la mano', () => {
    const p = new Partida()
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
    const p = new Partida()
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
    const p = new Partida({ alTerminar: (r) => contados.push(r) })
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
    const p = new Partida()
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
    const p = new Partida()
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
    const p = new Partida()
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
    const p = new Partida()
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
    const p = new Partida({ alTerminar: (r) => avisos.push(r) })
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
    const p = new Partida()
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
    const p = new Partida({ alTerminar: (r) => jsons.push(JSON.stringify(r)) })
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
