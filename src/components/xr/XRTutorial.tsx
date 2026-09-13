'use client'

import { useXR } from '@react-three/xr'
import { useCallback, useEffect, useState } from 'react'

import { useGrabMode, useLang } from '../../lib/ajustesCliente'
import { PALETTE } from '../../lib/palette'
import { DIM_COLOR } from './XRUi'
import { useGame } from '../../lib/gameStore'
import { traductor, type TextKey } from '../../lib/textos'
import {
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialStepKey,
} from '../../lib/tutorial'
import { CanvasPanel, drawParagraph, drawText, roundedRect, alturaDelParrafo } from './canvasPanel'
import { dibujarMando } from './mandoDibujado'
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
const POSITION: [number, number, number] = [0.34, 1.5, -1.05]
const ROTATION: [number, number, number] = [0, -0.3, 0]

/** Los dos botones, abajo del panel. */
const BOTON = { width: 0.3, height: 0.09, y: -PANEL_HEIGHT / 2 + 0.08 }
const BOTONES = [
  { id: 'next' as const, x: 0.19, texto: 'Next' as TextKey },
  { id: 'skip' as const, x: -0.19, texto: 'Skip tutorial' as TextKey },
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
export const FRASES_CON_UN_TOQUE: Record<TutorialStepKey, TextKey> = {
  grab: 'Press the grip button on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/** Cómo se llama la frase, para medirla igual que se pinta. */
const FRASE = { size: 0.042, maxWidth: PANEL_WIDTH - 0.1 }

/**
 * Dónde cae cada cosa en el panel de un paso.
 *
 * Se calcula y no se escribe a mano porque **la frase no ocupa lo mismo en los dos
 * idiomas**: la misma línea son dos renglones en inglés y tres en español, y el mando
 * dibujado tiene que bajar con ella. Sale de aquí y no de dentro del dibujo para que
 * el test pueda comprobar los mismos números que se pintan, y no una copia suya.
 */
export function repartoDelPaso(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey,
  frases: Record<TutorialStepKey, TextKey>,
  t: (clave: TextKey) => string,
): { techoDeLaFrase: number; sueloDeLaFrase: number; mando: number } {
  const techoDeLaFrase = PANEL_HEIGHT / 2 - 0.13
  const sueloDeLaFrase = techoDeLaFrase - alturaDelParrafo(ctx, t(frases[step]), FRASE)
  const techoDeLosBotones = BOTON.y + BOTON.height / 2
  return { techoDeLaFrase, sueloDeLaFrase, mando: (sueloDeLaFrase + techoDeLosBotones) / 2 }
}

/**
 * El panel del tutorial: el paso por el que va, lo que pide, el botón del mando que
 * lo hace y los dos botones de abajo. Sale del componente para que un test lo pueda
 * medir con un lienzo de mentira —`legibilidad.ts`—: es texto que nadie ha visto aún
 * con el visor puesto, y la frase larga en español es donde se sale.
 */
export function dibujarElPaso(
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
    size: 0.03,
    color: DIM_COLOR,
  })

  // En párrafo y no en una línea: encogida hasta caber de una, la frase quedaba en letra
  // de dos centímetros y con el visor puesto no se entendía nada.
  //
  // **Anclado por arriba**, no centrado: centrado, la frase que pasa de dos líneas a tres
  // crece hacia arriba y se mete debajo del contador. El español las tiene casi siempre.
  const reparto = repartoDelPaso(ctx, step, frases, t)
  drawParagraph(ctx, t(frases[step]), 0, reparto.techoDeLaFrase, {
    ...FRASE,
    color: PALETTE.foreground,
    weight: '600',
    anchor: 'top',
  })

  dibujarMando(ctx, 0, reparto.mando, TUTORIAL_BUTTONS[step], {
    cuerpo: DIM_COLOR,
    resaltado: PALETTE.foreground,
  })

  for (const boton of BOTONES) {
    roundedRect(ctx, boton.x, BOTON.y, BOTON.width, BOTON.height, 0.016)
    ctx.fillStyle = DIM_COLOR
    ctx.fill()
    drawText(ctx, t(boton.texto), boton.x, BOTON.y, {
      size: 0.032,
      color: PALETTE.background,
      weight: '700',
      maxWidth: BOTON.width - 0.03,
    })
  }
}

export function XRTutorial({
  position = POSITION,
  rotation = ROTATION,
}: {
  /** Dónde lo pone el juego. Sin esto se coloca solo, donde nació (ver `POSITION`). */
  position?: [number, number, number]
  rotation?: [number, number, number]
} = {}) {
  const { gameState, hitos, setTutorialRunning } = useGame()
  const t = traductor(useLang())
  const frases = useGrabMode() === 'toggle' ? FRASES_CON_UN_TOQUE : FRASES
  const enSesion = useXR((state) => state.mode != null)

  // Se decide una sola vez al montar: leerlo en cada render lo apagaría a mitad, en cuanto se
  // marca como visto.
  const [pendiente] = useState(() => !tutorialSeen())
  /** Cuántos pasos se ha saltado con el botón. Lo único que este panel recuerda. */
  const [saltados, setSaltados] = useState(0)

  // **El paso se calcula, no se guarda.** Sale de lo que ya ha hecho quien juega (`hitos`) y
  // de lo que se haya saltado a botón: un tutorial que llevara su propia cuenta acabaría
  // discrepando de la partida, y aquí lo que manda es la partida.
  const step = tutorialStep(hitos, saltados)
  const activo = enSesion && pendiente && gameState === 'playing' && step !== null

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
    (ctx: CanvasRenderingContext2D) => dibujarElPaso(ctx, step, frases, t),
    [step, frases, t],
  )

  if (!activo) return null

  return (
    <group position={position} rotation={rotation}>
      <CanvasPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} draw={draw} fallbackColor={PALETTE.background} />
      {BOTONES.map((boton) => (
        <mesh
          key={boton.id}
          position={[boton.x, BOTON.y, 0.002]}
          onClick={boton.id === 'next' ? siguiente : saltar}
        >
          <planeGeometry args={[BOTON.width, BOTON.height]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* El panel no se puede pulsar entero: solo sus botones. */}
      <mesh position={[0, 0, -0.001]} raycast={NO_RAYCAST}>
        <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
