/**
 * Dónde están los ficheros estáticos del juego: los perfiles de mando de WebXR,
 * que es lo que el navegador pide por HTTP al entrar en el visor.
 *
 * Montado en su propia web cuelgan de la raíz, pero dentro de otra aplicación
 * el sitio lo decide quien lo monta: los ficheros se copian a su `public/` y la
 * base se pasa como opción (ver `game/AirHockey.tsx`). Por eso las rutas se
 * guardan relativas y se resuelven al pedir cada recurso, no al importar el
 * módulo que las declara.
 *
 * Es estado de módulo y no un contexto de React porque quien pide los perfiles
 * es el store de WebXR, que vive fuera del árbol. A cambio, la base es una por
 * página: montar dos juegos a la vez con bases distintas no funcionaría, cosa
 * que WebXR tampoco permite (una sesión por documento).
 */

/** La raíz del sitio: lo que sirve la propia web del juego. */
const DEFAULT_ASSETS_BASE = '/'

let assetsBase = DEFAULT_ASSETS_BASE

/**
 * Deja la base lista para concatenar: siempre con barra final, y la raíz
 * cuando no se da ninguna. Una base sin barra final convertiría
 * `/juegos/air-hockey` + `webxr-profiles/…` en `/juegos/air-hockeywebxr-…`.
 */
function normalizeBase(base: string): string {
  const trimmed = base.trim()
  if (trimmed === '') return DEFAULT_ASSETS_BASE
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

/** Cambia de dónde cuelgan los ficheros estáticos del juego. */
export function setAssetsBase(base: string): void {
  assetsBase = normalizeBase(base)
}

/** URL pública de un fichero de `public/`, dada su ruta relativa. */
export function assetUrl(path: string): string {
  return `${assetsBase}${path.replace(/^\/+/, '')}`
}
