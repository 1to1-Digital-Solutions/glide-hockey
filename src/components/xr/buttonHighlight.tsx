'use client'

import { useCallback, useState } from 'react'
import { NO_RAYCAST } from '../raycast'

/**
 * Cómo contesta un botón de un panel del visor: apuntado se enciende, pulsado se hunde.
 *
 * **Por qué está en un fichero suyo y es el mismo en los trece.** El realce se escribía a
 * mano en cada panel —el menú, el tutorial— y en todos con el mismo fallo: un plano
 * transparente por delante de la placa **con el `depthWrite` que traen los materiales por
 * defecto**. Un material transparente sí apunta su profundidad salvo que se le diga que no, y
 * eso, en un panel, no es un detalle: es lo que borraba el botón.
 *
 * ## Por qué borraba el botón, que no es lo que parece
 *
 * three pinta lo transparente de lejos a cerca, y para ordenarlo mide la profundidad **del
 * origen de cada objeto**, no de cada píxel. Mientras se mira al centro del panel, el realce
 * —5 mm por delante— sale más cerca que la placa y se pinta después: se mezcla encima y todo
 * está bien. Pero **apuntar un botón es mirarlo**: la cabeza se inclina hacia él, el panel deja
 * de estar de frente y un botón a medio metro del centro pasa a estar *más lejos por el eje de
 * la vista* que el centro de la placa. Entonces el orden se da la vuelta: el realce se pinta
 * **primero**, escribe su profundidad 5 mm por delante, y cuando se pinta la placa —que es el
 * lienzo donde están la cara del botón, su color y su letra— sus píxeles fallan la prueba de
 * profundidad dentro de ese rectángulo y se tiran. Queda un agujero con forma de botón por el
 * que se ve la escena de detrás. Reportado con el visor puesto: «al poner el cursor encima de
 * un botón es como que el botón desaparece, mostrando lo que hay por debajo».
 *
 * Que dependa de hacia dónde se mira es lo que lo hacía parecer caprichoso —«y a veces también
 * al pulsarlo»—: mirando al centro del panel no pasa nunca, y mirando al botón pasa siempre.
 *
 * Por eso aquí van **las dos cosas juntas**, y ninguna sirve sola:
 *
 * - `depthWrite: false`, para que el realce no pueda borrar nada que se pinte después.
 * - `renderOrder`, para que se pinte **siempre** después de la placa. Sin esto, quitar el
 *   `depthWrite` arregla el agujero y deja el otro medio fallo: mirando al botón, la placa se
 *   pinta encima del realce y apuntar deja de notarse.
 */

/** En cuál de los tres estados está un botón. */
export type ButtonState = 'idle' | 'pointed' | 'pressed'

/**
 * El orden en que se pintan las capas de un panel.
 *
 * Un panel es un montón de planos a milímetros unos de otros, y a esa distancia **la
 * ordenación por profundidad no decide nada fiable**: basta inclinar la cabeza para que se
 * invierta (ver arriba). Así que el orden se declara, no se deduce, y las capas de en medio
 * no escriben profundidad.
 */
export const PANEL_ORDER = {
  /** El fondo del panel: la placa sobre la que va todo lo demás. */
  back: -3,
  /** El realce de un botón cuando enmarca por detrás, sin tapar el dibujo. */
  behind: -2,
  /** La placa de cada botón. */
  face: -1,
  /** Y el realce que va por delante de lo pintado, que es lo último del panel. */
  highlight: 10,
} as const

/** Cuánto asoma el realce por delante de la placa del panel. */
export const HIGHLIGHT_Z = 0.004

/**
 * Cuánto crece el realce alrededor del botón apuntado, y cuánto se mete al pulsarlo.
 *
 * Crecer y encogerse es lo que se lee como «se ha hundido» cuando la cara del botón está
 * pintada en el lienzo y no se puede mover: lo que se mueve es la luz que lleva encima.
 */
const HALO = 0.014
const SINK = 0.01

/**
 * El realce de un botón, por delante de la placa.
 *
 * Apuntado se enciende con `glow` y desborda un poco el botón; pulsado se oscurece con `ink`
 * y se mete dentro de él. Los dos colores los pone quien lo monta: este fichero es el mismo en
 * los trece juegos y no sabe de la paleta de ninguno.
 */
export function ButtonHighlight({
  width,
  height,
  state,
  glow,
  ink,
}: {
  width: number
  height: number
  state: ButtonState
  /** Con qué se enciende al apuntarlo. */
  glow: string
  /** Y con qué se oscurece al pulsarlo. */
  ink: string
}) {
  if (state === 'idle') return null

  const pointed = state === 'pointed'
  const margin = pointed ? HALO : -SINK

  return (
    <mesh
      // Pulsado se acerca a la placa: el realce baja con el botón.
      position={[0, 0, pointed ? HIGHLIGHT_Z : HIGHLIGHT_Z / 2]}
      raycast={NO_RAYCAST}
      renderOrder={PANEL_ORDER.highlight}
    >
      <planeGeometry args={[width + margin, height + margin]} />
      <meshBasicMaterial
        color={pointed ? glow : ink}
        transparent
        opacity={pointed ? 0.28 : 0.45}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * En qué estado está cada botón del panel y qué hay que escucharle para saberlo.
 *
 * Apuntar y pulsar se llevan juntos porque se pisan: el rayo se sale del botón entre que se
 * aprieta el gatillo y se suelta, y sin soltar el apuntado **el botón se quedaría hundido para
 * siempre**. Salirse del botón limpia los dos.
 */
export function useButtonFeedback() {
  const [pointed, setPointed] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  const forget = useCallback((id: string) => {
    const soloOtro = (current: string | null) => (current === id ? null : current)
    setPointed(soloOtro)
    setPressed(soloOtro)
  }, [])

  const handlersFor = useCallback(
    (id: string) => ({
      onPointerOver: () => setPointed(id),
      onPointerOut: () => forget(id),
      onPointerDown: () => setPressed(id),
      onPointerUp: () => setPressed((current) => (current === id ? null : current)),
    }),
    [forget],
  )

  const stateOf = useCallback(
    (id: string): ButtonState =>
      pressed === id ? 'pressed' : pointed === id ? 'pointed' : 'idle',
    [pointed, pressed],
  )

  return { stateOf, handlersFor }
}
