#!/usr/bin/env node
/**
 * Copies the game's static files to wherever whoever mounts it serves them.
 *
 * The WebXR controller profiles do not travel in the code: they are files the
 * browser requests over HTTP on entering the headset. An application that
 * mounts Air Hockey has to serve them from its own site and tell it where with
 * the `assetsBase` option (see `docs/mounting-the-game.md`).
 *
 * Usage, from the project that consumes it:
 *
 *   npx glide-hockey-assets public/juegos/glide-hockey
 *
 * It is idempotent: it is run again after bumping the game's version and leaves
 * the destination with the files of the new version.
 */
import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(packageRoot, 'public')

/**
 * What the game needs. `audio/` is the background music, and
 * `webxr-profiles/` is the button map of each
 * controller: without it, the host that points its store there is left without
 * controllers in the headset (see `scripts/sync-xr-profiles.mjs`). `CREDITS.md`
 * goes with them because their licence requires each copy to carry the notice.
 */
const ASSETS = ['audio', 'webxr-profiles', 'CREDITS.md']

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: glide-hockey-assets <destination directory>')
    process.exit(1)
  }

  // Before touching the destination: a single one missing is noticed in the
  // headset and late —without controllers and without an explanation—, so here
  // it stops instead of leaving the copy half done. It is the net that warns if
  // a directory of `public/` is ever renamed and this list is left behind.
  const missing = ASSETS.filter((asset) => !existsSync(join(source, asset)))
  if (missing.length > 0) {
    console.error(
      `Missing from the Glide Hockey package: ${missing.join(', ')}. ` +
        'Reinstall the version of the game; if it persists, it is a bug of the game.',
    )
    process.exit(1)
  }

  const destination = resolve(process.cwd(), target)
  await mkdir(destination, { recursive: true })

  for (const asset of ASSETS) {
    const to = join(destination, asset)
    // Each one is redone from scratch so that on bumping the version no orphan
    // files of the previous one are left. Only what is going to be copied is
    // deleted: the destination may be a directory shared with other things.
    await rm(to, { recursive: true, force: true })
    await cp(join(source, asset), to, { recursive: true })
  }

  console.log(`Glide Hockey files copied to ${destination}`)
}

await main()
