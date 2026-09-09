'use client'

import { useExit } from '../../game/exit'
import { DIFFICULTY_LABELS } from '../../lib/gameConfig'
import { GAME_MODE_LABELS, isEndless } from '../../lib/gameMode'
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
    activeLevel,
    gameMode,
  } = useGame()
  const endless = isEndless(activeGoalTarget)
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
      <div className="flex items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-5 py-3 backdrop-blur-sm">
        {/* El marcador se anuncia al cambiar: quien no ve la mesa se entera
            igual de que ha habido gol. */}
        <div className="flex items-center gap-4" aria-live="polite">
          <Stat
            label="You"
            value={String(playerGoals)}
            color="var(--color-primary)"
            large
          />
          <span aria-hidden className="text-lg font-bold text-white/25">
            :
          </span>
          <Stat
            label="Machine"
            value={String(opponentGoals)}
            color="var(--color-rival)"
            large
          />
        </div>

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <Stat label="Points" value={points.toLocaleString('en-GB')} />
        {streak > 1 ? <Stat label="Streak" value={`×${streak}`} /> : null}

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <div className="flex flex-col gap-0.5 text-[0.7rem] text-white/50">
          <span>
            {GAME_MODE_LABELS[gameMode]}
            {round != null ? ` · round ${round}` : null}
            {gameMode === 'levels' ? ` · level ${activeLevel}` : null}
          </span>
          <span>
            {DIFFICULTY_LABELS[activeDifficulty]} ·{' '}
            {endless ? 'endless' : `to ${activeGoalTarget} goals`}
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
    bestPoints,
    totalPlayerGoals,
    totalOpponentGoals,
    round,
    activeGoalTarget,
    activeLevel,
    levelResult,
    startGame,
    resetGame,
  } = useGame()

  const won = outcome === 'won'
  const endless = isEndless(activeGoalTarget)
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          style={{ color: won ? 'var(--color-primary)' : 'var(--color-rival)' }}
        >
          {endless
            ? 'Game over'
            : levelResult
              ? levelResult.passed
                ? `Level ${activeLevel} cleared`
                : `Level ${activeLevel} not cleared`
              : won
                ? 'Game won'
                : 'Game lost'}
        </h2>
        {levelResult ? (
          <p className="mt-2 text-2xl tracking-[0.3em] text-[var(--color-accent)]" aria-hidden>
            {'★'.repeat(levelResult.stars)}
            <span className="text-white/20">{'★'.repeat(3 - levelResult.stars)}</span>
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-white/60">
          {round != null
            ? `The challenge ends at round ${round}.`
            : levelResult
              ? levelResult.unlocked != null
                ? `${levelResult.stars} ${levelResult.stars === 1 ? 'star' : 'stars'} · level ${levelResult.unlocked} unlocked.`
                : levelResult.passed
                  ? `${levelResult.stars} ${levelResult.stars === 1 ? 'star' : 'stars'} · score ${totalPlayerGoals}–${totalOpponentGoals}.`
                  : 'Win the game to open the next one.'
              : `Final score: ${totalPlayerGoals}–${totalOpponentGoals}.`}
        </p>
        <p className="mt-5 text-5xl font-bold tabular-nums">
          {points.toLocaleString('en-GB')}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          points
        </p>

        {isRecord ? (
          <p className="mt-3 text-sm font-semibold text-[var(--color-accent)]">
            {endless ? 'New best streak!' : 'New record!'}
          </p>
        ) : endless && bestPoints > 0 ? (
          <p className="mt-3 text-sm text-white/50">Your best endless streak: {bestPoints}</p>
        ) : null}
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Scored
            </dt>
            <dd className="font-semibold tabular-nums">{totalPlayerGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Conceded
            </dt>
            <dd className="font-semibold tabular-nums">{totalOpponentGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              Best streak
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
            Again
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Back to the menu
          </button>
        </div>
      </div>
    </div>
  )
}

/** Dejar la partida a medias, sin esperar al final. */
function QuitButton() {
  const { resetGame, immersive, endRun, activeGoalTarget, gameState } = useGame()
  const exit = useExit()

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 flex gap-2">
      {/* La partida sin fin solo la cierra el jugador: terminar sí pasa por el
          resumen y guarda la racha; dejarla, no. */}
      {isEndless(activeGoalTarget) && gameState === 'playing' ? (
        <button
          type="button"
          onClick={endRun}
          className="pointer-events-auto min-h-11 rounded-xl border border-[var(--color-primary)]/50 bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-[var(--color-primary)]"
        >
          End run
        </button>
      ) : null}
      <button
        type="button"
        onClick={resetGame}
        className="pointer-events-auto min-h-11 rounded-xl border border-white/15 bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] px-4 py-2.5 text-sm font-semibold text-white/70 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
      >
        Leave the game
      </button>
      {immersive ? (
        <button
          type="button"
          onClick={exit}
          className="pointer-events-auto min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          Exit
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
