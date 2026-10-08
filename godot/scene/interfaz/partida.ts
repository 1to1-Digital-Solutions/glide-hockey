/**
 * La sesión de Glide Hockey en Godot: lo que en la web es `lib/gameStore.ts`, sin React.
 *
 * El store de la web es un hook (`useState`, `useEffect`, `useSyncExternalStore`) y el motor no
 * tiene React, así que aquí se escribe la misma máquina como una clase que la escena avanza a cada
 * fotograma. **Las reglas no se reescriben**: el marcador y el final salen de `gameMode.ts`
 * (`runOutcome`), los puntos de `scoring.ts`, la escalera del reto de `challenge.ts`, los niveles
 * y sus estrellas de `levels.ts`, el duelo por turnos de `duel.ts`, lo guardado de `highScore.ts`,
 * `progress.ts` y `duelTally.ts`, y la semilla de la máquina de `opponent.ts` (`semillaDeLaMesa`). Lo que queda aquí es lo que en la web hacen los
 * `useState`: qué se ha elegido, en qué fase se está y el marcador de la partida en curso.
 *
 * Igual que en la web, **casi todo se deriva**: la fase sale de si hay partida, de la cuenta atrás
 * y del marcador, y el final del marcador y del modo. Lo que no se deriva es lo que la web guarda
 * en estado, con los mismos nombres donde se puede.
 *
 * No toca el motor (ni `godot` ni nodos), así que se prueba entera en `partida.motor.test.ts` sin
 * montar la escena.
 */
import { objetivoConLoJugado } from '@kit/lib/juegoBase'

import type { Lang } from '@/lib/ajustes'
import { AVISO_DE_QUE_CUENTA_MS, conElAvisoDeQueCuenta, loQueCallaElMarcador, partidaDelCartel } from '@/lib/cartelDelMarcador'
import { challengeRound } from '@/lib/challenge'
import { DUEL_SETUP, controllerHolder, duelOver, duelTurn, duelWinner, newDuel, recordMatch, type Duel, type Player } from '@/lib/duel'
import { saveDuelResult } from '@/lib/duelTally'
import { COUNTDOWN_SECONDS, DEFAULT_GOALS, MAX_GOALS, MIN_GOALS, type Difficulty } from '@/lib/gameConfig'
import { ENDLESS, isEndless, runOutcome, type GameMode, type RunOutcome } from '@/lib/gameMode'
import { getBestEndlessStreak, getBestPoints, saveBestEndlessStreak, saveBestPoints } from '@/lib/highScore'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from '@/lib/levels'
import { cartelDeObjetivo, medallaQueCelebra, type Medalla, type Objetivo, type Partida as PartidaDelObjetivo, type VistaDelCartel } from '@/lib/objetivo'
import { semillaDeLaMesa } from '@/lib/opponent'
import { getStarsList, getUnlockedLevel, saveLevelResult } from '@/lib/progress'
import type { Scorer } from '@/lib/puckPhysics'
import { concededPenalty, scoreConceded, scoreGoal } from '@/lib/scoring'
import { conHazanas, estrenarHazanas, hazanasDelPartido, type Hazana } from '@/lib/hazanas'
import type { Resultado, Reto } from '@/lib/semilla'
import { traductorSuave } from '@/lib/textos'
import { SIN_HITOS, apuntarHito, type TutorialHitos, type TutorialStepKey } from '@/lib/tutorial'

/** Las fases de la web (`GameState`), más la pregunta de salir, que allí es `prompt`. */
export type FaseDeLaPartida = 'menu' | 'countdown' | 'playing' | 'finished'

/** El modo con el que se juega el `reto` del salón: el del récord de la cabina (`MODO_DEL_RETO`). */
export const MODO_DEL_RETO: GameMode = 'challenge'

/** Cómo acabó un nivel: lo que enseña el final (`levelResult` de la web). */
export interface ResultadoDelNivel {
  stars: Stars
  passed: boolean
  /** El nivel que abre esta partida, si abre alguno. */
  unlocked: number | null
}

/** Restringe los goles de una partida al rango permitido (`clampGoalTarget`). */
export function acotarGoles(goles: number): number {
  if (Number.isNaN(goles)) return DEFAULT_GOALS
  return Math.min(MAX_GOALS, Math.max(MIN_GOALS, Math.round(goles)))
}

/** Cómo va el duelo, visto desde la pantalla (`DuelView` de la web). */
export interface VistaDelDuelo {
  /** De quién es la partida que está en pantalla, o la que va a empezar. */
  player: Player
  /** Las dos partidas, contando la que acaba de terminar. */
  matches: Duel['matches']
  /** A quién le toca después, o `null` si ya han jugado los dos. */
  next: Player | null
  over: boolean
  /** Quién ha ganado, o `null` si no ha acabado o es empate. */
  winner: Player | null
}

export interface OpcionesDeLaPartida {
  /** Jugar este reto: se entra directamente en una partida del reto con su semilla. */
  reto?: Reto | null
  /** Se llama una vez al acabar cada partida con puntuación (no al dejarla a medias). */
  alTerminar?: (resultado: Resultado) => void
  /**
   * Los listones de medalla del juego y la marca de quien juega, para el cartel de encima del
   * marcador (`objetivo.ts`). Sin él, el cartel dice la misión y el récord guardado aquí.
   */
  objetivo?: Objetivo | null
}

export class Partida {
  // Lo que se elige en el menú.
  goalTarget = DEFAULT_GOALS
  difficulty: Difficulty = 'easy'
  /**
   * El menú abre **siempre** en el reto, con salón o sin él, y no recuerda el último modo: es el
   * del récord y el de las medallas, así que jugar sin tocar nada es jugar a lo que cuenta. La
   * práctica queda a un toque.
   */
  gameMode: GameMode = MODO_DEL_RETO
  endless = false
  /** Nivel elegido en Niveles, o `null` = el más alto desbloqueado. */
  level: number | null = null

  // La partida en curso.
  running = false
  /** Segundos que quedan de cuenta atrás, con decimales: se enseña redondeado hacia arriba. */
  countdown = 0
  prompt: 'quit' | null = null
  /** Si el mazo va en la mano (con visor): la cuenta atrás lo espera en su último segundo. */
  malletHeld = false
  /** Si se juega con visor: sin él no hay mazo que esperar. */
  immersive = false
  runId = 0
  enReto = false
  playerGoals = 0
  opponentGoals = 0
  previousPlayerGoals = 0
  previousOpponentGoals = 0
  lastScorer: Scorer | null = null
  points = 0
  streak = 0
  bestStreak = 0
  challengeRoundNumber = 1
  /** Lo que quien juega ya ha hecho, para el tutorial: se acumula y no se deshace. */
  hitos: TutorialHitos = SIN_HITOS
  /**
   * Si el tutorial se está enseñando ahora mismo; lo dice la interfaz. En el reto, aprendiendo,
   * los goles de la máquina no cuentan (`aprendiendo` de la web).
   */
  aprendiendo = false
  /** Segundos que le quedan al aviso de que ya cuenta (`conElAvisoDeQueCuenta`). */
  private avisoQueCuenta = 0
  /** Las partidas del duelo ya cerradas y su semilla; la recién terminada se apunta al empezar la siguiente. */
  duelo: Duel = newDuel(0)
  private endedByPlayer = false
  private recordToBeat = 0
  private unlockedAtStart = 1
  private levelAtStart = 1
  private readonly semillaDelReto: number | null
  /**
   * El objetivo de la partida en curso, o `null` con el juego abierto suelto: el que pasó el salón
   * con el récord subido por lo que ya se le ha contado (`objetivoConLoJugado`). Se relee al
   * empezar cada partida —el metadato `goal` no cambia hasta volver al salón— y no durante ella:
   * el final compara con la marca que había al empezar, como la web (`salonAlEmpezar`).
   */
  objetivo: Objetivo | null
  /** Lo que pasó el salón al montar el juego. */
  private readonly objetivoDelSalon: Objetivo | null
  /** Lo que se le ha contado al salón desde que se montó: de ahí sube el récord del objetivo. */
  private readonly contadas: Resultado[] = []
  private readonly alTerminar: ((resultado: Resultado) => void) | undefined
  /** Las hazañas de esta partida (en el reto, de todas sus rondas): se estrenan al cerrarla. */
  private hazanas = new Set<Hazana>()
  /** La partida (su `runId`) cuyo final ya se guardó y se contó al salón. */
  private cerrada = 0
  /** Lo que dejó el final: si fue récord y cómo acabó el nivel. Se calcula una vez, al cerrar. */
  private _isRecord = false
  private _levelResult: ResultadoDelNivel | null = null

  constructor({ reto = null, alTerminar, objetivo = null }: OpcionesDeLaPartida = {}) {
    this.objetivoDelSalon = objetivo
    this.objetivo = objetivo
    this.semillaDelReto = reto?.semilla ?? null
    this.alTerminar = alTerminar
    if (reto != null) {
      // Con el reto del salón se entra directamente a jugar, como en la web.
      this.running = true
      this.countdown = COUNTDOWN_SECONDS
      this.runId = 1
      this.enReto = true
      this.recordToBeat = getBestPoints(MODO_DEL_RETO)
    }
  }

  get challenge(): boolean {
    return this.gameMode === 'challenge'
  }

  get levels(): boolean {
    return this.gameMode === 'levels'
  }

  get duel(): boolean {
    return this.gameMode === 'duel'
  }

  /** Ronda del reto, o `null` en un modo que no las tiene. */
  get round(): number | null {
    return this.challenge ? this.challengeRoundNumber : null
  }

  /** Por qué vuelta a la escalera va el reto, o `null` fuera de él. */
  get lap(): number | null {
    return this.challenge ? challengeRound(this.challengeRoundNumber).lap : null
  }

  get lapMultiplier(): number {
    return this.challenge ? challengeRound(this.challengeRoundNumber).multiplier : 1
  }

  get unlockedLevel(): number {
    return getUnlockedLevel()
  }

  /** Las estrellas de cada nivel, del primero al último. */
  get levelStars(): Stars[] {
    return getStarsList().split(',').map((s) => Number(s) as Stars)
  }

  /** El nivel que se juega: el elegido, o el más alto desbloqueado; en partida, el de al empezar. */
  get activeLevel(): number {
    if (this.running) return this.levelAtStart
    return this.selectedLevel
  }

  private get selectedLevel(): number {
    const abierto = getUnlockedLevel()
    return clampLevel(Math.min(this.level ?? abierto, abierto))
  }

  get activeDifficulty(): Difficulty {
    if (this.challenge) return challengeRound(this.challengeRoundNumber).difficulty
    if (this.levels) return levelSpec(this.activeLevel).difficulty
    if (this.duel) return DUEL_SETUP.difficulty
    return this.difficulty
  }

  get activeGoalTarget(): number {
    if (this.challenge) return challengeRound(this.challengeRoundNumber).goalTarget
    if (this.levels) return levelSpec(this.activeLevel).goalTarget
    if (this.duel) return DUEL_SETUP.goalTarget
    return this.endless ? ENDLESS : this.goalTarget
  }

  get totalPlayerGoals(): number {
    return this.previousPlayerGoals + this.playerGoals
  }

  get totalOpponentGoals(): number {
    return this.previousOpponentGoals + this.opponentGoals
  }

  /** Con qué semilla elige sus tiros la máquina en la mesa de ahora: en el duelo, la de los dos. */
  get seed(): number {
    if (this.duel) return this.duelo.seed
    return semillaDeLaMesa(this.enReto ? this.semillaDelReto : null, this.runId, this.challengeRoundNumber)
  }

  /** Cómo acaba la partida en curso por el marcador, sin mirar el modo. */
  private get matchOutcome(): RunOutcome | null {
    return this.running ? runOutcome({ playerGoals: this.playerGoals, opponentGoals: this.opponentGoals, goalTarget: this.activeGoalTarget }) : null
  }

  /** Cómo acabó, o `null` mientras sigue: en el reto, ganar no acaba nada, pasa de ronda. */
  get outcome(): RunOutcome | null {
    const match = this.matchOutcome
    if (match === 'won' && this.challenge) return null
    if (this.running && this.endedByPlayer && isEndless(this.activeGoalTarget)) {
      return this.playerGoals >= this.opponentGoals ? 'won' : 'lost'
    }
    return match
  }

  get gameState(): FaseDeLaPartida {
    if (!this.running) return 'menu'
    if (this.countdown > 0) return 'countdown'
    if (this.outcome != null) return 'finished'
    return 'playing'
  }

  /** La cuenta atrás está parada esperando a que se coja el mazo (`esperandoElMazo`). */
  get esperandoElMazo(): boolean {
    return this.immersive && !this.malletHeld && this.running && this.countdown > 0 && this.countdown <= 1
  }

  /** La cifra de la cuenta atrás: 3, 2, 1. */
  get cuenta(): number {
    return Math.ceil(this.countdown)
  }

  /** La partida recién terminada ha batido el récord del modo (o la racha sin fin). */
  get isRecord(): boolean {
    return this.gameState === 'finished' && this._isRecord
  }

  get levelResult(): ResultadoDelNivel | null {
    return this.gameState === 'finished' ? this._levelResult : null
  }

  /** El récord del modo elegido que enseña el menú (`bestPoints` de la web). */
  get bestPoints(): number {
    if (this.gameMode === 'practice' && this.endless) return getBestEndlessStreak()
    return this.levels || this.duel ? 0 : getBestPoints(this.gameMode)
  }

  /** La partida tal y como se le cuenta al cartel del objetivo (`partidaDelCartel` de la web). */
  private paraElCartel(lang: Lang): PartidaDelObjetivo | null {
    return partidaDelCartel(
      {
        objetivo: this.objetivo,
        gameMode: this.gameMode,
        gameState: this.gameState,
        round: this.challengeRoundNumber,
        goles: this.totalPlayerGoals + this.totalOpponentGoals,
        points: this.points,
        streak: this.streak,
        record: this.recordToBeat,
      },
      traductorSuave(lang),
    )
  }

  /**
   * Lo que dice el cartel de encima del marcador, en ese idioma, o `null` si no hay nada que
   * colgar: en el menú, y fuera del reto con el juego abierto suelto.
   */
  cartel(lang: Lang): VistaDelCartel | null {
    const partida = this.paraElCartel(lang)
    if (partida == null) return null
    const t = traductorSuave(lang)
    return conElAvisoDeQueCuenta(cartelDeObjetivo(partida, t), this.gameMode, this.avisoQueCuenta > 0, t)
  }

  /** La medalla que ya es de quien juega en esta partida: cuando sube, se celebra el listón. */
  get medalla(): Medalla | null {
    const partida = this.paraElCartel('en')
    return partida == null ? null : medallaQueCelebra(partida)
  }

  /** Lo que el marcador del fondo calla porque ya lo dice el cartel (`loQueCallaElMarcador`). */
  get callado(): { puntos: boolean; ronda: boolean } {
    return loQueCallaElMarcador(this.paraElCartel('en'))
  }

  /** El duelo con la partida recién terminada ya contada (`duelNow` de la web). */
  private get dueloAhora(): Duel {
    return this.duel && this.gameState === 'finished'
      ? recordMatch(this.duelo, { scored: this.playerGoals, conceded: this.opponentGoals })
      : this.duelo
  }

  /** Cómo va el duelo, o `null` fuera de ese modo. */
  get duelView(): VistaDelDuelo | null {
    if (!this.duel) return null
    const ahora = this.dueloAhora
    return {
      player: controllerHolder(this.duelo),
      matches: ahora.matches,
      next: duelTurn(ahora),
      over: duelOver(ahora),
      winner: duelWinner(ahora),
    }
  }

  // Lo que se elige entre partidas: con una en marcha no cambia nada, como en la web.

  setGoalTarget(goles: number): void {
    if (!this.running) this.goalTarget = acotarGoles(goles)
  }

  setEndless(sinFin: boolean): void {
    if (!this.running) this.endless = sinFin
  }

  setGameMode(modo: GameMode): void {
    if (!this.running) this.gameMode = modo
  }

  setDifficulty(nivel: Difficulty): void {
    if (!this.running) this.difficulty = nivel
  }

  setLevel(nivel: number): void {
    if (!this.running) this.level = clampLevel(Math.min(nivel, getUnlockedLevel()))
  }

  private clearRun(): void {
    this.playerGoals = 0
    this.opponentGoals = 0
    this.previousPlayerGoals = 0
    this.previousOpponentGoals = 0
    this.lastScorer = null
    this.points = 0
    this.streak = 0
    this.bestStreak = 0
    this.challengeRoundNumber = 1
    this._isRecord = false
    this._levelResult = null
    this.hazanas = new Set()
    this.avisoQueCuenta = 0
  }

  /** Empieza una partida con lo elegido: el botón de jugar, y el de otra vez. */
  startGame(): void {
    this.enReto = false
    this.prompt = null
    // En el duelo, empezar tras la partida del primero es el turno del segundo: se apunta la que
    // acaba de terminar y la semilla sigue. Con los dos jugados, o desde el menú, es un duelo nuevo
    // con la semilla de esta partida.
    if (this.duel) {
      const ahora = this.dueloAhora
      this.duelo = this.gameState === 'finished' && !duelOver(ahora) ? ahora : newDuel(this.runId + 1)
    }
    this.clearRun()
    this.endedByPlayer = false
    this.objetivo = objetivoConLoJugado(this.objetivoDelSalon, this.contadas)
    this.recordToBeat = this.gameMode === 'practice' && this.endless ? getBestEndlessStreak() : getBestPoints(this.gameMode)
    this.unlockedAtStart = getUnlockedLevel()
    this.levelAtStart = this.selectedLevel
    this.runId++
    this.countdown = COUNTDOWN_SECONDS
    this.running = true
  }

  /** Vuelve al menú sin guardar nada: dejar la partida, o volver desde el final. */
  resetGame(): void {
    this.enReto = false
    this.prompt = null
    // Volver al menú deja el duelo: el turno del otro ya no tiene contra qué compararse.
    this.duelo = newDuel(0)
    this.clearRun()
    this.countdown = 0
    this.endedByPlayer = false
    this.running = false
  }

  /** Termina la partida sin fin a voluntad: es su única salida con resumen. */
  endRun(): void {
    this.endedByPlayer = true
    this.alCambiar()
  }

  apuntarHito(hito: TutorialStepKey): void {
    this.hitos = apuntarHito(this.hitos, hito)
  }

  askToQuit(): void {
    this.prompt = 'quit'
  }

  keepPlaying(): void {
    this.prompt = null
  }

  private get enJuego(): boolean {
    return this.gameState === 'playing' && this.matchOutcome === null
  }

  /** Gol del jugador: suma puntos y alarga la racha. Con la partida decidida no cuenta. */
  scorePlayer(): void {
    if (!this.enJuego) return
    this.apuntarHito('goal')
    this.playerGoals++
    this.lastScorer = 'player'
    this.streak++
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.points = scoreGoal(this.points, { difficulty: this.activeDifficulty, streak: this.streak, lap: this.lapMultiplier })
    this.alCambiar()
  }

  /**
   * Gol de la máquina: descuenta puntos y corta la racha. Aprendiendo en el reto no cuenta, y en
   * su primera ronda no resta (`concededPenalty`).
   */
  scoreOpponent(): void {
    if (!this.enJuego || (this.aprendiendo && this.challenge)) return
    this.opponentGoals++
    this.lastScorer = 'opponent'
    this.streak = 0
    this.points = scoreConceded(this.points, concededPenalty(this.round))
    this.alCambiar()
  }

  /**
   * El tutorial se ha cerrado con la partida en marcha (`acabarLaLeccion` de la web): en el reto,
   * la partida vuelve a empezar desde cero, con su cuenta atrás, y el cartel avisa de que ya cuenta.
   */
  acabarLaLeccion(): void {
    if (!this.challenge || !this.running) return
    this.clearRun()
    this.endedByPlayer = false
    this.runId++
    this.countdown = COUNTDOWN_SECONDS
    this.avisoQueCuenta = AVISO_DE_QUE_CUENTA_MS / 1000
  }

  /**
   * Una hazaña de la mesa (`FrameResult.hazanas`), apuntada a la partida. Va **antes** que el gol
   * que la trae: el último gol cierra la partida en el acto y se la dejaría fuera. Con la partida
   * decidida no cuenta.
   */
  apuntarHazana(hazana: Hazana): void {
    if (this.enJuego) this.hazanas.add(hazana)
  }

  /**
   * Un fotograma de reloj: la cuenta atrás baja, salvo con la pregunta delante o esperando el
   * mazo en el último segundo, que es lo que en la web hace el `setTimeout` de un segundo.
   */
  tick(delta: number): void {
    this.avisoQueCuenta = Math.max(0, this.avisoQueCuenta - Math.max(0, delta))
    if (!this.running || this.countdown <= 0 || this.prompt !== null) return
    if (this.esperandoElMazo) return
    // Con el mazo sin coger, la cuenta se queda en el último segundo en vez de pasarlo.
    const suelo = this.immersive && !this.malletHeld ? Math.min(this.countdown, 1) : 0
    this.countdown = Math.max(suelo, this.countdown - Math.max(0, delta))
  }

  /**
   * Lo que en la web hacen los efectos al cambiar el marcador: pasar de ronda en el reto al ganar
   * una, y al acabar, guardar y contárselo al salón una sola vez por partida.
   */
  private alCambiar(): void {
    if (this.running && this.challenge && this.matchOutcome === 'won') {
      for (const hazana of hazanasDelPartido({ ganado: true, encajados: this.opponentGoals, sinFin: false })) this.hazanas.add(hazana)
      this.previousPlayerGoals += this.playerGoals
      this.previousOpponentGoals += this.opponentGoals
      this.playerGoals = 0
      this.opponentGoals = 0
      this.lastScorer = null
      this.challengeRoundNumber++
      this.countdown = COUNTDOWN_SECONDS
      this.runId++
      return
    }
    if (this.gameState !== 'finished' || this.cerrada === this.runId) return
    this.cerrada = this.runId
    // En el duelo no hay récord ni se avisa al salón: los goles son de dos personas. Lo que se
    // apunta, con los dos jugados, es quién ganó en el marcador de la pareja.
    if (this.duel) {
      const ahora = this.dueloAhora
      if (duelOver(ahora)) saveDuelResult(duelWinner(ahora))
      return
    }
    const endlessRun = isEndless(this.activeGoalTarget)
    if (this.levels) {
      const stars = levelStars(this.outcome === 'won', this.playerGoals, this.opponentGoals)
      const passed = levelPassed(stars)
      const nivel = this.activeLevel
      const abre = passed && nivel + 1 > this.unlockedAtStart && nivel < LEVEL_COUNT
      this._levelResult = { stars, passed, unlocked: abre ? nivel + 1 : null }
      saveLevelResult(nivel, stars)
    } else if (endlessRun) {
      saveBestEndlessStreak(this.bestStreak)
      this._isRecord = this.bestStreak > this.recordToBeat && getBestEndlessStreak() === this.bestStreak
    } else {
      saveBestPoints(this.gameMode, this.points)
      this._isRecord = this.points > this.recordToBeat && getBestPoints(this.gameMode) === this.points
    }
    for (const hazana of hazanasDelPartido({ ganado: this.outcome === 'won', encajados: this.opponentGoals, sinFin: endlessRun })) {
      this.hazanas.add(hazana)
    }
    const resultado = conHazanas({ modo: this.gameMode, puntos: this.points, reto: this.enReto }, estrenarHazanas(this.hazanas))
    this.contadas.push(resultado)
    this.alTerminar?.(resultado)
  }
}
