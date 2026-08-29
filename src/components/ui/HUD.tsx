'use client'

import { useExit } from '../../game/exit'
import { DIFFICULTY_LABELS } from '../../lib/gameConfig'
import { GAME_MODE_LABELS } from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'

/**
 * Lo que se ve encima de la mesa mientras se juega en escritorio: el marcador,
 * la puntuación y, al acabar, el resumen.
 *
 * Su equivalente dentro del visor es `<XRScoreboard>` y `<XRGameOver>`, que son
 * geometría porque dentro de un Canvas no cabe DOM. Los dos leen el mismo
 * estado.
 *
 * Casi todo es `pointer-events-none`: por debajo está la mesa, y un marcador
 * que se coma el movimiento del ratón deja el mazo clavado. Solo los botones
 * recuperan el puntero.
 */

/** Un dato del marcador, con su etiqueta encima. */
function Stat({
  label,
  value,
  color,
  large = false,
}: {
  label: string
  value: string
  color?: string
  large?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>
      <span
        className={`font-bold tabular-nums ${large ? 'text-4xl' : 'text-xl'}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function Scoreboard() {
  const {
    playerGoals,
    opponentGoals,
    activeGoalTarget,
    activeDifficulty,
    points,
    streak,
    round,
    gameMode,
  } = useGame()

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
      <div className="flex items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-5 py-3 backdrop-blur-sm">
        {/* El marcador se anuncia al cambiar: quien no ve la mesa se entera
            igual de que ha habido gol. */}
        <div className="flex items-center gap-4" aria-live="polite">
          <Stat
            label="Tú"
            value={String(playerGoals)}
            color="var(--color-primary)"
            large
          />
          <span aria-hidden className="text-lg font-bold text-white/25">
            :
          </span>
          <Stat
            label="Máquina"
            value={String(opponentGoals)}
            color="var(--color-rival)"
            large
          />
        </div>

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <Stat label="Puntos" value={points.toLocaleString('es-ES')} />
        {streak > 1 ? <Stat label="Racha" value={`×${streak}`} /> : null}

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <div className="flex flex-col gap-0.5 text-[0.7rem] text-white/50">
          <span>
            {GAME_MODE_LABELS[gameMode]}
            {round != null ? ` · ronda ${round}` : null}
          </span>
          <span>
            {DIFFICULTY_LABELS[activeDifficulty]} · a {activeGoalTarget} goles
          </span>
        </div>
      </div>
    </header>
  )
}

function Countdown() {
  const { countdown } = useGame()

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-live="assertive"
    >
      <p
        key={countdown}
        className="animate-countdown-pop text-8xl font-bold text-[var(--color-primary-bright)]"
      >
        {countdown}
      </p>
    </div>
  )
}

function GameOver() {
  const {
    outcome,
    points,
    isRecord,
    bestStreak,
    totalPlayerGoals,
    totalOpponentGoals,
    round,
    startGame,
    resetGame,
  } = useGame()

  const won = outcome === 'won'

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          style={{ color: won ? 'var(--color-primary)' : 'var(--color-rival)' }}
        >
          {won ? 'Partida ganada' : 'Partida perdida'}
        </h2>
        <p className="mt-1.5 text-sm text-white/60">
          {round != null
            ? `El reto se acaba en la ronda ${round}.`
            : `Marcador final: ${totalPlayerGoals}–${totalOpponentGoals}.`}
        </p>

        <p className="mt-5 text-5xl font-bold tabular-nums">
          {points.toLocaleString('es-ES')}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          puntos
        </p>

        {isRecord ? (
          <p className="mt-3 text-sm font-semibold text-[var(--color-accent)]">
            ¡Récord nuevo!
          </p>
        ) : null}

        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Metidos
            </dt>
            <dd className="font-semibold tabular-nums">{totalPlayerGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Encajados
            </dt>
            <dd className="font-semibold tabular-nums">{totalOpponentGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Mejor racha
            </dt>
            <dd className="font-semibold tabular-nums">{bestStreak}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={startGame}
            className="cta-gradient min-h-12 w-full rounded-xl px-6 py-3 text-base font-bold transition"
          >
            Otra vez
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Volver al menú
          </button>
        </div>
      </div>
    </div>
  )
}

/** Dejar la partida a medias, sin esperar al final. */
function QuitButton() {
  const { resetGame, immersive } = useGame()
  const exit = useExit()

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 flex gap-2">
      <button
        type="button"
        onClick={resetGame}
        className="pointer-events-auto min-h-11 rounded-xl border border-white/15 bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] px-4 py-2.5 text-sm font-semibold text-white/70 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
      >
        Dejar la partida
      </button>
      {immersive ? (
        <button
          type="button"
          onClick={exit}
          className="pointer-events-auto min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          Salir
        </button>
      ) : null}
    </div>
  )
}

export function HUD() {
  const { gameState } = useGame()

  return (
    <>
      <Scoreboard />
      {gameState === 'countdown' ? <Countdown /> : null}
      {gameState === 'finished' ? <GameOver /> : null}
      {gameState === 'playing' || gameState === 'countdown' ? (
        <QuitButton />
      ) : null}
    </>
  )
}
