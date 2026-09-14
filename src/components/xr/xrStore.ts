'use client'

import { createXRStore } from '@react-three/xr'
import { XRControllerGrip } from './XRControllerGrip'
import { assetUrl } from '../../lib/assets'

/** Dónde viven los perfiles de mando, servidos junto al resto de ficheros. */
const XR_PROFILES_PATH = 'webxr-profiles/'

/**
 * Ruta absoluta a los perfiles.
 *
 * @react-three/xr las resuelve con `new URL(path, baseAssetPath)`, que exige una
 * base absoluta: una ruta como `/webxr-profiles/` lanza. En el servidor no hay
 * `window`, pero tampoco hay sesión inmersiva, así que ese valor no llega a
 * usarse nunca.
 */
function profilesBasePath(): string {
  const path = assetUrl(XR_PROFILES_PATH)
  if (typeof window === 'undefined') {
    return new URL(path, 'http://localhost').href
  }
  return new URL(path, window.location.origin).href
}

/**
 * Store de WebXR compartido entre el botón de entrar (DOM) y el componente
 * `<XR>` dentro del Canvas. Se crea una sola vez, la primera vez que alguno lo
 * pide, para que los dos lados apunten a la misma sesión.
 *
 * **Solo lo usa la web del juego.** Montado dentro del salón de xrcade la
 * sesión es del anfitrión y este módulo no se toca: quien es dueño del Canvas
 * es dueño de la sesión (ver `docs/xrcade.md`).
 *
 * Se crea al pedirlo y no al importar el módulo porque su `baseAssetPath`
 * depende de dónde estén los ficheros del juego, y eso lo decide quien lo monta
 * (ver `lib/assets.ts`).
 *
 * Dos decisiones que vienen de la política de seguridad del salón:
 *
 * - **Los perfiles de mando se sirven desde la propia web** (`baseAssetPath`).
 *   Por defecto se descargan de `cdn.jsdelivr.net`; la política lo bloquea —y
 *   un visor sin salida a internet, también—, y al fallar la promesa la
 *   librería se traga el error y **nunca registra el mando**: ni rayo, ni forma
 *   de mover el mazo. Los ficheros se copian con `npm run sync:xr-profiles`.
 * - **Sin modelo de mando** (`model: false`). Apaga solo el modelo: el perfil
 *   se descarga igual, porque de él sale el mapa de botones. Auto-hospedar esos
 *   modelos costaría los 97 MB del paquete y aquí no aportan nada: el mazo va
 *   sobre la mesa, no en la mano.
 * - **Salvo en el tutorial**, que sí lo enseña: a tamaño real, encima del mando
 *   que se tiene en la mano y con el botón que toca encendido
 *   (`xr/MandoDeVerdad.tsx`). De los 97 MB del paquete se copian los dos mandos
 *   de Quest —1,7 MB, `scripts/sync-xr-profiles.mjs`— y solo se piden en ese paso.
 */
let store: ReturnType<typeof createXRStore> | null = null

export function getXrStore(): ReturnType<typeof createXRStore> {
  store ??= createXRStore({
    baseAssetPath: profilesBasePath(),
    // Un mando propio y no las opciones por defecto: con `model: false` la librería no monta
    // `XRControllerModel`, que es **el único que escribe `state.object`**, y sin ese objeto
    // el juego no sabe dónde está la mano — el mazo no se podía agarrar. Ver
    // `XRControllerGrip.tsx`.
    controller: XRControllerGrip,
    hand: {
      model: false,
      rayPointer: {
        rayModel: { maxLength: 6, opacity: 0.35 },
        cursorModel: true,
      },
      grabPointer: false,
      teleportPointer: false,
    },
  })
  return store
}

/**
 * Cierra la sesión inmersiva, si la hay.
 *
 * Hace falta al desmontar el juego. El store vive fuera del árbol de React y
 * `<XR>` no cierra nada al desmontarse: una aplicación que quite el juego con
 * el visor puesto dejaría viva una sesión atada a un Canvas que ya no existe, y
 * el jugador se quedaría mirando una escena congelada sin poder volver ni
 * empezar otra (WebXR da una sesión por documento).
 */
export function endXrSession(): void {
  const session = store?.getState().session
  if (session == null) return
  // Que la llamada falle es un desenlace previsto: la sesión puede estar
  // cerrándose ya porque el jugador haya salido por su cuenta.
  void session.end().catch(() => {})
}
