/**
 * Emulador de WebXR para los tests, inyectado en la página antes de que cargue.
 *
 * Chromium trae un `navigator.xr` que no tiene ningún visor detrás, así que sin
 * esto el modo inmersivo no se ejecuta nunca: los demás tests entran por el
 * ratón, que es código distinto. IWER (Immersive Web Emulation Runtime, de
 * Meta) pone en su lugar un runtime completo con un Quest 3 y sus dos mandos.
 * Llega dentro de `@react-three/xr`, así que no añade ninguna dependencia.
 *
 * Este fichero se empaqueta a un IIFE en `globalSetup` y se carga con
 * `page.addInitScript`. Es código de test: no entra en el bundle del juego.
 */
import { XRDevice, metaQuest3 } from 'iwer'
import { Euler, Quaternion } from 'three'

const device = new XRDevice(metaQuest3)
// `forceInstall` porque Chromium ya trae un `navigator.xr` propio —sin ningún
// visor detrás— y sin esto IWER se aparta y deja el suyo: el menú preguntaría
// por el visor, le dirían que no hay, y no habría por dónde entrar.
device.installRuntime({ forceInstall: true })

const api = {
  /** ¿Hay una sesión inmersiva en curso? */
  hasSession: () => device.activeSession != null,

  /**
   * Enciende los dos mandos y los pone donde estarían las manos.
   *
   * Es lo que hace que `@pmndrs/xr` los registre, y de ese registro sale el
   * `gripSpace` del que cuelga la pistola. El registro necesita el perfil del
   * mando, que el juego sirve desde `public/webxr-profiles/` (ver
   * `xr/xrStore.ts`): sin encender los mandos, ese camino no se recorre.
   */
  connectControllers() {
    const { left, right } = device.controllers
    if (left) {
      left.connected = true
      left.position.set(-0.25, 1.1, -0.35)
    }
    if (right) {
      right.connected = true
      right.position.set(0.25, 1.1, -0.35)
    }
  },

  /**
   * Pone un mando donde se le diga, en metros y en coordenadas del mundo.
   *
   * Es lo que hace falta para probar lo que se coge llevando la mano: sin poder mover el
   * mando, el único camino que se ejercita es el del ratón, que es código distinto.
   */
  placeController(handedness: 'left' | 'right', x: number, y: number, z: number) {
    device.controllers[handedness]?.position.set(x, y, z)
  },

  /** Aprieta o suelta el gatillo lateral, que es con lo que se agarra. */
  squeeze(handedness: 'left' | 'right', pressed: boolean) {
    // El emulador nombra sus botones como su propio mapa (`squeeze`), no como los llama
    // el perfil estándar de WebXR (`xr-standard-squeeze`), que es como los lee el juego.
    device.controllers[handedness]?.setButtonValueImmediate('squeeze', pressed ? 1 : 0)
  },

  /**
   * Cambia a manos desnudas: apaga los mandos y enciende las manos.
   *
   * Es el otro modo de entrada del visor, y el que deja fuera a quien no tiene mandos a
   * mano o no puede sostenerlos. IWER las trae con sus articulaciones, así que lo que se
   * prueba con esto es exactamente lo que hace el juego con una mano de verdad.
   */
  useHands(): void {
    for (const mando of [device.controllers.left, device.controllers.right]) {
      if (mando) mando.connected = false
    }
    device.primaryInputMode = 'hand'
    const { left, right } = device.hands
    if (left) {
      left.connected = true
      left.position.set(-0.25, 1.1, -0.5)
    }
    if (right) {
      right.connected = true
      right.position.set(0.25, 1.1, -0.5)
    }
  },

  /** Lleva una mano a ese punto del espacio del visor. */
  placeHand(handedness: 'left' | 'right', x: number, y: number, z: number): void {
    device.hands[handedness]?.position.set(x, y, z)
  },

  /** Junta o separa el pulgar y el índice: es el «agarrar» de una mano desnuda. */
  pinch(handedness: 'left' | 'right', pressed: boolean): void {
    const mano = device.hands[handedness]
    if (mano == null) return
    mano.poseId = pressed ? 'pinch' : 'default'
    mano.updateHandPose()
    mano.updatePinchValue(pressed ? 1 : 0)
  },

  /**
   * Gira la cabeza: `yaw` a los lados y `pitch` arriba y abajo, en grados.
   *
   * El emulador entra siempre mirando al frente, y las ayudas visuales están donde se mira
   * después: **las huellas, a los pies**. Sin esto, una captura de las ayudas sale enseñando
   * la pared del fondo, y **las dos medidas de una comparación tienen que tomarse mirando al
   * mismo sitio** — si no, lo que se compara son dos vistas y no dos escenas.
   */
  lookAt(yaw = 0, pitch = 0): void {
    const giro = new Quaternion().setFromEuler(
      new Euler((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0, 'YXZ'),
    )
    device.quaternion.set(giro.x, giro.y, giro.z, giro.w)
  },

  /** Cierra la sesión, como cuando el jugador se quita el visor. */
  async endSession() {
    await device.activeSession?.end()
  },
}

;(window as unknown as { __xrTest: typeof api }).__xrTest = api
