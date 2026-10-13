'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useExit } from '../../game/exit'
import { PLAYER_LABELS, formatMargin, margin, type Player } from '../../lib/duel'
import { DIFFICULTY_LABELS } from '../../lib/gameConfig'
import { GAME_MODE_LABELS, isEndless } from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/settingsClient'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { MENU_EN } from '../../lib/menuWords'
import { formatFigure, translator } from '../../lib/textos'
import { useDuelTally } from '../../lib/useDuelTally'

/**
 * What is seen over the table while playing on desktop: the scoreboard, the
 * score and, on finishing, the summary.
 *
 * Its equivalent inside the headset is `<XRScoreboard>` and `<XRGameOver>`,
 * which are geometry because no DOM fits inside a Canvas. Both read the same
 * state.
 *
 * Almost everything is `pointer-events-none`: underneath is the table, and a
 * scoreboard that swallows the mouse movement leaves the mallet stuck. Only
 * the buttons take the pointer back.
 */

/** One figure of the scoreboard, with its label above. */
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
    lap,
    lapMultiplier,
    activeLevel,
    gameMode,
    duel,
    sign: goalSign,
  } = useGame()
  const endless = isEndless(activeGoalTarget)
  const lang = useLang()
  const t = translator(lang)
  // In the duel, the scoreboard on the left belongs to whoever holds the controller: with two
  // people in front, «Tú» does not say which of the two.
  const who = duel ? t(PLAYER_LABELS[duel.player]) : null
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-4">
      <div className="flex items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-5 py-3 backdrop-blur-sm">
        {/* The scoreboard is announced when it changes: whoever cannot see the
            table finds out all the same that there has been a goal. */}
        <div className="flex items-center gap-4" aria-live="polite">
          <Stat
            label={who ?? t('You')}
            value={String(playerGoals)}
            color="var(--color-primary)"
            large
          />
          <span aria-hidden className="text-lg font-bold text-white/25">
            :
          </span>
          <Stat
            label={t('Machine')}
            value={String(opponentGoals)}
            color="var(--color-rival)"
            large
          />
        </div>

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <Stat label={t('Points')} value={formatFigure(points, lang)} />
        {streak > 1 ? <Stat label={t('Streak')} value={`×${streak}`} /> : null}

        <span aria-hidden className="h-8 w-px bg-white/10" />

        <div className="flex flex-col gap-0.5 text-[0.7rem] text-white/50">
          <span>
            {t(GAME_MODE_LABELS[gameMode])}
            {round != null ? ` ${t('· round {round}', { round })}` : null}
            {/* The lap only when there is more than one: on the first it says
                nothing the round does not already say (see `challenge.ts`). */}
            {lap != null && lap > 1
              ? ` ${t('· lap {lap} ×{multiplier}', { lap, multiplier: lapMultiplier })}`
              : null}
            {gameMode === 'levels' ? ` ${t('· level {level}', { level: activeLevel })}` : null}
            {who != null ? ` · ${who}` : null}
          </span>
          <span>
            {t(DIFFICULTY_LABELS[activeDifficulty])} ·{' '}
            {endless ? t('endless') : t('to {goals} goals', { goals: activeGoalTarget })}
          </span>
        </div>
      </div>
      {/* What the headset's goal sign says (`ScoreboardSign`), here in real letters: the
          mission and the thresholds, the one still missing and what remains, or what was
          missing. With no live region of its own: the goals are already announced above, and
          two announcements per goal get in the way. */}
      {goalSign != null ? (
        <p
          data-goal
          className={`rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-4 py-1.5 text-center text-sm backdrop-blur-sm ${
            goalSign.subdued ? 'text-white/45' : 'font-semibold text-white'
          }`}
        >
          {goalSign.title}
          {goalSign.detail != null ? <span className="font-normal text-white/60"> — {goalSign.detail}</span> : null}
        </p>
      ) : null}
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
    gameMode,
    startGame,
    resetGame,
  } = useGame()

  const won = outcome === 'won'
  // The challenge ends and is repeated with the hall's common words (`menuWords.ts`).
  const challenge = gameMode === 'challenge'
  const endless = isEndless(activeGoalTarget)
  const lang = useLang()
  const t = translator(lang)
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          // Won or lost, in the hall's common green and red: the cyan and the red of the
          // table say whose each thing is, not whether it went well.
          style={{ color: won ? COMMON_PALETTE.hit : COMMON_PALETTE.miss }}
        >
          {endless
            ? t('Game over')
            : challenge
              ? t(MENU_EN.challengeOver)
              : levelResult
                ? levelResult.passed
                  ? t('Level {level} cleared', { level: activeLevel })
                  : t('Level {level} not cleared', { level: activeLevel })
                : won
                  ? t('Game won')
                  : t('Game lost')}
        </h2>
        {levelResult ? (
          <p className="mt-2 text-2xl tracking-[0.3em]" style={{ color: COMMON_PALETTE.gold }} aria-hidden>
            {'★'.repeat(levelResult.stars)}
            <span className="text-white/20">{'★'.repeat(3 - levelResult.stars)}</span>
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-white/60">
          {round != null
            ? t('The challenge ends at round {round}.', { round })
            : levelResult
              ? levelResult.unlocked != null
                ? t(
                    levelResult.stars === 1
                      ? '{stars} star · level {level} unlocked.'
                      : '{stars} stars · level {level} unlocked.',
                    { stars: levelResult.stars, level: levelResult.unlocked },
                  )
                : levelResult.passed
                  ? t(
                      levelResult.stars === 1
                        ? '{stars} star · score {scored}–{conceded}.'
                        : '{stars} stars · score {scored}–{conceded}.',
                      {
                        stars: levelResult.stars,
                        scored: totalPlayerGoals,
                        conceded: totalOpponentGoals,
                      },
                    )
                  : t('Win the game to open the next one.')
              : t('Final score: {scored}–{conceded}.', {
                  scored: totalPlayerGoals,
                  conceded: totalOpponentGoals,
                })}
        </p>
        <p className="mt-5 text-5xl font-bold tabular-nums">
          {formatFigure(points, lang)}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          {t('points')}
        </p>

        {isRecord ? (
          <p className="mt-3 text-sm font-semibold" style={{ color: COMMON_PALETTE.gold }}>
            {endless ? t('New best streak!') : t('New record!')}
          </p>
        ) : endless && bestPoints > 0 ? (
          <p className="mt-3 text-sm text-white/50">
            {t('Your best endless streak: {goals}', { goals: bestPoints })}
          </p>
        ) : null}
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              {t('Scored')}
            </dt>
            <dd className="font-semibold tabular-nums">{totalPlayerGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              {t('Conceded')}
            </dt>
            <dd className="font-semibold tabular-nums">{totalOpponentGoals}</dd>
          </div>
          <div>
            <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-white/40">
              {t('Best streak')}
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
            {t(challenge ? MENU_EN.anotherChallenge : 'Again')}
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            {t('Back to the menu')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The end of a match of the duel.
 *
 * After the first player's it is **the handover**: how it went and who to pass the controller
 * to, with the button that starts the other's match. After the second's, who wins and by how
 * much, and the tally between the two. The points best does not appear: in the duel what counts
 * is the margin over the machine (see `lib/duel.ts`).
 */
function DuelOver() {
  const t = translator(useLang())
  const { duel, playerGoals, opponentGoals, outcome, startGame, resetGame } = useGame()
  const tally = useDuelTally()
  // `DuelOver` is only painted in the duel; the type does not know it.
  if (duel == null) return null

  const playerName = (player: Player) => t(PLAYER_LABELS[player])
  const title = duel.over
    ? duel.winner != null
      ? t('{player} wins', { player: playerName(duel.winner) })
      : t('Tie')
    : t('{player}: {scored}–{conceded}', {
        player: playerName(duel.player),
        scored: playerGoals,
        conceded: opponentGoals,
      })

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          // The end of the duel is won by one of those standing in front: it goes in the hit
          // green. The handover, in the colour of how it went against the machine.
          style={{ color: duel.over || outcome === 'won' ? COMMON_PALETTE.hit : COMMON_PALETTE.miss }}
        >
          {title}
        </h2>

        {duel.next != null ? (
          <p className="mt-2 text-base text-white/80">
            {t('Pass the controller to {player}.', { player: playerName(duel.next) })}
          </p>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-1 text-base tabular-nums">
              {([0, 1] as const).map((player) => {
                const match = duel.matches[player]
                if (match == null) return null
                return (
                  <li
                    key={player}
                    className={duel.winner === player ? 'font-bold text-white' : 'text-white/60'}
                  >
                    {t('{player}: {scored}–{conceded} ({margin})', {
                      player: playerName(player),
                      scored: match.scored,
                      conceded: match.conceded,
                      margin: formatMargin(margin(match)),
                    })}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-sm text-white/50">
              {t('Duels won: {one}–{two} · tied: {ties}', {
                one: tally.wins[0],
                two: tally.wins[1],
                ties: tally.ties,
              })}
            </p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={startGame}
            className="cta-gradient min-h-12 w-full rounded-xl px-6 py-3 text-base font-bold transition"
          >
            {duel.next != null ? t('{player} to play', { player: playerName(duel.next) }) : t('New duel')}
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            {t('Back to the menu')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Leaving the match halfway, without waiting for the end. */
function QuitButton() {
  const { askToQuit, immersive, endRun, activeGoalTarget, gameState } = useGame()
  const exit = useExit()
  const t = translator(useLang())

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 flex gap-2">
      {/* The endless match is only closed by the player: ending it does go through
          the summary and saves the streak; leaving it does not. */}
      {isEndless(activeGoalTarget) && gameState === 'playing' ? (
        <button
          type="button"
          onClick={endRun}
          className="pointer-events-auto min-h-11 rounded-xl border border-[var(--color-primary)]/50 bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-[var(--color-primary)]"
        >
          {t('End run')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={askToQuit}
        className="pointer-events-auto min-h-11 rounded-xl border border-white/15 bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] px-4 py-2.5 text-sm font-semibold text-white/70 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
      >
        {t('Leave the game')}
      </button>
      {immersive ? (
        <button
          type="button"
          onClick={exit}
          className="pointer-events-auto min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-white/40 transition hover:text-white/70"
        >
          {t('Exit')}
        </button>
      ) : null}
    </div>
  )
}

/** What Tab can land on inside a dialog. */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The keyboard side of a modal dialog, for as long as it is mounted.
 *
 * - **Escape answers it** with `onDismiss`, which has to be the choice that loses nothing.
 * - **Tab stays inside**: past the last control comes the first and before the first, the last;
 *   pressed from anywhere behind the dialog, it comes back in. Between its own controls the browser
 *   moves the focus, as always.
 * - **Closing gives the focus back** to whatever had it when the dialog opened, if it is still on
 *   the page: without that the next Tab starts again from the top of the document.
 *
 * The listener is on the document and not on the dialog because a click on the backdrop leaves
 * the focus on `<body>`, and Escape has to keep working from there.
 */
function useModalFocus(onDismiss: () => void): RefObject<HTMLDivElement | null> {
  const dialog = useRef<HTMLDivElement>(null)
  // Read while rendering, before `autoFocus` moves the focus into the dialog: in an effect it would
  // already be the dialog's own button.
  const [opener] = useState(() => document.activeElement)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (controls == null || controls.length === 0) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      const inside = dialog.current?.contains(document.activeElement) ?? false
      const leavesBy = event.shiftKey ? first : last
      if (inside && document.activeElement !== leavesBy) return
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  useEffect(() => {
    const node = dialog.current
    return () => {
      // Only once the dialog is really gone: StrictMode rehearses this clean-up with the dialog
      // still on screen, and handing the focus back then would take it out of the dialog.
      if (node?.isConnected) return
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [opener])

  return dialog
}

/**
 * The notice before leaving the match.
 *
 * **There is no leaving at once.** The button gets pressed by accident —with the headset on
 * you cannot see what is at the sides and the arm passes where it passes—, and leaving loses
 * the goals scored so far. The table stops while it asks (see `gameStore`), so deciding costs
 * no goals.
 */
function QuitConfirm() {
  const { resetGame, keepPlaying } = useGame()
  const t = translator(useLang())
  const dialog = useModalFocus(keepPlaying)

  return (
    <div
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="quit-title"
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[var(--color-background)] p-6 text-center shadow-2xl">
        <h2 id="quit-title" className="text-xl font-bold text-white">
          {t('Leave the game?')}
        </h2>
        <p className="mt-2 text-sm text-white/60">{t('You lose the goals you have scored.')}</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={keepPlaying}
            className="min-h-12 w-full rounded-xl bg-[var(--color-primary)] px-6 py-3 text-base font-bold text-[var(--color-background)]"
          >
            {t('Keep playing')}
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/70 hover:border-white/40 hover:text-white"
          >
            {t('Leave')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HUD() {
  const { gameState, prompt, duel } = useGame()

  return (
    <>
      <Scoreboard />
      {gameState === 'countdown' ? <Countdown /> : null}
      {gameState === 'finished' ? duel != null ? <DuelOver /> : <GameOver /> : null}
      {gameState === 'playing' || gameState === 'countdown' ? (
        <QuitButton />
      ) : null}
      {prompt === 'quit' ? <QuitConfirm /> : null}
    </>
  )
}
