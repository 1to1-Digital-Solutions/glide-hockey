'use client'

import { useXR } from '@react-three/xr'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGrabMode, useLang } from '../../lib/settingsClient'
import { PALETTE } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { DIM_COLOR } from './XRUi'
import { useGame } from '../../lib/gameStore'
import { translator, type TextKey } from '../../lib/textos'
import {
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialStepKey,
} from '../../lib/tutorial'
import { ButtonHighlight, useButtonFeedback } from './buttonHighlight'
import { CanvasPanel, drawParagraph, drawText, roundedRect, paragraphHeight } from './canvasPanel'
import { drawController } from './drawnController'
import { RealController } from './RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * Cómo se tira, dentro del visor y solo la primera vez.
 *
 * **Se aprende haciendo, no mirando.** Cada paso se supera cuando quien juega lo hace: el
 * mazo aparece en la mano, sale volando, se clava. El juego **no se para** mientras tanto —el
 * mazo se coge de verdad—, y el tutorial espera sin reloj hasta que pasa lo que tiene que
 * pasar. Antes era un pase de diapositivas con un monigote y el juego parado: se podía mirar
 * sin hacer nada y al acabar el tiempo se daba por aprendido.
 *
 * **Y se enseña el mando.** Un paso que pide el botón de agarre dibuja un mando con ese botón
 * resaltado (`mandoDibujado.ts`): con el visor puesto, lo que hay en la mano tiene cinco
 * botones y ninguno con su nombre escrito.
 *
 * **Siempre hay salida**: siguiente y saltar. Un paso que no se consiga —porque el mazo no se
 * clava— dejaría a alguien encerrado en él.
 *
 * El guion vive en `lib/tutorial.ts`, probado sin navegador; aquí solo se pinta y se escucha.
 */

/**
 * Medidas del panel, en metros. Como el del menú de ancho, y bastante más alto: lleva
 * contador, frase, el mando dibujado y dos botones, y la frase ocupa **tres líneas en
 * español donde ocupa dos en inglés**.
 */
export const PANEL_WIDTH = 0.78
export const PANEL_HEIGHT = 0.62

/**
 * Dónde se planta, **cuando el juego no lo dice**.
 *
 * Este valor viene de darts —«algo a la derecha de la diana»— y se copió tal cual a los
 * doce. Los juegos que saben dónde va su panel se lo pasan y este no se usa: aparecer en un
 * sitio distinto de donde estaba el menú obliga a buscarlo, y quien acaba de entrar es
 * justamente quien no sabe dónde mirar.
 */
const POSITION: [number, number, number] = [0.68, 1.5, -1.05]
const ROTATION: [number, number, number] = [0, -0.57, 0]

/**
 * A qué tamaño se escribe cada cosa del panel, en metros de alto de letra.
 *
 * Una sola lista para quien pinta y para quien mide (`tutorial.legible.test.ts`). El contador y
 * los botones iban a 30 y 32 mm y «Saltar tutorial» se encogía a 29 para caber: con el panel a
 * metro y medio, se quedaban en 1°.
 */
export const TUTORIAL_TEXT = { counter: 0.036, phrase: 0.042, button: 0.036 } as const

/**
 * Los dos botones, abajo del panel: lo bastante anchos para que «Saltar tutorial» quepa entero a
 * su tamaño, con dos centímetros entre ellos.
 */
export const BUTTON = { width: 0.37, height: 0.09, y: -PANEL_HEIGHT / 2 + 0.08 }

export const BOTONES = [
  { id: 'next' as const, x: 0.195, text: 'Next' as TextKey },
  { id: 'skip' as const, x: -0.195, text: 'Skip tutorial' as TextKey },
]

/** Lo que se pide en cada paso. */
export const FRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Close your hand on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/**
 * Y con **un toque** en vez de manteniendo (ver `lib/agarre.ts`). El tutorial es la única
 * pantalla que explica el gesto: enseñar el de mantener a quien no puede mantener nada sería
 * explicarle el juego al revés.
 */
export const PHRASES_WITH_ONE_TAP: Record<TutorialStepKey, TextKey> = {
  grab: 'Press the grip button on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/** Cómo se llama la frase, para medirla igual que se pinta. */
const FRASE = { size: TUTORIAL_TEXT.phrase, maxWidth: PANEL_WIDTH - 0.1 }

/**
 * Dónde cae cada cosa en el panel de un paso.
 *
 * Se calcula y no se escribe a mano porque **la frase no ocupa lo mismo en los dos
 * idiomas**: la misma línea son dos renglones en inglés y tres en español, y el mando
 * dibujado tiene que bajar con ella. Sale de aquí y no de dentro del dibujo para que
 * el test pueda comprobar los mismos números que se pintan, y no una copia suya.
 */
export function stepLayout(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey,
  frases: Record<TutorialStepKey, TextKey>,
  t: (clave: TextKey) => string,
): { phraseTop: number; phraseBottom: number; controller: number } {
  const phraseTop = PANEL_HEIGHT / 2 - 0.13
  const phraseBottom = phraseTop - paragraphHeight(ctx, t(frases[step]), FRASE)
  const techoDeLosBotones = BUTTON.y + BUTTON.height / 2
  return { phraseTop: phraseTop, phraseBottom: phraseBottom, controller: (phraseBottom + techoDeLosBotones) / 2 }
}

/**
 * El panel del tutorial: el paso por el que va, lo que pide, el botón del mando que
 * lo hace y los dos botones de abajo. Sale del componente para que un test lo pueda
 * medir con un lienzo de mentira —`legibilidad.ts`—: es texto que nadie ha visto aún
 * con el visor puesto, y la frase larga en español es donde se sale.
 */
export function drawStep(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey | null,
  frases: Record<TutorialStepKey, TextKey>,
  t: (clave: TextKey) => string,
): void {
  roundedRect(ctx, 0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0.02)
  ctx.fillStyle = PALETTE.background
  ctx.fill()

  if (step == null) return

  // Por cuál se va, que es lo que dice cuánto queda.
  drawText(ctx, `${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length}`, 0, PANEL_HEIGHT / 2 - 0.05, {
    size: TUTORIAL_TEXT.counter,
    color: DIM_COLOR,
  })

  // En párrafo y no en una línea: encogida hasta caber de una, la frase quedaba en letra
  // de dos centímetros y con el visor puesto no se entendía nada.
  //
  // **Anclado por arriba**, no centrado: centrado, la frase que pasa de dos líneas a tres
  // crece hacia arriba y se mete debajo del contador. El español las tiene casi siempre.
  const reparto = stepLayout(ctx, step, frases, t)
  drawParagraph(ctx, t(frases[step]), 0, reparto.phraseTop, {
    ...FRASE,
    color: PALETTE.foreground,
    weight: '600',
    anchor: 'top',
  })

  drawController(ctx, 0, reparto.controller, TUTORIAL_BUTTONS[step], {
    body: DIM_COLOR,
    highlight: PALETTE.foreground,
  })

  for (const boton of BOTONES) {
    roundedRect(ctx, boton.x, BUTTON.y, BUTTON.width, BUTTON.height, 0.016)
    ctx.fillStyle = DIM_COLOR
    ctx.fill()
    drawText(ctx, t(boton.text), boton.x, BUTTON.y, {
      size: TUTORIAL_TEXT.button,
      color: PALETTE.background,
      weight: '700',
      maxWidth: BUTTON.width - 0.03,
    })
  }
}

export function XRTutorial({
  position = POSITION,
  rotation = ROTATION,
}: {
  /** Dónde lo pone el juego. Sin esto se coloca solo, donde nació (ver `POSITION`). */
  position?: [number, number, number]
  /** Como el `rotation` de three: con el orden, si no es `'XYZ'`. */
  rotation?: [number, number, number] | [number, number, number, 'YXZ']
} = {}) {
  const { gameState, gameMode, milestones: hitos, setTutorialRunning, setLearning: setAprendiendo, finishLesson: acabarLaLeccion, inChallenge: enReto } = useGame()
  const t = translator(useLang())
  const frases = useGrabMode() === 'toggle' ? PHRASES_WITH_ONE_TAP : FRASES
  const enSesion = useXR((state) => state.mode != null)

  // Se decide una sola vez al montar: leerlo en cada render lo apagaría a mitad, en cuanto se
  // marca como visto.
  const [pendiente] = useState(() => !tutorialSeen())
  /** Cuántos pasos se ha saltado con el botón. Lo único que este panel recuerda. */
  const [saltados, setSaltados] = useState(0)
  // Apuntado y pulsado, que es lo que el botón tiene que contestar (`buttonHighlight.tsx`).
  const { stateOf, handlersFor } = useButtonFeedback()

  // **El paso se calcula, no se guarda.** Sale de lo que ya ha hecho quien juega (`hitos`) y
  // de lo que se haya saltado a botón: un tutorial que llevara su propia cuenta acabaría
  // discrepando de la partida, y aquí lo que manda es la partida.
  const step = tutorialStep(hitos, saltados)
  // **En el reto del salón no hay tutorial**: es la misma partida para todos, y la
  // demostración retrasa el saque solo a quien no lo ha hecho. **Ni en el duelo**: las dos
  // partidas tienen que ser iguales, y el tutorial solo le saldría a quien no lo ha hecho.
  const activo = enSesion && pendiente && gameState === 'playing' && step !== null && !enReto && gameMode !== 'duel'

  // Mientras se enseña, en el reto no cuenta lo que mete la máquina (`aprendiendo`).
  useEffect(() => {
    setAprendiendo(activo)
  }, [activo, setAprendiendo])
  useEffect(() => () => setAprendiendo(false), [setAprendiendo])

  // Y al cerrarse con la partida en marcha —por sus pasos, por «Siguiente» o por «Saltar»—, el
  // reto empieza desde cero y el cartel avisa de que ahora cuenta (`acabarLaLeccion`). Que se
  // acabe la partida o se salga del visor no es cerrarlo.
  const ensenaba = useRef(false)
  useEffect(() => {
    if (activo) {
      ensenaba.current = true
      return
    }
    if (ensenaba.current && step === null && gameState === 'playing') acabarLaLeccion()
    ensenaba.current = false
  }, [activo, step, gameState, acabarLaLeccion])

  const siguiente = useCallback(() => setSaltados((n) => n + 1), [])
  const saltar = useCallback(() => setSaltados(TUTORIAL_STEPS.length), [])

  // Marcar que ya se ha visto **sí** es un efecto: escribe fuera de React y no toca estado.
  useEffect(() => {
    if (step === null && pendiente) markTutorialSeen()
  }, [step, pendiente])

  // **El juego no espera.** Antes se paraba para explicar; ahora la explicación es jugar.
  useEffect(() => {
    setTutorialRunning(false)
    return () => setTutorialRunning(false)
  }, [setTutorialRunning])

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => drawStep(ctx, step, frases, t),
    [step, frases, t],
  )

  if (!activo) return null

  return (
    <>
      {/* Fuera del grupo del panel a propósito: esto no vive en el panel, vive en la mano.
          Se coloca solo, deshaciendo lo que le pongan sus padres. En las dos manos porque
          aquí vale cualquiera de ellas: encender solo una sería decir que la otra no sirve. */}
      <RealController hand="left" button={TUTORIAL_BUTTONS[step]} />
      <RealController hand="right" button={TUTORIAL_BUTTONS[step]} />
      <group position={position} rotation={rotation}>
        <CanvasPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} draw={draw} fallbackColor={PALETTE.background} />
        {BOTONES.map((boton) => (
          <group key={boton.id} position={[boton.x, BUTTON.y, 0.002]}>
            <mesh
              onClick={boton.id === 'next' ? siguiente : saltar}
              {...handlersFor(boton.id)}
            >
              <planeGeometry args={[BUTTON.width, BUTTON.height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* **Encenderse al apuntar es lo que dice que el botón responde.** El resto de
                paneles del juego ya lo hacen y estos no, así que con el visor puesto el
                tutorial parecía un cartel: «los botones no se marcan cuando se apuntan». */}
            <ButtonHighlight
              width={BUTTON.width}
              height={BUTTON.height}
              state={stateOf(boton.id)}
              glow={COMMON_PALETTE.accent}
              ink={PALETTE.background}
            />
          </group>
        ))}
        {/* El panel no se puede pulsar entero: solo sus botones. */}
        <mesh position={[0, 0, -0.001]} raycast={NO_RAYCAST}>
          <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
