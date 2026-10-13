'use client'

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
    lap,
    lapMultiplier,
    activeLevel,
    gameMode,
    duel,
    cartel,
  } = useGame()
  const endless = isEndless(activeGoalTarget)
  const lang = useLang()
  const t = translator(lang)
  // En el duelo, el marcador de la izquierda es de quien tiene el mando: con dos personas
  // delante, «Tú» no dice a cuál de las dos.
  const quien = duel ? t(PLAYER_LABELS[duel.player]) : null
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-4">
      <div className="flex items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-5 py-3 backdrop-blur-sm">
        {/* El marcador se anuncia al cambiar: quien no ve la mesa se entera
            igual de que ha habido gol. */}
        <div className="flex items-center gap-4" aria-live="polite">
          <Stat
            label={quien ?? t('You')}
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
            {/* La vuelta solo cuando hay más de una: en la primera no dice nada
                que la ronda no diga ya (ver `challenge.ts`). */}
            {lap != null && lap > 1
              ? ` ${t('· lap {lap} ×{multiplier}', { lap, multiplier: lapMultiplier })}`
              : null}
            {gameMode === 'levels' ? ` ${t('· level {level}', { level: activeLevel })}` : null}
            {quien != null ? ` · ${quien}` : null}
          </span>
          <span>
            {t(DIFFICULTY_LABELS[activeDifficulty])} ·{' '}
            {endless ? t('endless') : t('to {goals} goals', { goals: activeGoalTarget })}
          </span>
        </div>
      </div>
      {/* Lo que dice el cartel del objetivo del visor (`CartelDelMarcador`), aquí con letras de
          verdad: la misión y los listones, el que falta y lo que queda, o lo que faltó. Sin
          región viva propia: los goles ya se anuncian arriba, y dos avisos por gol estorban. */}
      {cartel != null ? (
        <p
          data-objetivo
          className={`rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_82%,transparent)] px-4 py-1.5 text-center text-sm backdrop-blur-sm ${
            cartel.subdued ? 'text-white/45' : 'font-semibold text-white'
          }`}
        >
          {cartel.title}
          {cartel.detail != null ? <span className="font-normal text-white/60"> — {cartel.detail}</span> : null}
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
  // El reto acaba y se repite con las palabras comunes del salón (`palabras.ts`).
  const reto = gameMode === 'challenge'
  const endless = isEndless(activeGoalTarget)
  const lang = useLang()
  const t = translator(lang)
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          // Ganada o perdida, en el verde y el rojo comunes del salón: el cian y el rojo de la
          // mesa dicen de quién es cada cosa, no si ha salido bien.
          style={{ color: won ? COMMON_PALETTE.hit : COMMON_PALETTE.miss }}
        >
          {endless
            ? t('Game over')
            : reto
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
            {t(reto ? MENU_EN.anotherChallenge : 'Again')}
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
 * El final de una partida del duelo.
 *
 * Tras la del primero es **el traspaso**: cómo le ha ido y a quién pasarle el mando, con el botón
 * que empieza la partida del otro. Tras la del segundo, quién gana y por cuánto, y lo que llevan
 * entre los dos. La marca de puntos no sale: en el duelo lo que cuenta es la ventaja sobre la
 * máquina (ver `lib/duel.ts`).
 */
function DuelOver() {
  const t = translator(useLang())
  const { duel, playerGoals, opponentGoals, outcome, startGame, resetGame } = useGame()
  const tally = useDuelTally()
  // `DuelOver` solo se pinta en el duelo; el tipo no lo sabe.
  if (duel == null) return null

  const nombre = (player: Player) => t(PLAYER_LABELS[player])
  const titulo = duel.over
    ? duel.winner != null
      ? t('{player} wins', { player: nombre(duel.winner) })
      : t('Tie')
    : t('{player}: {scored}–{conceded}', {
        player: nombre(duel.player),
        scored: playerGoals,
        conceded: opponentGoals,
      })

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] p-6 text-center shadow-2xl backdrop-blur-sm">
        <h2
          className="text-2xl font-bold"
          // El final del duelo lo gana alguien de los que están delante: va en el verde de
          // acierto. El traspaso, en el color de cómo le fue contra la máquina.
          style={{ color: duel.over || outcome === 'won' ? COMMON_PALETTE.hit : COMMON_PALETTE.miss }}
        >
          {titulo}
        </h2>

        {duel.next != null ? (
          <p className="mt-2 text-base text-white/80">
            {t('Pass the controller to {player}.', { player: nombre(duel.next) })}
          </p>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-1 text-base tabular-nums">
              {([0, 1] as const).map((player) => {
                const partida = duel.matches[player]
                if (partida == null) return null
                return (
                  <li
                    key={player}
                    className={duel.winner === player ? 'font-bold text-white' : 'text-white/60'}
                  >
                    {t('{player}: {scored}–{conceded} ({margin})', {
                      player: nombre(player),
                      scored: partida.scored,
                      conceded: partida.conceded,
                      margin: formatMargin(margin(partida)),
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
            {duel.next != null ? t('{player} to play', { player: nombre(duel.next) }) : t('New duel')}
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

/** Dejar la partida a medias, sin esperar al final. */
function QuitButton() {
  const { askToQuit, immersive, endRun, activeGoalTarget, gameState } = useGame()
  const exit = useExit()
  const t = translator(useLang())

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

/**
 * El aviso antes de dejar la partida.
 *
 * **No se sale de golpe.** El botón se pulsa sin querer —con el visor puesto no se ve lo
 * que hay a los lados y el brazo pasa por donde pasa—, y salir pierde los goles que se
 * lleven. La mesa se para mientras se pregunta (ver `gameStore`), así que decidir no cuesta
 * goles.
 */
function QuitConfirm() {
  const { resetGame, keepPlaying } = useGame()
  const t = translator(useLang())

  return (
    <div
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
