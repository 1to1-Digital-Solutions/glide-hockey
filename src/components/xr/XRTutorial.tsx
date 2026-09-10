'use client'

import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useCallback, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'

import { useGame } from '../../lib/gameStore'
import { CanvasPanel, drawParagraph } from './canvasPanel'
import { PALETTE } from '../../lib/palette'
import {
  markTutorialSeen,
  tutorialFrameAt,
  tutorialSeen,
  TUTORIAL_SECONDS,
  type TutorialStepKey,
} from '../../lib/tutorial'
import { DIM_COLOR, XRCloseIcon, XRPanel, XRPlate, XRPressable, type XrHitBox } from './XRUi'

/**
 * La demostración de cómo se coge el mazo, dentro del visor y solo la primera vez.
 *
 * El mazo **no se maneja apuntando**. Hay que llevar la mano hasta él y apretar el gatillo
 * lateral; apretar desde lejos no lo trae (ver `lib/malletGrab.ts`). Y eso es justo lo que
 * nadie adivina, porque el menú del visor sí se maneja con el rayo: lo primero que se
 * aprende es lo que no sirve para jugar.
 *
 * **Sin una sola letra**, como el resto de la interfaz inmersiva: `<Text>` de drei baja las
 * fuentes de un CDN que la CSP del salón bloquea. Lo que enseña el gesto es el
 * **movimiento** —la mano llegando, el mazo yendo con ella, el mazo quedándose al soltar—
 * y la marca del gatillo, que se enciende y **se queda** encendida mientras se sostiene.
 *
 * El guion —qué se enseña, cuánto dura y si ya se ha visto— vive en `lib/tutorial.ts`,
 * probado sin navegador. Aquí solo se pinta.
 */

/** Medidas del panel, en metros. */
const PANEL_WIDTH = 0.72
const PANEL_HEIGHT = 0.4

/** De dónde a dónde va la mano en el dibujo, en metros dentro del panel. */
const DESDE = -0.24
const HASTA = 0.22

/** Dónde espera el mazo: la mano tiene que llegar hasta él. */
const MAZO = -0.02

/** El botón de saltárselo, abajo a la derecha del panel. */
const SKIP_BOX: XrHitBox = {
  position: [PANEL_WIDTH / 2 - 0.08, -PANEL_HEIGHT / 2 + 0.06, 0],
  size: [0.1, 0.1, 0.04],
}

/**
 * Dónde está la mano en cada tramo, de izquierda a derecha del panel.
 *
 * Llega hasta el mazo, se lo lleva más allá y sigue de vacío al soltar: los tres tramos
 * son un solo recorrido, que es como se hace de verdad.
 */
function manoX(step: 'hand' | 'draw' | 'release', progress: number): number {
  if (step === 'hand') return DESDE + (MAZO - DESDE) * progress
  return MAZO + (HASTA - MAZO) * (step === 'draw' ? progress : 1)
}

/** Lo que hay que hacer en cada tramo, dicho con palabras. */
const FRASES: Record<TutorialStepKey, string> = {
  hand: 'Bring your hand to the mallet and squeeze the side trigger',
  draw: 'Held, it goes wherever your hand goes',
  release: 'Let go of the trigger and the mallet stays where it is',
}

/** Alto de la banda de texto, encima del dibujo. */
const TEXT_HEIGHT = 0.2

export function XRTutorial() {
  const { gameState } = useGame()
  const enSesion = useXR((state) => state.mode != null)

  // Se decide una sola vez al montar: leerlo en cada render lo apagaría a mitad, en cuanto
  // se marca como visto.
  const [pendiente] = useState(() => !tutorialSeen())
  const empezado = useRef<number | null>(null)
  const mano = useRef<Group>(null)
  const mazo = useRef<Mesh>(null)
  const marca = useRef<Mesh>(null)

  const [frame, setFrame] = useState(() => tutorialFrameAt(0))

  // La cuenta atrás dura tres segundos y la demostración seis y pico: atarla solo a
  // `countdown` la cortaba justo antes de enseñar lo que pasa al soltar, que es la mitad
  // de la explicación. Se mantiene durante los primeros golpes y se va sola.
  const empezada = gameState === 'countdown' || gameState === 'playing'
  const activo = enSesion && pendiente && empezada && !frame.done

  useFrame(({ clock }) => {
    if (!activo) return
    empezado.current ??= clock.elapsedTime
    const siguiente = tutorialFrameAt(clock.elapsedTime - empezado.current)
    // Solo cuando cambia el tramo: el dibujo se mueve por referencia, sin repintar.
    if (siguiente.step !== frame.step || siguiente.done !== frame.done) setFrame(siguiente)
    if (siguiente.done) markTutorialSeen()

    const step = siguiente.step
    if (step === null) return

    const x = manoX(step, siguiente.stepProgress)
    if (mano.current !== null) mano.current.position.x = x
    // El mazo va con la mano solo mientras está cogido. Antes espera, y al soltar se queda
    // donde lo dejó: exactamente lo que hace `siguienteAgarre`.
    if (mazo.current !== null && step === 'draw') mazo.current.position.x = x
    if (marca.current !== null) marca.current.visible = step === 'draw'
  })

  // La frase del tramo, en un lienzo aparte: el resto del tutorial es geometría y ahí no
  // cabe una letra. Sin ella, el dibujo enseña un gesto y nadie sabe de qué gesto habla.
  const escribir = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const step = frame.step
      if (step == null) return
      drawParagraph(ctx, FRASES[step], 0, 0, {
        size: 0.045,
        color: PALETTE.foreground,
        weight: '600',
        maxWidth: PANEL_WIDTH - 0.08,
      })
    },
    [frame],
  )

  if (!activo) return null

  return (
    <group>
      {/* Lo que hay que hacer, escrito. El dibujo enseña el gesto y la frase lo nombra. */}
      <group position={[0, PANEL_HEIGHT / 2 + TEXT_HEIGHT / 2 + 0.01, 0]}>
        <CanvasPanel
          width={PANEL_WIDTH}
          height={TEXT_HEIGHT}
          draw={escribir}
          fallbackColor={PALETTE.background}
        />
      </group>

      <XRPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} />

      {/* La mesa, de canto: da referencia de por dónde se mueve todo. */}
      <group position={[0, -0.04, 0.001]}>
        <XRPlate width={PANEL_WIDTH - 0.1} height={0.14} color={PALETTE.table} opacity={0.22} />
      </group>

      {/* El mazo: espera en su sitio y se va con la mano cuando la mano llega. */}
      <mesh ref={mazo} position={[MAZO, -0.04, 0.003]}>
        <circleGeometry args={[0.038, 24]} />
        <meshBasicMaterial color={PALETTE.primary} toneMapped={false} />
      </mesh>

      <group ref={mano} position={[DESDE, -0.04, 0.004]}>
        {/* La mano abierta: un anillo, que es lo que se cierra alrededor del mazo. */}
        <mesh>
          <ringGeometry args={[0.042, 0.05, 24]} />
          <meshBasicMaterial color={PALETTE.foreground} toneMapped={false} />
        </mesh>
        {/* El gatillo: encendido mientras se sostiene, apagado al soltar. */}
        <mesh ref={marca} position={[0, -0.075, 0]} visible={false}>
          <circleGeometry args={[0.018, 18]} />
          <meshBasicMaterial color={PALETTE.primaryBright} toneMapped={false} />
        </mesh>
      </group>

      {/* Saltárselo: quien ya sabe cogerlo no tiene por qué esperar. */}
      <XRPressable
        box={SKIP_BOX}
        onSelect={() => {
          markTutorialSeen()
          setFrame(tutorialFrameAt(TUTORIAL_SECONDS))
        }}
      >
        <XRPlate width={0.1} height={0.1} color={PALETTE.rail} opacity={0.8} />
        <XRCloseIcon size={0.04} color={DIM_COLOR} />
      </XRPressable>
    </group>
  )
}
