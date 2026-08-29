'use client'

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
  GAME_MODE_ORDER,
} from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { DIFFICULTY_COLORS } from '../../lib/palette'
import { useImmersiveSupport } from '../xr/useImmersiveSupport'
import { getXrStore } from '../xr/xrStore'

/**
 * La pantalla de inicio de escritorio: las tres decisiones del juego —modo,
 * nivel de la máquina y a cuántos goles— más la entrada al visor.
 *
 * Se superpone al Canvas en vez de sustituirlo, para que la mesa se vea de
 * fondo mientras se elige: es lo que hace que se entienda a qué se está jugando
 * antes de darle a empezar.
 *
 * Su equivalente dentro del visor es `<XRMenu>`, que es geometría. Los dos
 * tocan el mismo estado, así que elegir el nivel aquí se ve allí.
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
          ? 'border-white/60 bg-white/15 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)]'
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
  const {
    gameMode,
    setGameMode,
    difficulty,
    setDifficulty,
    goalTarget,
    setGoalTarget,
    bestPoints,
    startGame,
    immersive: inSession,
  } = useGame()
  const exit = useExit()
  const immersive = useImmersiveSupport()

  // En reto la escalera reparte nivel y goles, así que elegirlos no haría nada.
  // Se dejan a la vista, apagados: enseñan a qué se está renunciando a decidir,
  // que es distinto de esconderlos.
  const challenge = gameMode === 'challenge'

  return (
    <main className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="pointer-events-auto animate-fade-slide-up w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <header className="mb-6">
          <h1 className="text-glow-primary text-3xl font-bold tracking-tight sm:text-4xl">
            Air Hockey
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            Tú contra la máquina. Mueve el mazo con el ratón y cuela el disco en
            su portería.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Modo de juego</legend>
            <FieldLabel>Modo</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {GAME_MODE_ORDER.map((mode) => (
                <OptionButton
                  key={mode}
                  selected={gameMode === mode}
                  onClick={() => setGameMode(mode)}
                >
                  {GAME_MODE_LABELS[mode]}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-white/45">{GAME_MODE_HINTS[gameMode]}</p>
          </fieldset>

          {/* Apagado de verdad, no apagado de aspecto: unas fichas al 45 % que
              siguen respondiendo al clic sin cambiar nada son, para un lector
              de pantalla, cinco botones conmutables que no conmutan.
              `fieldset disabled` desactiva nativamente lo que lleva dentro,
              igual que su gemelo del visor (`XRMenu`). */}
          <fieldset
            disabled={challenge}
            className={`flex flex-col gap-2 transition ${challenge ? 'opacity-45' : ''}`}
          >
            <legend className="sr-only">Nivel de la máquina</legend>
            <FieldLabel>
              Nivel {challenge ? '· lo marca el reto' : null}
            </FieldLabel>
            {/* Cinco columnas no caben en un móvil: con «Imposible» dentro, la
                ficha se queda en veinte píxeles de ancho y el nombre se sale
                por encima de la de al lado. Se parte en dos filas y el orden de
                lectura sigue siendo el de la escalera. */}
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {DIFFICULTY_ORDER.map((level, index) => (
                <OptionButton
                  key={level}
                  selected={!challenge && difficulty === level}
                  onClick={() => setDifficulty(level)}
                  accent={DIFFICULTY_COLORS[level]}
                  label={DIFFICULTY_LABELS[level]}
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
                      {DIFFICULTY_LABELS[level]}
                    </span>
                  </span>
                </OptionButton>
              ))}
            </div>
          </fieldset>

          <fieldset
            className={`flex flex-col gap-2 transition ${challenge ? 'opacity-45' : ''}`}
          >
            <FieldLabel>
              <label htmlFor="goal-target">
                Goles {challenge ? '· los reparte el reto' : `· ${goalTarget}`}
              </label>
            </FieldLabel>
            <input
              id="goal-target"
              type="range"
              min={MIN_GOALS}
              max={MAX_GOALS}
              step={1}
              value={goalTarget}
              disabled={challenge}
              onChange={(event) => setGoalTarget(Number(event.target.value))}
              className="h-11 w-full accent-[var(--color-primary)]"
            />
          </fieldset>
        </div>

        {bestPoints > 0 ? (
          <p className="mt-5 text-sm text-white/55">
            Tu récord en {GAME_MODE_LABELS[gameMode].toLowerCase()}:{' '}
            <strong className="font-semibold text-white">
              {bestPoints.toLocaleString('es-ES')}
            </strong>{' '}
            puntos
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={startGame}
            className="cta-gradient min-h-12 w-full rounded-xl px-6 py-3 text-base font-bold transition"
          >
            Jugar
          </button>

          {immersive?.ar || immersive?.vr ? (
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
              Jugar con el visor
            </button>
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
              Salir
            </button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
