'use client'

import { useCallback } from 'react'

import { PLAYER_LABELS, formatMargin, margin, type Player } from '../../lib/duel'
import type { DuelTally } from '../../lib/duelTally'
import { useGame, type DuelView } from '../../lib/gameStore'
import { useDuelTally } from '../../lib/useDuelTally'
import { useGrabMode, useLang } from '../../lib/ajustesCliente'
import { traductor, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { MandoDeVerdad } from './MandoDeVerdad'
import { isEndless } from '../../lib/gameMode'
import { PALETTE } from '../../lib/palette'
import { materialEncendido, PALETA } from '../../lib/paleta'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRSalirIcon,
  XRMenuIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  type XrHitBox,
} from './XRUi'

/**
 * El marcador y el final de partida, dentro del visor.
 *
 * Es el equivalente inmersivo de `ui/HUD`. Todo son cifras de siete segmentos y
 * placas de color (ver `lib/xrDigits.ts` para el porqué de no usar texto): el
 * marcador en cian es el del jugador y el rojo el de la máquina, los mismos
 * colores que llevan sus mazos en la mesa.
 *
 * Quien lo monta decide dónde va; aquí solo se compone (ver `GameWorld`).
 */

const SMALL_BUTTON: [number, number] = [0.1, 0.1]
const ACTION_BUTTON: [number, number] = [0.24, 0.11]

/** Altura de cada fila del marcador dentro de su panel, en metros. */
const ROW = { goals: 0.06, points: -0.065, round: -0.135 }

function hitBox(
  x: number,
  y: number,
  [width, height]: [number, number],
): XrHitBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/**
 * Lo que mide la placa del marcador, en metros.
 *
 * Sale del componente para poder comprobar desde fuera que no se le pone otro panel delante: el
 * menú de ajustes lo tapaba entero, y eso solo se ve desde los ojos de quien juega
 * (`lib/panelOcclusion.ts`).
 */
export const SCOREBOARD_SIZE = { width: 0.52, height: 0.34 } as const

/** El marcador de la partida en curso, con los puntos debajo. */
export function XRScoreboard() {
  const { gameState, playerGoals, opponentGoals, points, round, lap, gameMode, activeLevel, duel } =
    useGame()
  // La ronda del reto, el nivel en Niveles o, en el duelo, qué jugador tiene el mando: la misma
  // fila. Sin letras, el número del jugador es lo que dice de quién es el marcador cian.
  const fila = round ?? (gameMode === 'levels' ? activeLevel : duel != null ? duel.player + 1 : null)
  // La vuelta a la escalera del reto, solo cuando ya hay más de una: en la
  // primera no dice nada que la ronda no diga ya (ver `lib/challenge.ts`).
  const vuelta = lap != null && lap > 1 ? lap : null
  if (gameState === 'menu') return null

  return (
    <group>
      {/* Alto para las tres filas: marcador, puntos y —en reto— la ronda. Una
          cifra ocupa `1,14 × size` contando el grosor de los segmentos, y con
          el panel más corto la ronda se dibujaba encima de los puntos y se
          salía por abajo. */}
      <XRPanel width={SCOREBOARD_SIZE.width} height={SCOREBOARD_SIZE.height} opacity={0.7} />

      <XRNumber
        value={playerGoals}
        size={0.13}
        color={PALETTE.primary}
        position={[-0.12, ROW.goals, 0]}
      />
      {/* Separador de marcador: dos puntos, que es lo que se lee como «a». */}
      {[-0.03, 0.03].map((y) => (
        <mesh key={y} position={[0, ROW.goals + y, 0]}>
          <planeGeometry args={[0.016, 0.016]} />
          <meshBasicMaterial color={DIM_COLOR} toneMapped={false} />
        </mesh>
      ))}
      <XRNumber
        value={opponentGoals}
        size={0.13}
        color={PALETTE.rival}
        position={[0.12, ROW.goals, 0]}
      />

      <XRNumber
        value={points}
        size={0.055}
        color={PALETTE.puck}
        position={[0, ROW.points, 0]}
      />

      {/* En reto, la ronda por la que va; en niveles, el nivel. En prueba no hay
          nada que enseñar aquí. Con más de una vuelta a la escalera, la ronda se
          corre a la izquierda para dejarle sitio al contador de vueltas. */}
      {fila != null ? (
        <XRNumber
          value={fila}
          size={0.04}
          color={DIM_COLOR}
          position={[vuelta != null ? -0.05 : 0, ROW.round, 0]}
        />
      ) : null}

      {/* El contador de vueltas: un aspa y el número, en el color de los puntos.
          Va en ese color y no en el de la ronda a propósito: lo que dice no es
          por dónde se va, es que **lo que se meta ahora vale más** (ver
          `lib/challenge.ts`). Un aspa con dos rayas cruzadas y no una letra: aquí
          no hay tipografía, hay segmentos (`XRNumber`). */}
      {vuelta != null ? (
        <group position={[0.05, ROW.round, 0]}>
          {[1, -1].map((giro) => (
            <mesh key={giro} position={[-0.028, 0, 0]} rotation={[0, 0, (giro * Math.PI) / 4]}>
              <planeGeometry args={[0.026, 0.005]} />
              <meshBasicMaterial color={PALETTE.puck} toneMapped={false} />
            </mesh>
          ))}
          <XRNumber value={vuelta} size={0.04} color={PALETTE.puck} position={[0.008, 0, 0]} />
        </group>
      ) : null}
    </group>
  )
}

/**
 * Lo ancho y lo alto del aviso de coger el mazo, en metros.
 *
 * Con el alto de dos renglones de su letra y el párrafo colgado cerca del borde, el primero se
 * salía de la placa por arriba; y en español, con un toque, la frase ocupa tres. La placa tiene
 * alto para tres y la frase va centrada en ella.
 */
export const AVISO_DEL_MAZO: [number, number] = [0.62, 0.2]

/** A qué tamaño se escribe el aviso de coger el mazo, en metros de alto de letra. */
export const MALLET_TEXT = { phrase: 0.036 } as const

/**
 * Lo que pone el aviso de coger el mazo, fuera del componente **para poder medirlo**
 * (`cuenta.legible.test.ts`): es texto del visor como cualquier otro panel.
 */
export function dibujarElAvisoDelMazo(
  ctx: CanvasRenderingContext2D,
  t: (clave: TextKey) => string,
  conUnToque: boolean,
): void {
  drawParagraph(
    ctx,
    t(
      conUnToque
        ? 'Press the grip button on the mallet to pick it up'
        : 'Close your hand on the mallet to pick it up',
    ),
    0,
    0,
    { size: MALLET_TEXT.phrase, color: PALETTE.foreground, weight: '700', maxWidth: AVISO_DEL_MAZO[0] - 0.06 },
  )
}

/**
 * La cuenta atrás antes del saque, grande y sobre la mesa.
 *
 * **Y cuando se para, dice por qué.** En el último segundo espera a que el mazo esté en la
 * mano —sacar con el mazo en la mesa es empezar a perder—, y eso no se contaba: el 1 se
 * quedaba clavado y desde dentro parece que el juego se ha colgado. Reportado con el visor
 * puesto: «el countdown se queda parado en el 1 sin ninguna explicación». La frase es la
 * misma que enseña el tutorial, y cambia con la forma de agarrar elegida en el arcade.
 *
 * **Y enseña qué botón es.** Decir «el botón de agarre» solo sirve a quien ya sabe cuál es, y
 * aquí el tutorial no puede ayudar: su paso de coger se supera **en la cuenta atrás**, antes
 * de que el panel llegue a salir. Así que el botón se enciende donde está, sobre el mando que
 * se tiene en la mano (`MandoDeVerdad.tsx`). En las dos manos: el mazo se coge con
 * cualquiera.
 */
export function XRCountdown() {
  const { gameState, countdown, esperandoElMazo } = useGame()
  const t = traductor(useLang())
  const conUnToque = useGrabMode() === 'toggle'

  const escribir = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarElAvisoDelMazo(ctx, t, conUnToque),
    [t, conUnToque],
  )

  if (gameState !== 'countdown') return null

  if (esperandoElMazo) {
    return (
      <>
        {/* Fuera del grupo del aviso a propósito: esto no vive en el panel, vive en la mano.
            Se coloca solo, deshaciendo lo que le pongan sus padres. */}
        <MandoDeVerdad mano="left" boton="agarre" />
        <MandoDeVerdad mano="right" boton="agarre" />
        <group>
          <XRPanel width={AVISO_DEL_MAZO[0]} height={AVISO_DEL_MAZO[1]} />
          <CanvasPanel
            width={AVISO_DEL_MAZO[0]}
            height={AVISO_DEL_MAZO[1]}
            draw={escribir}
            fallbackColor={PALETTE.background}
          />
        </group>
      </>
    )
  }

  return (
    <XRNumber value={countdown} size={0.26} color={PALETTE.primaryBright} />
  )
}

/** Lo que mide el panel del final de partida, en metros. */
export const GAME_OVER_SIZE: [number, number] = [0.6, 0.42]

/** Los tres botones del final de partida, en coordenadas del propio panel. */
export const GAME_OVER_BOXES = {
  play: hitBox(-0.12, -0.13, ACTION_BUTTON),
  menu: hitBox(0.11, -0.13, SMALL_BUTTON),
  exit: hitBox(0.24, -0.13, SMALL_BUTTON),
}

/**
 * A qué tamaño se escribe el final del duelo, en metros de alto de letra.
 *
 * Una sola lista para quien pinta y para quien mide (`duelo.legible.test.ts`), los mismos que el
 * aviso de salir, que va en la misma columna y a la misma escala.
 */
export const DUEL_TEXT = { title: 0.05, body: 0.034 } as const

/**
 * Lo que se escribe al acabar una partida del duelo.
 *
 * Es de las pocas cosas del visor con letras, y a propósito: «pásale el mando a Jugador 2» no se
 * dice con una placa de color. Aparte del componente para poder **medirlo** en los dos idiomas
 * (`duelo.legible.test.ts`): el español es más largo y es donde el texto se sale.
 */
export function dibujarElDuelo(
  ctx: CanvasRenderingContext2D,
  t: (clave: TextKey, valores?: Record<string, string | number>) => string,
  duel: DuelView,
  score: { scored: number; conceded: number },
  tally: DuelTally,
): void {
  const nombre = (player: Player) => t(PLAYER_LABELS[player])
  const ancho = GAME_OVER_SIZE[0] - 0.08
  const titulo = duel.over
    ? duel.winner != null
      ? t('{player} wins', { player: nombre(duel.winner) })
      : t('Tie')
    : t('{player}: {scored}–{conceded}', { player: nombre(duel.player), ...score })
  drawText(ctx, titulo, 0, 0.15, { size: DUEL_TEXT.title, color: PALETTE.foreground, weight: '700', maxWidth: ancho })

  if (duel.next != null) {
    drawParagraph(ctx, t('Pass the controller to {player}.', { player: nombre(duel.next) }), 0, 0.05, {
      size: DUEL_TEXT.body,
      color: PALETTE.foreground,
      maxWidth: ancho,
    })
    return
  }

  ;([0, 1] as const).forEach((player, fila) => {
    const partida = duel.matches[player]
    if (partida == null) return
    drawText(
      ctx,
      t('{player}: {scored}–{conceded} ({margin})', {
        player: nombre(player),
        scored: partida.scored,
        conceded: partida.conceded,
        margin: formatMargin(margin(partida)),
      }),
      0,
      0.09 - fila * 0.05,
      {
        size: DUEL_TEXT.body,
        color: duel.winner === player ? PALETTE.primary : DIM_COLOR,
        weight: duel.winner === player ? '700' : '400',
        maxWidth: ancho,
      },
    )
  })
  // Lo que llevan entre los dos es una frase con tres cifras que crecen con cada duelo: se reparte
  // en líneas y no se encoge, porque encogida baja del tamaño que se lee a la distancia de la
  // columna. Anclada arriba crece solo hacia abajo, hacia los botones.
  drawParagraph(
    ctx,
    t('Duels won: {one}–{two} · tied: {ties}', { one: tally.wins[0], two: tally.wins[1], ties: tally.ties }),
    0,
    0.015,
    { size: DUEL_TEXT.body, color: DIM_COLOR, maxWidth: ancho, anchor: 'top' },
  )
}

/**
 * El final de partida: cuántos puntos, y qué hacer ahora.
 *
 * Fuera del duelo, sin texto: el resultado se dice con el color de la
 * placa —el verde común de acierto si ganó, el rojo de fallo si perdió, los mismos
 * en todo el salón— y con el marcador, que sigue a la vista al lado. Los dos se
 * distinguen también por luz (`paleta.test.ts`), que es lo que queda sin ver el
 * color. En el duelo va escrito (`dibujarElDuelo`): de quién era la partida y a
 * quién le toca, o quién gana.
 */
export function XRGameOver() {
  const {
    gameState,
    outcome,
    points,
    isRecord,
    levelResult,
    duel,
    playerGoals,
    opponentGoals,
    startGame,
    resetGame,
  } = useGame()
  const exit = useExit()
  const t = traductor(useLang())
  const tally = useDuelTally()

  const escribirElDuelo = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (duel != null) dibujarElDuelo(ctx, t, duel, { scored: playerGoals, conceded: opponentGoals }, tally)
    },
    [t, duel, playerGoals, opponentGoals, tally],
  )

  if (gameState !== 'finished') return null

  const won = outcome === 'won'
  return (
    <group>
      <XRPanel width={GAME_OVER_SIZE[0]} height={GAME_OVER_SIZE[1]} />

      {/* En el duelo, lo que se dice va escrito. El botón de jugar empieza la partida del otro,
          o un duelo nuevo. */}
      {duel != null ? (
        <group position={[0, 0, 0.004]}>
          <CanvasPanel
            width={GAME_OVER_SIZE[0]}
            height={GAME_OVER_SIZE[1]}
            draw={escribirElDuelo}
            fallbackColor={PALETTE.background}
          />
        </group>
      ) : (
        <>
          <mesh position={[0, 0.13, -0.01]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial {...materialEncendido(won ? PALETA.acierto : PALETA.fallo)} />
          </mesh>

          <XRNumber
            value={points}
            size={0.11}
            color={isRecord ? PALETA.oro : PALETTE.foreground}
            position={[0, 0.02, 0]}
          />
        </>
      )}

      {/* Las estrellas del nivel, bajo los puntos: las ganadas encendidas. */}
      {levelResult ? (
        <group position={[0, -0.055, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.045, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.022, 0.022]} />
              <meshBasicMaterial
                color={i < levelResult.stars ? PALETA.oro : DIM_COLOR}
                toneMapped={false}
                transparent
                opacity={i < levelResult.stars ? 1 : 0.35}
              />
            </mesh>
          ))}
        </group>
      ) : null}
      <XRPressable
        box={GAME_OVER_BOXES.play}
        onSelect={startGame}
      >
        <XRPlate
          width={ACTION_BUTTON[0]}
          height={ACTION_BUTTON[1]}
          color={PALETTE.primary}
        />
        <XRPlayIcon size={0.045} />
      </XRPressable>

      {/* Volver al menú y salir del juego son cosas distintas, así que llevan
          iconos distintos: dos aspas iguales no se pueden diferenciar. */}
      <XRPressable box={GAME_OVER_BOXES.menu} onSelect={resetGame}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRMenuIcon color={DIM_COLOR} />
      </XRPressable>

      <XRPressable box={GAME_OVER_BOXES.exit} onSelect={exit}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSalirIcon />
      </XRPressable>
    </group>
  )
}

/** Dejar la partida sin llegar al final; y en la sin fin, terminarla con resumen. */
export function XRQuitButton() {
  const { gameState, askToQuit, endRun, activeGoalTarget, prompt } = useGame()

  if (gameState !== 'playing' && gameState !== 'countdown') return null
  // Con el aviso abierto el botón se aparta: el aviso sale justo donde está él (`XR_QUIT`).
  if (prompt !== null) return null

  return (
    <group>
      {/* Pregunta antes de dejarla: el brazo pasa por aquí y salir pierde los goles. */}
      {/* Del azul del juego y opaco, no gris y translúcido: a metro y medio y con las máquinas de
          la sala detrás, el gris se perdía contra ellas y había que buscarlo. */}
      <XRPressable box={hitBox(0, 0, SMALL_BUTTON)} onSelect={askToQuit}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.primaryDeep}
          opacity={0.95}
        />
        <XRMenuIcon color={PALETTE.foreground} />
      </XRPressable>
      {isEndless(activeGoalTarget) && gameState === 'playing' ? (
        <XRPressable box={hitBox(0.13, 0, SMALL_BUTTON)} onSelect={endRun}>
          <XRPlate
            width={SMALL_BUTTON[0]}
            height={SMALL_BUTTON[1]}
            color={PALETTE.primaryDeep}
            opacity={0.9}
          />
          <mesh>
            <planeGeometry args={[0.036, 0.036]} />
            <meshBasicMaterial color={PALETTE.foreground} toneMapped={false} />
          </mesh>
        </XRPressable>
      ) : null}
    </group>
  )
}

/** Lo que ocupa el panel, en metros. */
export const CONFIRM_SIZE: [number, number] = [0.72, 0.42]

/**
 * Sus tres botones, en coordenadas del propio panel.
 *
 * **Tres y no dos.** El botón de las tres rayitas dice «opciones» y lo que hacía era
 * preguntar si salir: reportado con el visor puesto, «el botón de salir parece que abre las
 * opciones». Ahora abre esto, y salir es una de las cosas que hay dentro — que es el orden
 * que la gente espera.
 *
 * Seguir jugando va el primero y más ancho: es la respuesta que no pierde nada. «Volver al menú»
 * no cabía en 28 cm con la letra que se lee y se encogía a 25 mm: su botón mide lo que pide la
 * etiqueta en inglés, que es la larga.
 */
export const CONFIRM_BOXES = {
  stay: hitBox(0, -0.04, [0.44, 0.1]),
  menu: hitBox(-0.155, -0.16, [0.37, 0.1]),
  leave: hitBox(0.2, -0.16, [0.26, 0.1]),
}

/** A qué tamaño se escribe el aviso, en metros de alto de letra (`salida.legible.test.ts`). */
export const CONFIRM_TEXT = { title: 0.05, body: 0.034, button: 0.034 } as const

/**
 * El aviso antes de dejar la partida.
 *
 * **No se sale de golpe.** El botón se pulsa sin querer —con el visor puesto no se ve lo
 * que hay a los lados y el brazo pasa por donde pasa—, y salir pierde los goles que se
 * lleven. Así que se para la mesa y se pregunta; mientras se pregunta el disco no corre,
 * porque si no, decidir costaría goles.
 *
 * Va donde el menú, en medio de la mesa y a la altura de la vista: es donde ya se está
 * mirando, y lo que se decide aquí no es un detalle.
 *
 * Es la única parte de la interfaz inmersiva de este juego con letras. El resto son cifras
 * y placas de color a propósito, pero una pregunta no se dibuja: hay que leerla.
 */
/**
 * Lo que pone el aviso, fuera del componente **para poder medirlo**.
 *
 * Un panel del visor se pinta en un lienzo que nadie mira al tamaño al que se lee, así que
 * un texto que se sale o dos que se pisan solo se descubren con las gafas puestas — y así
 * se descubrió este. Sacado aquí, `legibilidad.test.ts` lo escribe en un lienzo que apunta
 * y comprueba que ni se pisa ni se sale.
 */
export function dibujarElAviso(ctx: CanvasRenderingContext2D, t: (clave: TextKey) => string): void {
  drawParagraph(ctx, t('Leave the game?'), 0, 0.15, {
    size: CONFIRM_TEXT.title,
    color: PALETTE.foreground,
    weight: '700',
    maxWidth: CONFIRM_SIZE[0] - 0.08,
  })
  drawParagraph(ctx, t('You lose the goals you have scored.'), 0, 0.075, {
    size: CONFIRM_TEXT.body,
    color: DIM_COLOR,
    maxWidth: CONFIRM_SIZE[0] - 0.08,
  })
  drawText(ctx, t('Keep playing'), CONFIRM_BOXES.stay.position[0], CONFIRM_BOXES.stay.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.background,
    weight: '700',
    maxWidth: CONFIRM_BOXES.stay.size[0] - 0.03,
  })
  drawText(ctx, t('Back to the menu'), CONFIRM_BOXES.menu.position[0], CONFIRM_BOXES.menu.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.foreground,
    maxWidth: CONFIRM_BOXES.menu.size[0] - 0.03,
  })
  drawText(ctx, t('Leave'), CONFIRM_BOXES.leave.position[0], CONFIRM_BOXES.leave.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.foreground,
    maxWidth: CONFIRM_BOXES.leave.size[0] - 0.03,
  })
}

export function XRQuitConfirm() {
  const { prompt, resetGame, keepPlaying } = useGame()
  const exit = useExit()
  const t = traductor(useLang())

  const escribir = useCallback((ctx: CanvasRenderingContext2D) => dibujarElAviso(ctx, t), [t])

  if (prompt !== 'quit') return null

  return (
    <group>
      <XRPanel width={CONFIRM_SIZE[0]} height={CONFIRM_SIZE[1]} opacity={0.96} />

      {/* Volver al menú del juego y salirse del todo son cosas distintas, y hasta ahora solo
          estaba la primera con el nombre de la segunda. */}
      <XRPressable box={CONFIRM_BOXES.menu} onSelect={resetGame}>
        <XRPlate
          width={CONFIRM_BOXES.menu.size[0]}
          height={CONFIRM_BOXES.menu.size[1]}
          color={PALETTE.rail}
          opacity={0.9}
        />
      </XRPressable>

      <XRPressable box={CONFIRM_BOXES.leave} onSelect={exit}>
        <XRPlate
          width={CONFIRM_BOXES.leave.size[0]}
          height={CONFIRM_BOXES.leave.size[1]}
          color={PALETTE.rail}
          opacity={0.9}
        />
      </XRPressable>

      <XRPressable box={CONFIRM_BOXES.stay} onSelect={keepPlaying}>
        <XRPlate
          width={CONFIRM_BOXES.stay.size[0]}
          height={CONFIRM_BOXES.stay.size[1]}
          color={PALETTE.primary}
        />
      </XRPressable>

      {/* El texto va encima de las placas: el lienzo es transparente salvo donde escribe. */}
      <group position={[0, 0, 0.03]}>
        <CanvasPanel
          width={CONFIRM_SIZE[0]}
          height={CONFIRM_SIZE[1]}
          draw={escribir}
          fallbackColor={PALETTE.background}
        />
      </group>
    </group>
  )
}
