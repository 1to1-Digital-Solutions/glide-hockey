/**
 * Copies the WebXR controller profiles to `public/webxr-profiles/`.
 *
 * **Why it is needed.** @react-three/xr needs the controller's profile to know
 * which button is which, and by default it downloads it from
 * `cdn.jsdelivr.net`. That fetch is blocked by the game's security policy
 * (`connect-src 'self'`, see `next.config.ts`) —and also by a headset with no
 * way out to the internet—. When it fails, the library swallows the error and
 * **never gets to register the controller**: without controller state there is
 * no ray to aim with, so neither does the mallet move nor can the headset's
 * menu be pressed. The game was left unplayable with the headset on without
 * the build saying anything.
 *
 * Of the `profile.json` files **all** are copied: they are small files and the
 * one of the controller whoever plays brings is needed, whichever it is.
 *
 * Of the `.glb` files with the 3D models —the 100-odd MB of the package— only
 * those of `MODELS` are copied. The controller is not drawn while playing (see
 * `xrStore.ts`); the only place where the model is needed is the tutorial,
 * which shows the lit button on the controller one has in the hand
 * (`RealController.tsx`), and there a controller that is not in the list is
 * left with the panel's drawing and nothing breaks.
 *
 * Usage: `npm run sync:xr-profiles`. The result is committed, so this only has
 * to be run when updating `@webxr-input-profiles/assets` — and then it is time
 * to review `public/CREDITS.md`: the profiles are MIT and their licence
 * requires carrying the notice in every copy, so the version and the text go
 * there.
 */
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(
  root,
  'node_modules/@webxr-input-profiles/assets/dist/profiles',
)
const destination = join(root, 'public/webxr-profiles')

const LIST = 'profilesList.json'

/**
 * Which controllers also get their 3D model copied.
 *
 * The two of Quest, which is the arcade's headset: `meta-quest-touch-plus` are
 * those of the Quest 3 and 3S, and `oculus-touch-v3` those of the Quest 2. The
 * four files together —the two hands of each one— are 1.7 MB of the package's 97.
 *
 * Adding a controller is writing its identifier here; removing it, deleting it.
 * Whatever is not here does not fail: the tutorial is left with the drawing.
 */
const MODELS = ['meta-quest-touch-plus', 'oculus-touch-v3']

/** The two hands of each model, exactly as the package's files are named. */
const HANDS = ['left.glb', 'right.glb']


async function main() {
  const list = JSON.parse(await readFile(join(source, LIST), 'utf8'))

  // It is redone from scratch so that on updating the package no orphan
  // profiles of a previous version are left.
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await copyFile(join(source, LIST), join(destination, LIST))

  let copied = 0
  for (const [id, info] of Object.entries(list)) {
    const path = info?.path
    if (typeof path !== 'string') {
      throw new Error(`The profile "${id}" declares no path in ${LIST}`)
    }
    const target = join(destination, path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(source, path), target)
    copied++
  }

  let models = 0
  for (const id of MODELS) {
    for (const hand of HANDS) {
      // A misspelt identifier here would go unnoticed —the tutorial would be
      // left without a model and without saying why—, so it fails on copying.
      await copyFile(join(source, id, hand), join(destination, id, hand))
      models++
    }
  }

  console.log(
    `${copied} controller profiles and ${models} models copied to public/webxr-profiles/`,
  )
}

await main()
