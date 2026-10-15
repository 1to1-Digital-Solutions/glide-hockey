/**
 * Where the game's static files are: the WebXR controller profiles, which is
 * what the browser requests over HTTP when entering the headset.
 *
 * Mounted on its own website they hang from the root, but inside another
 * application the place is decided by whoever mounts it: the files are copied
 * to its `public/` and the base is passed as an option (see
 * `game/GlideHockey.tsx`). That is why the paths are kept relative and resolved
 * when each resource is requested, not when the module that declares them is
 * imported.
 *
 * It is module state and not a React context because the one requesting the
 * profiles is the WebXR store, which lives outside the tree. In exchange, the
 * base is one per page: mounting two games at once with different bases would
 * not work, which WebXR does not allow either (one session per document).
 */

/** The root of the site: what the game's own website serves. */
const DEFAULT_ASSETS_BASE = '/'

let assetsBase = DEFAULT_ASSETS_BASE

/**
 * Leaves the base ready to concatenate: always with a trailing slash, and the
 * root when none is given. A base without a trailing slash would turn
 * `/juegos/glide-hockey` + `webxr-profiles/…` into `/juegos/glide-hockeywebxr-…`.
 */
function normalizeBase(base: string): string {
  const trimmed = base.trim()
  if (trimmed === '') return DEFAULT_ASSETS_BASE
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

/** Changes where the game's static files hang from. */
export function setAssetsBase(base: string): void {
  assetsBase = normalizeBase(base)
}

/** Public URL of a file of `public/`, given its relative path. */
export function assetUrl(path: string): string {
  return `${assetsBase}${path.replace(/^\/+/, '')}`
}
