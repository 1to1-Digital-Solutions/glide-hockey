'use client'

import { useCallback, useEffect, useRef } from 'react'
import { HitFeedback, type HitFeedbackHandle } from '../xr/HitFeedback'
import { useConfort } from '../../lib/confort'
import { XRUiHeight } from '../xr/XRUiHeight'
import { useXR } from '@react-three/xr'
import { MARCADOR_DEL_FONDO, SONIDO_DEL_LISTON, sitioDelTutorial } from '../../lib/cartelDelMarcador'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { countMount } from '../../lib/mountCount'
import { finalSuenaAGanar } from '../../lib/duel'
import { useGame } from '../../lib/gameStore'
import { thresholdCrossed, type Medal } from '../../lib/goal'
import { showsPlace } from '../../lib/settings'
import {
  EYE_HEIGHTS,
  distanceFromEyes,
  eyesAt,
  panelRotation,
  type PanelPose,
  type Point,
} from '../../lib/panelReading'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'
import { useGameAudio } from '../../lib/useGameAudio'
import { useGameMusic } from '../../lib/useGameMusic'
import { useGameHaptics } from '../../lib/useGameHaptics'
import { useRoomEnvironment } from '../../lib/useRoomEnvironment'
import { sitioDelMenu } from '../../lib/xrMenuLayout'
import {
  XRCountdown,
  XRGameOver,
  XRQuitButton,
  XRQuitConfirm,
  XRScoreboard,
} from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRTutorial } from '../xr/XRTutorial'
import { XRSessionController } from '../xr/XRSessionController'
import { Ayudas } from './Ayudas'
import { CartelDelMarcador } from './CartelDelMarcador'
import { PrewarmShaders } from './PrewarmShaders'
import { Rink } from './Rink'
import { Backdrop } from './Backdrop'
import { ROOM_BACKDROP, Room } from './Room'
import { Table } from './Table'
import type { HostAnchor } from '../../lib/hostAnchor'
import { WorldAnchor } from './WorldAnchor'
import { XRWorldHeight } from '../xr/XRWorldHeight'

/**
 * El juego entero como OBJETOS DE THREE, sin Canvas y sin sesión propia.
 *
 * Es lo que se monta dentro del Canvas de quien lo hospeda —su propia web o el
 * salón de xrcade— y por eso aquí no hay `<Canvas>`, ni `<XR>`, ni
 * `<XROrigin>`: WebXR da una sesión por documento y esa sesión va atada al
 * Canvas que la abrió, así que quien es dueño del Canvas es dueño de la sesión.
 * Si la abriera el juego, volver al salón la cerraría, y volver a un salón que
 * es una página 2D significa quitarse el visor.
 *
 * Nada de DOM puede entrar aquí: dentro de un Canvas solo caben objetos de
 * three. El menú y el marcador en 2D se quedan en la web del juego; dentro del
 * visor sus equivalentes son `<XRMenu>` y `<XRScoreboard>`, que sí son
 * geometría, y cuelgan de la mesa para que estén donde se está mirando.
 *
 * **El jugador no se mueve del sitio donde lo puso su anfitrión.** Lo que se
 * mueve es la mesa, y una sola vez por sesión (ver `WorldAnchor`).
 */

/**
 * La columna del menú y de los ajustes, **lejos y a la izquierda** (regla común del salón,
 * `.claude/rules/xr.md`, «La columna va lejos y a la izquierda, fuera de donde se juega»): a 1,5 m
 * de los ojos, 55° a la izquierda, con su centro a la altura de los ojos y de cara a quien juega.
 *
 * **Estaba a un metro y a 42° a la derecha, y el botón que la abre a 57° a la izquierda.** Visto
 * con el visor el 24/09: se pulsaba a un lado y se abría al otro, y los dos quedaban tan cerca que
 * estorbaban jugando. Ahora van juntos y del mismo lado, fuera del alcance del mazo: el borde de
 * la mesa está a 55 cm del centro y la columna empieza a casi un metro.
 *
 * A CALIBRAR CON EL VISOR: `distancia` y `azimut`.
 */
export const COLUMNA = { distancia: 1.5, azimut: 55 } as const

/**
 * Lo que crece la columna para que su letra se siga leyendo a la distancia nueva.
 *
 * Se escala el grupo entero —letra, botones y zonas sensibles— y no se retoca cada cota: el
 * panel ocupa en el ojo casi lo mismo que ocupaba a 1,05 m. Lo más justo es «The room» con los ojos
 * a 1,2 m: con 1,3 se queda en 1,39° (el mínimo es 1,4°), con 1,35 pasa raspando; 1,4 deja algo
 * de margen. Lo miden `menu.legible.test.ts` y `salida.legible.test.ts` con los textos a esta
 * escala. A CALIBRAR CON EL VISOR.
 */
export const ESCALA_DE_LA_COLUMNA = 1.4

const AZIMUT_DE_LA_COLUMNA = (COLUMNA.azimut * Math.PI) / 180

/** Dónde va cada pieza de la interfaz inmersiva, en coordenadas de la mesa. */
export const XR_UI = {
  /** Marcador: al fondo, sobre la portería de la máquina. */
  scoreboard: MARCADOR_DEL_FONDO.centro,
  /**
   * Menú, final de partida y aviso de salir: la columna (`COLUMNA`). Las cotas son las del
   * espacio de quien juega pasadas a las de la mesa, que es de donde cuelga.
   */
  panel: [
    -COLUMNA.distancia * Math.sin(AZIMUT_DE_LA_COLUMNA),
    REFERENCE_EYE_HEIGHT - TABLE_HEIGHT,
    -COLUMNA.distancia * Math.cos(AZIMUT_DE_LA_COLUMNA) - TABLE_CENTER_Z,
  ] as [number, number, number],
  /**
   * El menú, **casi de frente** y a la distancia de la columna (`sitioDelMenu`, la plantilla común
   * del salón: nace a 30° o menos de la mirada). Al empezar se aparta: el final y el aviso de
   * salir salen en la columna.
   */
  menu: sitioDelMenu(),
  /** Cuenta atrás: flotando sobre el punto de saque. */
  countdown: [0, 0.34, 0] as [number, number, number],
  /**
   * La demostración de cómo se coge el mazo: a la altura de la vista y a un lado, a la derecha
   * del cartel del objetivo, para no tapar ni el cartel ni el marcador (`sitioDelTutorial`).
   *
   * A 1,2 m: a metro y medio su contador se quedaba en 1°. No tapa la mesa, ni el marcador, ni
   * el cartel (`tutorial.legible.test.ts`).
   */
  tutorial: sitioDelTutorial(),
}

/**
 * El botón que abre la columna: **en el sitio de la columna**, girado y escalado como ella.
 *
 * Se pulsa y la columna se abre justo donde estaba el botón —mientras está abierta el botón se
 * esconde, que si no se pisarían—. Antes iba a 57° a la izquierda, a 0,9 m, casi a la altura del
 * pecho y sin girar hacia el jugador, con el menú abriéndose a la derecha.
 */
export const XR_QUIT = XR_UI.panel

/**
 * Y lo que crece el botón: más que la columna, porque es una pieza de once centímetros que se
 * tiene que ver de reojo a metro y medio —a la escala de la columna ocupaba 6° y se perdía contra
 * las máquinas de la sala—. Así ocupa unos 11°. A CALIBRAR CON EL VISOR.
 */
export const ESCALA_DEL_BOTON = 2.6

/**
 * Dónde queda una pieza de la interfaz en el espacio de quien juega —los pies en el origen y el
 * `−Z` delante—: la mesa se planta a `TABLE_CENTER_Z` de él y a `TABLE_HEIGHT` del suelo.
 */
export function delEspacioDelJugador(pieza: readonly [number, number, number]): [number, number, number] {
  return [pieza[0], pieza[1] + TABLE_HEIGHT, pieza[2] + TABLE_CENTER_Z]
}

/** A cuántos metros de los ojos de quien juega queda el centro de una pieza, contando la altura. */
export function distanciaDelJugador(pieza: readonly [number, number, number]): number {
  return distanceFromEyes(delEspacioDelJugador(pieza), eyesAt(REFERENCE_EYE_HEIGHT))
}

/**
 * El giro de los paneles con letras: de cara a los ojos de quien juega e inclinados hacia ellos.
 *
 * Inclinados a ojo, la fila más lejana se lee escorzada. La interfaz sube y baja con los ojos
 * (`XRUiHeight`), así que el giro se calcula una vez para los de referencia.
 */
export const XR_UI_ROTATION = {
  panel: panelRotation(delEspacioDelJugador(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)),
  menu: panelRotation(delEspacioDelJugador(XR_UI.menu), eyesAt(REFERENCE_EYE_HEIGHT)),
  quit: panelRotation(delEspacioDelJugador(XR_QUIT), eyesAt(REFERENCE_EYE_HEIGHT)),
  tutorial: panelRotation(delEspacioDelJugador(XR_UI.tutorial), eyesAt(REFERENCE_EYE_HEIGHT)),
}

/**
 * Desde dónde se lee un panel: con los ojos a cada altura de `EYE_HEIGHTS` y con la altura de
 * juego del salón de pie o a la de los ojos.
 *
 * El panel se mide donde queda de verdad: sube lo que baja o sube el mundo (`XRWorldHeight`) más
 * lo que sube la interfaz sobre él (`XRUiHeight`). Es lo que usan los `*.legible.test.ts`.
 */
export function vistasDelPanel(
  pieza: readonly [number, number, number],
  rotation: PanelPose['rotation'],
): { donde: string; pose: PanelPose; ojos: Point }[] {
  const [x, y, z] = delEspacioDelJugador(pieza)
  return EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAlturaDeLosOjos) => ({
      donde: `ojos a ${ojos} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
      pose: {
        position: [x, y + worldRise(ojos, aLaAlturaDeLosOjos) + uiRiseOverWorld(ojos, aLaAlturaDeLosOjos), z] as const,
        rotation,
      },
      ojos: eyesAt(ojos),
    })),
  )
}

/**
 * Unos textos apuntados en el lienzo de la columna, llevados a la escala a la que se pinta
 * (`ESCALA_DE_LA_COLUMNA`): es lo que miden los `*.legible.test.ts` de lo que va en ella.
 */
export function aLaEscalaDeLaColumna<T extends { x: number; y: number; width: number; height: number }>(
  escritos: readonly T[],
): T[] {
  const k = ESCALA_DE_LA_COLUMNA
  return escritos.map((e) => ({ ...e, x: e.x * k, y: e.y * k, width: e.width * k, height: e.height * k }))
}

export interface GameWorldProps {
  /**
   * Quien monta la escena pone además interfaz en DOM alrededor. Entonces los
   * paneles de dentro de la escena solo hacen falta con el visor puesto: sus
   * botones cazarían los clics del ratón por delante de la mesa, porque los
   * punteros miran si hay manejadores y no si se ve algo.
   *
   * Montado en el salón de xrcade no hay nada de eso —el hub no pone DOM—, así
   * que los paneles van siempre. Sin esto, el juego se veía en el hub y no
   * había forma de empezar la partida.
   */
  hasDomUi?: boolean
  /**
   * Dónde y con qué rumbo plantar el mundo, si quien monta la escena lo sabe: el
   * salón de xrcade presta el anclaje con el que tiene plantado su arco de cabinas.
   * Sin él, el mundo se planta delante de donde se mire al entrar.
   */
  anchor?: HostAnchor
}

export function GameWorld({ hasDomUi = false, anchor }: GameWorldProps) {
  // Cuántas veces se monta el mundo, cuando alguien lo está contando (`lib/montajes.ts`).
  // Montarlo dos veces al entrar en la sesión **es** el parpadeo que se reporta del visor.
  useEffect(() => {
    countMount('mundo')
  }, [])

  const {
    gameState,
    runId,
    scenery,
    isRecord,
    totalPlayerGoals,
    totalOpponentGoals,
    duel,
    medalla,
  } = useGame()
  const duelAcabado = duel?.over ?? false
  const mode = useXR((state) => state.mode)

  // El sonido cuelga de la escena y no de la mesa: la mesa se estrena en cada
  // partida y en cada ronda del reto, y con el audio dentro, la ronda ganada se
  // llevaba por delante el gol que la ganaba —el contexto se cerraba mientras
  // sonaba— y estrenaba otro contexto por ronda (ver `lib/useGameAudio.ts`).
  const { play, slide, filtrar } = useGameAudio()
  useGameMusic()
  const haptics = useGameHaptics()
  // El golpe recibido: la mesa lo dispara con el gol en contra (`Rink`) y lo pinta este.
  const golpeRecibido = useRef<HitFeedbackHandle>(null)
  const [confort] = useConfort()
  // Lo que se oye y lo que se siente van por separado: suena todo lo que pasa en la mesa —el
  // roce, la banda, el golpe de la máquina—, pero en la mano solo lo que toca la mano: el golpe
  // del mazo al disco (y el gol, suave). El roce vibraba cada fotograma y en las dos manos, y con
  // el visor puesto los mandos zumbaban la jugada entera (ver `lib/haptics.ts`).
  // El final del partido. Antes era silencio: se metía el último gol, sonaba como cualquier
  // otro y la pantalla de fin llegaba sin avisar. Con el visor puesto es peor todavía,
  // porque el marcador está donde uno no siempre está mirando. La marca batida va **encima**
  // del cierre y no en su lugar: se puede batir ganando o perdiendo, y hay que oír las dos.
  // En la mano, solo el cierre: un segundo pulso detrás cortaría el primero.
  const terminado = useRef(false)
  useEffect(() => {
    if (gameState !== 'finished') {
      terminado.current = false
      return
    }
    if (terminado.current) return
    terminado.current = true
    // El final del duelo suena a ganar: lo gana uno de los dos que están delante (`duel.ts`).
    const gana = finalSuenaAGanar(duelAcabado, { scored: totalPlayerGoals, conceded: totalOpponentGoals })
    play(gana ? 'win' : 'loss')
    haptics.sentir({ tipo: 'end' })
    if (isRecord) play('record')
  }, [gameState, play, haptics, isRecord, totalPlayerGoals, totalOpponentGoals, duelAcabado])

  // El listón de medalla que se acaba de cruzar: el sonido corto de la celebración del cartel.
  // Sale de la misma medalla que el cartel mira, así que suena cuando él cambia de color, y aquí
  // y no en el cartel porque también lo oye quien juega sin visor, que no lo tiene colgado.
  const medallaDeAntes = useRef(medalla)
  useEffect(() => {
    const cruzado = thresholdCrossed(medallaDeAntes.current, medalla)
    medallaDeAntes.current = medalla
    if (cruzado != null) play(SONIDO_DEL_LISTON[cruzado])
  }, [medalla, play])
  // Y en la mano del mazo, cuando el cartel lo celebra.
  const sentirElListon = useCallback((cruzado: Medal) => haptics.sentir({ tipo: 'liston', medalla: cruzado }), [haptics])

  // Los reflejos de la mesa y del disco, calculados una vez (ver el hook).
  const environment = useRoomEnvironment()
  // Qué se pinta alrededor lo dice el escenario del arcade (`xrcade:scenery`) y
  // no el tipo de sesión: el salón entra siempre en realidad aumentada si el
  // visor la tiene, así que el tipo no dice qué se eligió. El modo solo hace de
  // guarda —fuera de `immersive-ar` no hay habitación que enseñar y la sala se
  // pinta igual— y cambiarlo se ve en el fotograma siguiente, sin salirse.
  const passthrough = !showsPlace(mode, scenery)
  const immersive = mode != null
  /** Si toca dibujar los paneles de dentro de la escena. */
  const showPanels = !hasDomUi || immersive

  // TODO EL MUNDO cuelga de `XRWorldHeight`, que lo baja hasta quien juega si
  // lo ha pedido en los ajustes del arcade. Envuelve la escena entera, luces
  // incluidas: mover solo el objetivo lo dejaría flotando sobre su decorado.
  return (
    <XRWorldHeight>
      {/* Arranca y cierra partidas según el estado de la sesión inmersiva. */}
      <XRSessionController />

      {/* Luz de sala: una cenital que hace de foco sobre la mesa y un relleno
          que evita que las sombras salgan negras. */}
      <hemisphereLight args={['#cfe4ff', '#0a1220', 1.1]} />
      <directionalLight
        position={[1.6, 4, 1.2]}
        intensity={2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={14}
      />

      <WorldAnchor anchor={anchor}>
        {/* El sitio, y **el fondo del sitio**. El color va aquí y no en el
            `<Canvas>` por dos razones: en passthrough no puede haber ninguno —un
            fondo opaco tapa la habitación de verdad— y montado en el salón el
            hub retira el suyo al entrar en la cabina, así que si el juego no
            trae el fondo, no lo trae nadie. Sin él, mirar por encima de las
            paredes enseña el negro del compositor. */}
        {/* El fondo sí se monta y se desmonta: es el color con el que se limpia la imagen, no
            un material, y no compila nada. */}
        {!passthrough ? <Backdrop color={ROOM_BACKDROP} /> : null}
        {/* La sala se **oculta** en tu habitación, no se desmonta. Desmontarla libera sus
            materiales, y los shaders que solo usaba ella se vuelven a compilar al volver: un
            tirón a cada cambio de escenario, con el visor puesto. Oculta no se pinta ni da
            sombra, y se le niegan los punteros, que no miran si algo se ve. */}
        {/* La sala es el decorado que se sacude con el golpe recibido: la mesa no, que el mazo
            va en la mano y se despegaría de ella. La cámara no se toca nunca. El movimiento
            reducido lo mira el propio componente: el salón no lo manda (`lib/ajustes.ts`). */}
        <HitFeedback
          ref={golpeRecibido}
          comfort={confort}
          applyFilter={filtrar}
          vibrate={haptics.pulsar}
        >
          <group visible={!passthrough} pointerEvents={passthrough ? 'none' : undefined}>
            <Room />
          </group>
        </HitFeedback>

        {/* Lo que enseña a jugar sin una sola letra: las huellas del suelo, el mazo
            fantasma, la portería marcada y el mando con su botón encendido. Va **fuera** del
            grupo de la mesa porque la mitad de lo que pinta está en el suelo, y se monta
            siempre —también en el menú— porque montar una malla a mitad de partida compila su
            material y eso es un tirón con el visor puesto. Lo que se enciende y se apaga es su
            opacidad; el guion decide cuándo (`lib/guionDeAyudas.ts`). */}
        <Ayudas />

        <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
          <Table environment={environment} />
          {/* El disco y los mazos solo durante la partida: en el menú la mesa
              se ve vacía, que es lo que hace que empezar se note. `key` la
              estrena en cada partida y en cada ronda del reto. */}
          {gameState !== 'menu' ? (
            <Rink
              key={runId}
              play={play}
              slide={slide}
              sentir={haptics.sentir}
              onHand={haptics.noteHand}
              environment={environment}
              golpeRecibido={golpeRecibido}
            />
          ) : null}

          {/* La interfaz de dentro de la escena no se monta cuando el anfitrión
              pone la suya en DOM y no hay visor. No es solo que sobre: los
              punteros miran si hay manejadores y no si se ve algo, así que sus
              botones cazarían clics del ratón por delante de la mesa. Montado
              en el salón —que no pone DOM— va siempre, o el juego se queda sin
              forma de empezar la partida. */}
          {/* A la altura de los ojos de quien juega: las cotas se midieron con una
              persona delante y esa persona se quedó dentro del código (ver `XRUiHeight`). */}
          {showPanels ? (
            <XRUiHeight>
              <group position={XR_UI.scoreboard} rotation={[MARCADOR_DEL_FONDO.inclinacion, 0, 0]}>
                <XRScoreboard />
              </group>
              {/* Qué hay que superar, de frente: encima del marcador, que es donde ya se mira. */}
              <CartelDelMarcador alCelebrar={sentirElListon} />
              {/* El menú nace casi de frente, a la escala de la columna; lo demás, en la columna. */}
              <group position={XR_UI.menu} rotation={XR_UI_ROTATION.menu} scale={ESCALA_DE_LA_COLUMNA}>
                <XRMenu />
              </group>
              <group position={XR_UI.panel} rotation={XR_UI_ROTATION.panel} scale={ESCALA_DE_LA_COLUMNA}>
                <XRGameOver />
                <XRQuitConfirm />
              </group>
              <group position={XR_UI.countdown}>
                <XRCountdown />
              </group>
              {/* La demostración va **donde estaba el menú**: quien la ve acaba de pulsar «empezar» y
                  está mirando ahí. Se le pasa el sitio en vez de dejar que se coloque sola —el valor
                  con el que nació es el de darts, y sumado a este grupo la dejaba a tres metros del
                  suelo, girada, metro y medio por encima del menú del que venía—. */}
              <XRTutorial position={XR_UI.tutorial} rotation={XR_UI_ROTATION.tutorial} />
              <group position={XR_QUIT} rotation={XR_UI_ROTATION.quit} scale={ESCALA_DEL_BOTON}>
                <XRQuitButton />
              </group>
            </XRUiHeight>
          ) : null}
        </group>
      </WorldAnchor>
      {/* Calienta los shaders de la escena, y va AQUÍ y no en el Canvas de la web del
          juego: el salón monta esto y no aquello, así que colgado de allí no se
          precalentaba nada justo donde se juega de verdad. */}
      <PrewarmShaders />
    </XRWorldHeight>
  )
}
