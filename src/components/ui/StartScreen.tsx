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
  MODOS_DEL_MENU,
  filasDelModo,
} from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { daMedalla, fraseDeLaMedalla } from '../../lib/cartelDelMarcador'
import { useDuelTally } from '../../lib/useDuelTally'
import { useLang } from '../../lib/settingsClient'
import { formatoDeCifra, traductor, type TextKey } from '../../lib/textos'
import { SCENERIES } from '../../lib/settings'
import { SCENERY_HINTS, SCENERY_LABELS } from '../../lib/scenery'
import { COMFORT_LEVELS } from '../../lib/hitFeedback'
import { CONFORT_LABELS, CONFORT_LEGEND, useConfort } from '../../lib/confort'
import { LEVEL_COUNT, levelSpec } from '../../lib/levels'
import { DIFFICULTY_COLORS } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { MENU_EN, plural } from '../../lib/menuWords'
import { gameName } from '../../lib/menuTemplate'
import { useImmersiveSupport } from '../xr/useImmersiveSupport'
import { getXrStore } from '../xr/xrStore'

/**
 * La pantalla de inicio de escritorio: las tres decisiones del juego —modo,
 * nivel de la máquina y a cuántos goles— más la entrada al visor. En el duelo
 * no se elige ni nivel ni goles: los dos juegan lo mismo (`DUEL_SETUP`).
 *
 * Se superpone al Canvas en vez de sustituirlo, para que la mesa se vea de
 * fondo mientras se elige: es lo que hace que se entienda a qué se está jugando
 * antes de darle a empezar.
 *
 * Su equivalente dentro del visor es `<XRMenu>`, que es geometría. Los dos
 * tocan el mismo estado, así que elegir el nivel aquí se ve allí. Y siguen la
 * misma plantilla (`lib/plantillaDelMenu.ts`): el nombre de la cabina, el modo
 * con el reto primero y lo demás —las opciones de la práctica, el decorado y el
 * confort— detrás de «Más opciones», plegado cada vez que se abre.
 */

/** Botón de opción de un grupo: el elegido se marca por forma, no solo color. */
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
  /** Lo que anuncia el lector de pantalla si el dibujo no basta. */
  label?: string
  accent?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      // El relleno lateral es el mínimo y no la medida: las fichas viven en
      // rejillas que reparten el ancho, así que un `px-4` no las separa más,
      // solo estrecha el hueco del texto hasta que «Imposible» se sale.
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

/** Título de un grupo de opciones. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
      {children}
    </span>
  )
}

export function StartScreen() {
  const [confort, setConfort] = useConfort()
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
    objetivo,
  } = useGame()
  const exit = useExit()
  const immersive = useImmersiveSupport()

  // **Solo la práctica pregunta.** En reto y en niveles la escalera reparte nivel y goles, así
  // que la partida ya está hecha: se elige el modo y se le da a Jugar. Sus filas no se
  // enseñan ni apagadas, que eran dos filas de opciones que no se podían tocar.
  const lang = useLang()
  const t = traductor(lang)
  // Lo plegado es de la interfaz y no se guarda: la portada se monta de nuevo al volver al menú.
  const [masOpciones, setMasOpciones] = useState(false)
  const { filas, plegable } = filasDelModo(gameMode, masOpciones)
  const practice = filas.has('maquina')
  const levels = gameMode === 'levels'
  // Lo que lleva la pareja que está delante, en el duelo; con ninguno jugado no se dice nada.
  const tally = useDuelTally()
  const duelos = tally.wins[0] + tally.wins[1] + tally.ties

  return (
    <main className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <header className="mb-6">
          {/* El nombre de la cabina (`plantillaDelMenu.ts`): no pasa por el traductor, se lee igual en los dos idiomas. */}
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
            {/* Cuatro en fila no caben en un móvil con «Práctica» dentro: dos filas de dos. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODOS_DEL_MENU.map((mode) => (
                <OptionButton
                  key={mode}
                  selected={gameMode === mode}
                  onClick={() => setGameMode(mode)}
                >
                  {t(GAME_MODE_LABELS[mode])}
                  {/* El modo que da medalla lleva su marca, además de decirlo abajo con letras. */}
                  {daMedalla(objetivo, mode) ? (
                    <span aria-hidden className="ml-1.5" style={{ color: COMMON_PALETTE.gold }}>
                      ●
                    </span>
                  ) : null}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-white/45">
              {t(GAME_MODE_HINTS[gameMode])} {t(fraseDeLaMedalla(objetivo, gameMode))}.
            </p>
          </fieldset>

          {/* Las opciones de la práctica: el nivel de la máquina y a cuántos goles. */}
          {practice ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t('Machine level')}</legend>
                <FieldLabel>{t('Machine level')}</FieldLabel>
                {/* Cinco columnas no caben en un móvil: con «Imposible» dentro, la
                    ficha se queda en veinte píxeles de ancho y el nombre se sale
                    por encima de la de al lado. Se parte en dos filas y el orden de
                    lectura sigue siendo el de la escalera. */}
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
                        {/* Barras crecientes además del color: el nivel no puede
                            depender solo de verde-a-rojo. */}
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
                {/* A tantos goles, o sin fin: la partida no se acaba hasta que el
                    jugador la termina, y el récord pasa a ser la racha. */}
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

          {/* El nivel que se va a jugar: los desbloqueados se eligen, el resto se
              ve con candado. Lo que da cada uno lo dice la escalera. */}
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
                  const bloqueado = n > unlockedLevel
                  const stars = levelStars[n - 1] ?? 0
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLevel(n)}
                      disabled={bloqueado}
                      aria-pressed={n === activeLevel}
                      aria-label={
                        bloqueado
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
                      <span>{bloqueado ? '🔒' : n}</span>
                      {!bloqueado ? (
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

          {/* Lo que se pinta alrededor: tampoco es de la partida y se recuerda
              entre visitas. Aquí se deja elegido; donde de verdad se usa es
              dentro del visor, cambiándolo sin salir de la sesión. Con el
              confort, detrás de «Más opciones». */}
          {filas.has('ajustes') ? (
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

              {/* Cuánto se nota un gol en contra: la viñeta, la sacudida de la sala, la
                  cámara lenta, el oído tapado y la vibración (`lib/golpeRecibido.ts`).
                  Es un ajuste de confort, y se recuerda entre visitas. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t(CONFORT_LEGEND)}</legend>
                <FieldLabel>{t(CONFORT_LEGEND)}</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {COMFORT_LEVELS.map((option) => (
                    <OptionButton key={option} selected={confort === option} onClick={() => setConfort(option)}>
                      {t(CONFORT_LABELS[option])}
                    </OptionButton>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {/* Lo que no es del modo, plegado: las opciones de la práctica, el decorado y el confort.
              Con el reto elegido no hay botón, que es una partida fija. */}
          {plegable ? (
            <button
              type="button"
              aria-expanded={masOpciones}
              onClick={() => setMasOpciones(!masOpciones)}
              className="min-h-11 self-start rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-white/40 hover:text-white"
            >
              {t(masOpciones ? MENU_EN.fewerOptions : MENU_EN.moreOptions)}
            </button>
          ) : null}
        </div>

        {gameMode === 'duel' ? (
          duelos > 0 ? (
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
                  {formatoDeCifra(bestPoints, lang)}
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
                  // Se entra en realidad mixta cuando el visor la ofrece: así la
                  // mesa se planta en la habitación del jugador, que es donde
                  // mejor se entiende su tamaño.
                  immersive.ar ? getXrStore().enterAR() : getXrStore().enterVR()
                }
                className="min-h-11 w-full rounded-xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
              >
                {t('Play in the headset')}
              </button>
              {/* La salida común de todos los juegos, que en la web propia pone `AroDeSalir`. */}
              <p className="text-center text-xs text-white/50">{t('Hold B or Y to exit')}</p>
            </>
          ) : null}

          {/* Salir solo cuando hay de dónde salir. En este menú —que es DOM, o
              sea, escritorio— salir significa cerrar la sesión inmersiva (ver
              `game/exit.tsx`), así que sin sesión el botón no haría nada al
              pulsarlo. Su gemelo del visor (`XRMenu`) sí tiene sentido siempre:
              allí hay sesión, y dentro del salón de xrcade es lo que devuelve al
              jugador al arco de cabinas. */}
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
