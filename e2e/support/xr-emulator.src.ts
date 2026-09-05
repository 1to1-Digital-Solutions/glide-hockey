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

  /** Cierra la sesión, como cuando el jugador se quita el visor. */
  async endSession() {
    await device.activeSession?.end()
  },
}

;(window as unknown as { __xrTest: typeof api }).__xrTest = api
