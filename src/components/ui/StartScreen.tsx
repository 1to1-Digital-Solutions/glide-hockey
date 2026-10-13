'use client'

import { useState } from 'react'
import { useExit } from '../../game/exit'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  MAX_GOALS,
  MIN_GOALS,
} from '../../lib/gameConfig'
import {
  GAME_MODE_HINTS,
  GAME_MODE_LABELS,
  MENU_MODE_ORDER,
  modeRows,
} from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { givesMedal, medalPhrase } from '../../lib/scoreboardSign'
import { useDuelTally } from '../../lib/useDuelTally'
import { useLang } from '../../lib/settingsClient'
import { formatFigure, translator, type TextKey } from '../../lib/textos'
import { SCENERIES } from '../../lib/settings'
import { SCENERY_HINTS, SCENERY_LABELS } from '../../lib/scenery'
import { COMFORT_LEVELS } from '../../lib/hitFeedback'
import { COMFORT_LABELS, COMFORT_LEGEND, useComfort } from '../../lib/comfort'
import { LEVEL_COUNT, levelSpec } from '../../lib/levels'
import { DIFFICULTY_COLORS } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { MENU_EN, plural } from '../../lib/menuWords'
import { gameName } from '../../lib/menuTemplate'
import { useImmersiveSupport } from '../xr/useImmersiveSupport'
import { getXrStore } from '../xr/xrStore'

/**
 * The desktop start screen: the three decisions of the game —mode, level of
 * the machine and how many goals to play to— plus the way into the headset. In
 * the duel neither level nor goals are chosen: both play the same (`DUEL_SETUP`).
 *
 * It is laid over the Canvas instead of replacing it, so that the table is seen
 * in the background while choosing: it is what makes it clear what is being
 * played before pressing start.
 *
 * Its equivalent inside the headset is `<XRMenu>`, which is geometry. Both
 * touch the same state, so choosing the level here shows there. And they follow
 * the same template (`lib/menuTemplate.ts`): the name of the cabinet, the mode
 * with the challenge first and the rest —the options of practice, the scenery
 * and the comfort— behind «Más opciones», folded every time it is opened.
 */

/** Option button of a group: the chosen one is marked by shape, not only colour. */
function OptionButton({
  selected,
  onClick,
  children,
  label,
  accent,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  /** What the screen reader announces if the drawing is not enough. */
  label?: string
  accent?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      // The side padding is the minimum and not the measure: the chips live in
      // grids that share out the width, so a `px-4` does not separate them more,
      // it only narrows the room for the text until «Imposible» runs off.
      className={`min-h-11 rounded-lg border px-2 py-2.5 text-sm font-semibold transition disabled:pointer-events-none sm:px-3 ${
        selected
          ? 'border-white/60 bg-white/15 text-white shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-foreground)_25%,transparent)]'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white'
      }`}
      style={selected && accent ? { borderColor: accent } : undefined}
    >
      {children}
    </button>
  )
}

/** Title of a group of options. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
      {children}
    </span>
  )
}

export function StartScreen() {
  const [comfort, setComfort] = useComfort()
  const {
    gameMode,
    setGameMode,
    difficulty,
    setDifficulty,
    goalTarget,
    setGoalTarget,
    endless,
    setEndless,
    activeLevel,
    unlockedLevel,
    levelStars,
    setLevel,
    scenery,
    setScenery,
    bestPoints,
    startGame,
    immersive: inSession,
    goal: hallGoal,
  } = useGame()
  const exit = useExit()
  const immersive = useImmersiveSupport()

  // **Only practice asks.** In challenge and in levels the ladder deals out level and goals, so
  // the match is already made: the mode is chosen and Jugar is pressed. Their rows are not
  // shown, not even dimmed, which were two rows of options that could not be touched.
  const lang = useLang()
  const t = translator(lang)
  // What is folded belongs to the interface and is not saved: the start screen is mounted again
  // on returning to the menu.
  const [moreOptions, setMoreOptions] = useState(false)
  const { rows: shown, foldable: canFold } = modeRows(gameMode, moreOptions)
  const practice = shown.has('machine')
  const levels = gameMode === 'levels'
  // The tally of the pair standing in front, in the duel; with none played nothing is said.
  const tally = useDuelTally()
  const duels = tally.wins[0] + tally.wins[1] + tally.ties

  return (
    <main className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <header className="mb-6">
          {/* The name of the cabinet (`menuTemplate.ts`): it does not go through the translator, it reads the same in both languages. */}
          <h1 className="text-glow-primary text-3xl font-bold tracking-tight sm:text-4xl">
            {gameName()}
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            {t(
              'You against the machine. Move the mallet with the mouse and put the puck in its goal. In the headset, take it with the grip button and the mallet follows your hand.',
            )}
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t('Game mode')}</legend>
            <FieldLabel>{t(MENU_EN.mode)}</FieldLabel>
            {/* Four in a row do not fit on a phone with «Práctica» inside: two rows of two. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MENU_MODE_ORDER.map((mode) => (
                <OptionButton
                  key={mode}
                  selected={gameMode === mode}
                  onClick={() => setGameMode(mode)}
                >
                  {t(GAME_MODE_LABELS[mode])}
                  {/* The mode that gives a medal carries its mark, besides saying so below in words. */}
                  {givesMedal(hallGoal, mode) ? (
                    <span aria-hidden className="ml-1.5" style={{ color: COMMON_PALETTE.gold }}>
                      ●
                    </span>
                  ) : null}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-white/45">
              {t(GAME_MODE_HINTS[gameMode])} {t(medalPhrase(hallGoal, gameMode))}.
            </p>
          </fieldset>

          {/* The options of practice: the level of the machine and how many goals to play to. */}
          {practice ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t('Machine level')}</legend>
                <FieldLabel>{t('Machine level')}</FieldLabel>
                {/* Five columns do not fit on a phone: with «Imposible» inside, the
                    chip is left twenty pixels wide and the name runs over the one
                    next to it. It is split into two rows and the reading order is
                    still that of the ladder. */}
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {DIFFICULTY_ORDER.map((level, index) => (
                    <OptionButton
                      key={level}
                      selected={difficulty === level}
                      onClick={() => setDifficulty(level)}
                      accent={DIFFICULTY_COLORS[level]}
                      label={t(DIFFICULTY_LABELS[level])}
                    >
                      <span className="flex flex-col items-center gap-1">
                        {/* Growing bars besides the colour: the level cannot
                            depend only on green-to-red. */}
                        <span
                          aria-hidden
                          className="block h-1.5 rounded-full"
                          style={{
                            width: `${30 + index * 16}%`,
                            minWidth: '0.5rem',
                            background: DIFFICULTY_COLORS[level],
                          }}
                        />
                        <span className="text-[0.68rem] leading-tight">
                          {t(DIFFICULTY_LABELS[level])}
                        </span>
                      </span>
                    </OptionButton>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <FieldLabel>
                  <label htmlFor="goal-target">
                    {t('Goals')} {endless ? t('· endless') : `· ${goalTarget}`}
                  </label>
                </FieldLabel>
                {/* To so many goals, or endless: the match does not end until the
                    player ends it, and the record becomes the streak. */}
                <div className="grid grid-cols-2 gap-2">
                  <OptionButton
                    selected={!endless}
                    onClick={() => setEndless(false)}
                    label={t('Fixed goals')}
                  >
                    {t('Fixed goals')}
                  </OptionButton>
                  <OptionButton
                    selected={endless}
                    onClick={() => setEndless(true)}
                    label={t('Endless')}
                  >
                    {t('Endless')}
                  </OptionButton>
                </div>
                <input
                  id="goal-target"
                  type="range"
                  min={MIN_GOALS}
                  max={MAX_GOALS}
                  step={1}
                  value={goalTarget}
                  disabled={endless}
                  onChange={(event) => setGoalTarget(Number(event.target.value))}
                  className="h-11 w-full accent-[var(--color-primary)]"
                />
              </fieldset>
            </>
          ) : null}

          {/* The level that is going to be played: the unlocked ones are chosen, the
              rest is seen with a padlock. What each one gives is said by the ladder. */}
          {levels ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t('Level')}</legend>
              <FieldLabel>
                {t('Level · {level} of {total} · {difficulty}, to {goals} goals', {
                  level: activeLevel,
                  total: LEVEL_COUNT,
                  difficulty: t(DIFFICULTY_LABELS[levelSpec(activeLevel).difficulty]),
                  goals: levelSpec(activeLevel).goalTarget,
                })}
              </FieldLabel>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => {
                  const locked = n > unlockedLevel
                  const stars = levelStars[n - 1] ?? 0
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLevel(n)}
                      disabled={locked}
                      aria-pressed={n === activeLevel}
                      aria-label={
                        locked
                          ? t('Level {level}, locked', { level: n })
                          : t(
                              stars === 1
                                ? 'Level {level}, {stars} star'
                                : 'Level {level}, {stars} stars',
                              { level: n, stars },
                            )
                      }
                      className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        n === activeLevel
                          ? 'border-white/60 bg-white/15 text-white'
                          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <span>{locked ? '🔒' : n}</span>
                      {!locked ? (
                        <span aria-hidden className="text-[0.6rem] tracking-[0.15em]" style={{ color: COMMON_PALETTE.gold }}>
                          {'★'.repeat(stars)}
                          <span className="text-white/20">{'★'.repeat(3 - stars)}</span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          {/* What is painted around: it does not belong to the match either and is
              remembered between visits. Here it is left chosen; where it is really
              used is inside the headset, changing it without leaving the session.
              With the comfort, behind «Más opciones». */}
          {shown.has('settings') ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t('What you see around you')}</legend>
                <FieldLabel>{t('Around you')}</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {SCENERIES.map((option) => (
                    <OptionButton
                      key={option}
                      selected={scenery === option}
                      onClick={() => setScenery(option)}
                    >
                      {t(SCENERY_LABELS[option])}
                    </OptionButton>
                  ))}
                </div>
                <p className="text-xs text-white/50">{t(SCENERY_HINTS[scenery])}</p>
              </fieldset>

              {/* How much a goal against is felt: the vignette, the shake of the room, the
                  slow motion, the muffled ear and the vibration (`lib/hitFeedback.ts`).
                  It is a comfort setting, and it is remembered between visits. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t(COMFORT_LEGEND)}</legend>
                <FieldLabel>{t(COMFORT_LEGEND)}</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {COMFORT_LEVELS.map((option) => (
                    <OptionButton key={option} selected={comfort === option} onClick={() => setComfort(option)}>
                      {t(COMFORT_LABELS[option])}
                    </OptionButton>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {/* What does not belong to the mode, folded: the options of practice, the scenery and
              the comfort. With the challenge chosen there is no button, as it is a fixed match. */}
          {canFold ? (
            <button
              type="button"
              aria-expanded={moreOptions}
              onClick={() => setMoreOptions(!moreOptions)}
              className="min-h-11 self-start rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-white/40 hover:text-white"
            >
              {t(moreOptions ? MENU_EN.fewerOptions : MENU_EN.moreOptions)}
            </button>
          ) : null}
        </div>

        {gameMode === 'duel' ? (
          duels > 0 ? (
            <p className="mt-5 text-sm text-white/55">
              {t('Duels won: {one}–{two} · tied: {ties}', {
                one: tally.wins[0],
                two: tally.wins[1],
                ties: tally.ties,
              })}
            </p>
          ) : null
        ) : levels ? (
          <p className="mt-5 text-sm text-white/55">
            {t('Levels cleared:')}{' '}
            <strong className="font-semibold text-white">
              {levelStars.filter((s) => s >= 1).length}
            </strong>{' '}
            {t('of {total}', { total: LEVEL_COUNT })}
          </p>
        ) : bestPoints > 0 ? (
          <p className="mt-5 text-sm text-white/55">
            {endless ? (
              <>
                {t('Your best endless streak:')}{' '}
                <strong className="font-semibold text-white">
                  {t(plural(bestPoints, '{n} goal', '{n} goals') as TextKey, { n: bestPoints })}
                </strong>
              </>
            ) : (
              <>
                {t('Your record on {mode}:', {
                  mode: t(GAME_MODE_LABELS[gameMode]).toLowerCase(),
                })}{' '}
                <strong className="font-semibold text-white">
                  {formatFigure(bestPoints, lang)}
                </strong>{' '}
                {t('points')}
              </>
            )}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={startGame}
            className="cta-gradient min-h-12 w-full rounded-xl px-6 py-3 text-base font-bold transition"
          >
            {t('Play')}
          </button>

          {immersive?.ar || immersive?.vr ? (
            <>
              <button
                type="button"
                onClick={() =>
                  // Mixed reality is entered when the headset offers it: that way the
                  // table is planted in the player's room, which is where its size
                  // is best understood.
                  immersive.ar ? getXrStore().enterAR() : getXrStore().enterVR()
                }
                className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
              >
                {t('Play in the headset')}
              </button>
              {/* The common exit of every game, which on the game's own website `ExitRing` puts there. */}
              <p className="text-center text-xs text-white/50">{t('Hold B or Y to exit')}</p>
            </>
          ) : null}

          {/* Exit only when there is somewhere to exit from. In this menu —which is
              DOM, that is, desktop— exiting means closing the immersive session (see
              `game/exit.tsx`), so without a session the button would do nothing when
              pressed. Its twin in the headset (`XRMenu`) does always make sense:
              there is a session there, and inside the xrcade hall it is what takes
              the player back to the arc of cabinets. */}
          {inSession ? (
            <button
              type="button"
              onClick={exit}
              className="min-h-11 w-full rounded-xl px-6 py-2 text-sm font-medium text-white/40 transition hover:text-white/70"
            >
              {t('Exit')}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
