/**
 * The settings that do **not** belong to one game: language, volumes, scenery, height, grab, turn
 * and hand.
 *
 * **The same file in all seventeen.** Each game reads only what it uses, but the contract is
 * one: `organizate/scripts/repos/comunes.py` requires this copy to be identical in all of them, and
 * `xrcade/src/lib/puente-de-ajustes.test.ts` that it says the same as what the hall writes.
 *
 * **Why they live outside each game.** Whoever walks into the hall, picks Spanish and
 * turns the ambience down does not want to say it again in every cabinet. Each game
 * used to keep its own mute (`stick-rush:muted`) and its own music, so
 * there were twelve places to say the same thing and none of them heard about the others.
 * Now there is only one, and the game mounted in the hall reads it.
 *
 * **How the hub's setting reaches the game.** There is no pipe: the game is mounted
 * *inside* the xrcade page, so they share an origin, and what is stored
 * here is read by the one next door. All that is needed is to tell that it has
 * changed, and that is what the two events further down are for: `storage` covers the
 * other tabs —which the browser notifies on its own— and `SETTINGS_EVENT` covers this very one,
 * where the browser does not notify.
 *
 * **Why the language goes in a cookie and the volume does not.** The language is rendered on the
 * server: if it lived only in `localStorage`, the HTML would arrive in English and the browser
 * would change it on hydration, which is exactly the mismatch React forbids. The cookie travels
 * with the request, so the server already knows which language to render in and the `<html lang>`
 * comes out right the first time. The volumes are not rendered: only the audio uses them, which
 * belongs to the browser, and there `localStorage` is enough and does not fatten every request.
 *
 * **What is here and what is in `settingsClient.ts`.** Here only what also
 * runs on the server: the keys, the starting values and how each thing is
 * read. What needs `window` —the store React subscribes to, and
 * writing— lives in the other one, which is a client module. Splitting it is not a whim: a
 * module marked `'use client'` does not run on the server, and the `layout`
 * needs the language **before** rendering so as not to mismatch the hydration.
 *
 * **It is a deliberate copy.** The same file is in xrcade and in the twelve
 * games, with the same keys and the same starting values: that is what
 * makes picking Spanish in the hall show inside the cabinet. It is duplicated
 * instead of being pulled out into a package because the games are separate repositories that
 * are also deployed on their own, and one more package to version and publish
 * again for every change would cost more than it saves. What cannot
 * happen is for the **keys** to stop matching: that is where the
 * bridge would break, silently.
 *
 * **What this file does NOT decide.** Nothing of what goes inside a run:
 * level, difficulty or mode still belong to each game and are still stored with
 * its prefix. Here there is only what is chosen once and holds for all of them.
 */

/** The languages there are. English is the hall's starting language. */
export const LANGS = ['en', 'es'] as const
export type Lang = (typeof LANGS)[number]

/** What each language is called in its own language, which is how it is chosen. */
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  es: 'Español',
}

/**
 * The two families of sound, separate because they are wanted separately.
 *
 * `sfx` is what answers what you do —the hit, the bounce, the score— and
 * `ambience` is what plays in the background even if you do nothing. Some people play with
 * music on and want only the effects, and some put the game on as ambience and
 * want the opposite.
 */
export const SOUND_CHANNELS = ['sfx', 'ambience'] as const
export type SoundChannel = (typeof SOUND_CHANNELS)[number]

/**
 * Where the language is remembered.
 *
 * Without a colon on purpose: the name of a cookie is an HTTP *token* and
 * the colon is not one, so the hall's prefix goes with an underscore
 * even though the storage keys use `xrcade:`.
 */
export const LANG_COOKIE = 'xrcade_lang'

/**
 * What is seen around you with the headset on: the drawn place or your room.
 *
 * `place` is the opaque stage of whoever renders —the hall's room, the bowling alley, the meadow—
 * and `room` is the real room, through *passthrough*, with only what is needed to play on top of
 * it. They are the same two names each game uses to talk about its stage, on purpose: the value
 * coming from the hall does not change what it means.
 *
 * **It is a setting of what is rendered, not of the session type.** Deciding with it which session
 * is opened has two flaws, and both were seen with the headset on. A WebXR session does not change
 * type, so changing scenery would force closing the session and opening another one: it throws you
 * out of the headset and takes a while to come back. And a game cannot find out by looking at the
 * session type, which does not say what was chosen. So the host enters `immersive-ar` whenever the
 * headset has it, and this setting decides whether the stage is rendered: changing it is instant
 * and anyone who mounts a scene reads it.
 *
 * **And there is only one.** If each game kept its own, the hall would say «realidad virtual» and
 * the cabinet would enter the room because it was once chosen there: two preferences that
 * contradict each other without anyone knowing which one rules.
 */
export const SCENERIES = ['place', 'room'] as const
export type Scenery = (typeof SCENERIES)[number]

/** Where it is remembered. The prefix belongs to the hall, not to a game. */
export const SCENERY_KEY = 'xrcade:scenery'

/** What you come in with: the drawn place, which is what is seen on any screen. */
export const DEFAULT_SCENERY: Scenery = 'place'

/**
 * Parses the scenery read from storage. Like the language: only one that
 * exists counts, and anything else falls back to the starting one.
 */
export function parseScenery(raw: string | null | undefined): Scenery {
  return (SCENERIES as readonly string[]).includes(raw ?? '') ? (raw as Scenery) : DEFAULT_SCENERY
}

/** The chosen scenery, read from a storage that may not be there. */
export function readScenery(storage: Pick<Storage, 'getItem'> | null): Scenery {
  if (storage === null) return DEFAULT_SCENERY
  try {
    return parseScenery(storage.getItem(SCENERY_KEY))
  } catch {
    // Blocked storage: the drawn place is seen, which never leaves anyone staring at nothing.
    return DEFAULT_SCENERY
  }
}

/**
 * Stores the scenery, or forgets it when it is the starting one again.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser does not
 *   store anything and the choice will live as long as the visit lasts.
 */
export function writeScenery(storage: Storage | null, value: Scenery): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_SCENERY) storage.removeItem(SCENERY_KEY)
    else storage.setItem(SCENERY_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Whether whoever renders has to put up its stage: **the rule the hall and the games follow**.
 *
 * It is removed only when the room has been chosen **and** the session is `immersive-ar`. The
 * second condition is not superfluous: in an `immersive-vr` —a headset without passthrough— or
 * outside the headset there is no room behind, and removing the stage would leave the player
 * staring at black without knowing why. The session type does not decide what is seen; it only says
 * whether the room can be shown.
 *
 * @param sessionMode The one from `useXR((state) => state.mode)`.
 */
export function showsPlace(sessionMode: string | null | undefined, scenery: Scenery): boolean {
  return scenery === 'place' || sessionMode !== 'immersive-ar'
}

/** Where each volume is remembered. The prefix belongs to the hall, not to a game. */
export const VOLUME_KEYS: Record<SoundChannel, string> = {
  sfx: 'xrcade:volume:sfx',
  ambience: 'xrcade:volume:ambience',
}

/** What you come in with the first time. */
export const DEFAULT_LANG: Lang = 'en'
export const DEFAULT_VOLUMES: Record<SoundChannel, number> = { sfx: 100, ambience: 60 }

/** The volumes, which is what goes to storage. */
export interface Volumes {
  /** Volume of the effects, from 0 to 100. A 0 is «off». */
  sfx: number
  /** Volume of the background, from 0 to 100. A 0 is «off». */
  ambience: number
}

export const DEFAULT_VOLUME_SETTINGS: Volumes = {
  sfx: DEFAULT_VOLUMES.sfx,
  ambience: DEFAULT_VOLUMES.ambience,
}

/**
 * Parses a language that came from outside.
 *
 * The cookie is external input —anyone can edit it from the
 * browser's tools—, so only a language that exists counts
 * anything else falls back to the starting one instead of leaving the interface
 * untranslated.
 */
export function parseLang(raw: string | null | undefined): Lang {
  return (LANGS as readonly string[]).includes(raw ?? '') ? (raw as Lang) : DEFAULT_LANG
}

/**
 * Parses a volume read from storage.
 *
 * Only an integer from 0 to 100 is valid. A text, a decimal or a number out of
 * range are tampered storage or storage from another version: it falls back to the starting one,
 * which is what the game did before storing anything.
 */
export function parseVolume(raw: string | null, fallback: number): number {
  if (raw === null || !/^\d{1,3}$/.test(raw)) return fallback
  const value = Number(raw)
  return value >= 0 && value <= 100 ? value : fallback
}

/**
 * The language written in a `Cookie` header.
 *
 * It takes the whole text and not the cookie already split so that it works the same on the
 * server —where it arrives like that— and in the browser, where `document.cookie` has
 * that same shape.
 */
export function langFromCookies(cookieHeader: string | null | undefined): Lang {
  return chosenLang(cookieHeader) ?? DEFAULT_LANG
}

/**
 * The language **chosen** in that `Cookie` header, or `null` if none has been chosen (or what is
 * written is not a language of the hall): then the system's one rules (`langFromSystem`).
 */
export function chosenLang(cookieHeader: string | null | undefined): Lang | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === LANG_COOKIE) return asLang(decodeURIComponent(rest.join('=')))
  }
  return null
}

/** What is written, if it is a language of the hall; otherwise, `null`. */
export function asLang(raw: string | null | undefined): Lang | null {
  return (LANGS as readonly string[]).includes(raw ?? '') ? (raw as Lang) : null
}

/**
 * The system's language, for whoever has not chosen one yet: the first of the ones it asks for that
 * the hall has. It is the same calculation as the hall's (`xrcade/src/lib/ajustes.ts`): a game
 * opened on its own, or mounted in a hall where nobody has chosen a language, starts in the
 * headset's one.
 *
 * It accepts the server's `Accept-Language` header («es-ES,es;q=0.9,en;q=0.8», which is sorted by
 * its `q`) or the browser's list (`navigator.languages`, already sorted). Only the language is
 * looked at, not the region: «es-MX» is Spanish. `null` if it asks for none of the hall's.
 */
export function langFromSystem(preferred: string | readonly string[] | null | undefined): Lang | null {
  if (preferred == null) return null
  const tags =
    typeof preferred === 'string'
      ? preferred
          .split(',')
          .map((part, index) => {
            const [tag = '', ...params] = part.trim().split(';')
            const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
            const weight = q === undefined ? 1 : Number(q.slice(2))
            return { tag, weight: Number.isFinite(weight) ? weight : 0, index }
          })
          .filter((entry) => entry.weight > 0)
          .sort((a, b) => b.weight - a.weight || a.index - b.index)
          .map((entry) => entry.tag)
      : preferred
  for (const tag of tags) {
    const primary = tag.trim().toLowerCase().split(/[-_]/, 1).join('')
    if ((LANGS as readonly string[]).includes(primary)) return primary as Lang
  }
  return null
}

/** The language it is rendered in: the one chosen in the cookie, else the system's, else the starting one. */
export function langFor(
  cookieHeader: string | null | undefined,
  preferred: string | readonly string[] | null | undefined,
): Lang {
  return chosenLang(cookieHeader) ?? langFromSystem(preferred) ?? DEFAULT_LANG
}

/** The volumes, read from a storage that may not be there. */
export function readVolumes(storage: Pick<Storage, 'getItem'> | null): Volumes {
  if (storage === null) return DEFAULT_VOLUME_SETTINGS
  try {
    return {
      sfx: parseVolume(storage.getItem(VOLUME_KEYS.sfx), DEFAULT_VOLUMES.sfx),
      ambience: parseVolume(storage.getItem(VOLUME_KEYS.ambience), DEFAULT_VOLUMES.ambience),
    }
  } catch {
    // Blocked storage: you play with the starting values, and that is that.
    return DEFAULT_VOLUME_SETTINGS
  }
}

/**
 * Stores a volume, or forgets it when it is the starting one again.
 *
 * Only what departs from the starting values is written: that way the storage
 * holds something solely when someone has decided something, and deleting it returns the
 * hall to how it came.
 *
 * @returns whether it was stored. A `false` is not an error: it means this
 *   browser does not store anything and the setting will live as long as the visit lasts.
 */
export function writeVolume(storage: Storage | null, channel: SoundChannel, value: number): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_VOLUMES[channel]) storage.removeItem(VOLUME_KEYS[channel])
    else storage.setItem(VOLUME_KEYS[channel], String(value))
    return true
  } catch {
    return false
  }
}

/** From 0-100 to the 0-1 scale the browser's audio works with. */
export function volumeFactor(value: number): number {
  return Math.min(100, Math.max(0, value)) / 100
}

/**
 * At what height you play.
 *
 * **The problem.** The heights of the thirteen games were chosen with a person standing
 * in front: the hoop at 3.05 m, the board at 1.73, the air hockey table at the height of their
 * waist. Standing and being as tall as that person was, it is fine. Seated —on a chair, on a
 * sofa, in a wheelchair— the whole world ends up a hand span above where
 * the arm reaches, and nothing fails: you simply cannot play. Whoever is shorter than the
 * person who was in front gets the same on a small scale, and has no way to level it,
 * unlike the mode, the difficulty or the hand, which are chosen.
 *
 * **What `eyes` does.** It lowers the world to the eyes of whoever wears the headset, which is the
 * same correction already made to the immersive interface so that the menu does not end up out of
 * view. It does not move the player —the origin belongs to whoever mounts the scene, and in the
 * hall there is an arc of cabinets planted there—, it moves the stage: the geometry that is seen is
 * identical and the scores do not change, because the relation between the target and the hand is
 * the same.
 *
 * **Why it belongs to the hall and not to each game.** Whoever sits down sits down for the whole
 * visit. Saying it thirteen times, once per cabinet, would be not being able to say it.
 */
export const PLAY_HEIGHTS = ['standing', 'eyes'] as const
export type PlayHeight = (typeof PLAY_HEIGHTS)[number]

/** Where it is remembered. The prefix belongs to the hall, not to a game. */
export const PLAY_HEIGHT_KEY = 'xrcade:play-height'

/** Standing: the world where it has always been. */
export const DEFAULT_PLAY_HEIGHT: PlayHeight = 'standing'

/**
 * Parses the height read from storage. Like the scenery: only one
 * that exists counts, and anything else falls back to the starting one.
 */
export function parsePlayHeight(raw: string | null | undefined): PlayHeight {
  return (PLAY_HEIGHTS as readonly string[]).includes(raw ?? '')
    ? (raw as PlayHeight)
    : DEFAULT_PLAY_HEIGHT
}

/** The chosen height, read from a storage that may not be there. */
export function readPlayHeight(storage: Pick<Storage, 'getItem'> | null): PlayHeight {
  if (storage === null) return DEFAULT_PLAY_HEIGHT
  try {
    return parsePlayHeight(storage.getItem(PLAY_HEIGHT_KEY))
  } catch {
    // Blocked storage: you play standing, which is how you played before this existed.
    return DEFAULT_PLAY_HEIGHT
  }
}

/**
 * Stores the height, or forgets it when it is the starting one again.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser does not
 *   store anything and the choice will live as long as the visit lasts.
 */
export function writePlayHeight(storage: Storage | null, value: PlayHeight): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_PLAY_HEIGHT) storage.removeItem(PLAY_HEIGHT_KEY)
    else storage.setItem(PLAY_HEIGHT_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * How what you pick up is held.
 *
 * **The problem.** Nine of the thirteen ask you to **keep** the trigger **squeezed** during the
 * whole gesture: the dart, the axe, the ball, the stick, the mallet, the bowstring. A bowling throw
 * is three or four seconds with the hand closed; a whole run is a hundred and some. Whoever has
 * little grip strength —arthritis, tremor, a tired hand— is left out of the game, and not out of a
 * part of it: out of the whole gesture, which is the game.
 *
 * **What `toggle` does.** One tap to pick it up and another to release it. The gesture in between
 * —the arm— is the same, and that is why no score changes: what decides the
 * throw is still the speed of the hand on release.
 *
 * **Why it belongs to the hall and not to each game.** Whoever cannot hold the trigger cannot
 * hold it in any cabinet. And because changing cabinet already forces you to relearn how each
 * thing is picked up: at least let the way of holding it be the same in all of them.
 */
export const GRAB_MODES = ['hold', 'toggle'] as const
export type GrabMode = (typeof GRAB_MODES)[number]

/** Where it is remembered. The prefix belongs to the hall, not to a game. */
export const GRAB_MODE_KEY = 'xrcade:grab'

/** Holding, which is what the tutorials teach and what almost everybody expects. */
export const DEFAULT_GRAB_MODE: GrabMode = 'hold'

/** Parses the grab read from storage: only one that exists counts. */
export function parseGrabMode(raw: string | null | undefined): GrabMode {
  return (GRAB_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as GrabMode)
    : DEFAULT_GRAB_MODE
}

/** The chosen grab, read from a storage that may not be there. */
export function readGrabMode(storage: Pick<Storage, 'getItem'> | null): GrabMode {
  if (storage === null) return DEFAULT_GRAB_MODE
  try {
    return parseGrabMode(storage.getItem(GRAB_MODE_KEY))
  } catch {
    // Blocked storage: you grab by holding, as you always grabbed.
    return DEFAULT_GRAB_MODE
  }
}

/**
 * Stores the grab, or forgets it when it is the starting one again.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser does not
 *   store anything and the choice will live as long as the visit lasts.
 */
export function writeGrabMode(storage: Storage | null, value: GrabMode): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_GRAB_MODE) storage.removeItem(GRAB_MODE_KEY)
    else storage.setItem(GRAB_MODE_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * When the stage can be turned with the stick.
 *
 * **The problem.** The games take for granted that you turn with your body: the skeet clays
 * come out of two houses, the bow's mortars fill the clearing, the cabinets at the ends of the
 * hall are at 75°. Seated —on a fixed chair, on a sofa, in a wheelchair— that means
 * twisting your neck or not reaching.
 *
 * **What each value does.** `auto` turns only when the play height is the seated one (`eyes`):
 * whoever plays standing turns with their body, and a stick that moved the world unintentionally
 * would turn their stomach. `stick` always turns, for whoever plays standing but cannot or does not
 * want to turn. What turns is the stage, never the player; how, in `lib/snapTurn.ts`.
 *
 * **Tolerant of it not being there.** A hall older than this setting does not write it, and
 * anything that is not a known value falls back to `auto`: it is what there was before the option
 * existed, plus the seated turn, which does not bother anyone who is standing.
 */
export const TURN_MODES = ['auto', 'stick'] as const
export type TurnMode = (typeof TURN_MODES)[number]

/** Where it is remembered. The prefix belongs to the hall, not to a game. */
export const TURN_MODE_KEY = 'xrcade:giro'

/** Only seated. */
export const DEFAULT_TURN_MODE: TurnMode = 'auto'

/** Parses the turn read from storage: only one that exists counts. */
export function parseTurnMode(raw: string | null | undefined): TurnMode {
  return (TURN_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as TurnMode)
    : DEFAULT_TURN_MODE
}

/** The chosen turn, read from a storage that may not be there. */
export function readTurnMode(storage: Pick<Storage, 'getItem'> | null): TurnMode {
  if (storage === null) return DEFAULT_TURN_MODE
  try {
    return parseTurnMode(storage.getItem(TURN_MODE_KEY))
  } catch {
    // Blocked storage: it turns only seated, which is what bothers nobody.
    return DEFAULT_TURN_MODE
  }
}

/**
 * Stores the turn, or forgets it when it is the starting one again.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser does not
 *   store anything and the choice will live as long as the visit lasts.
 */
export function writeTurnMode(storage: Storage | null, value: TurnMode): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_TURN_MODE) storage.removeItem(TURN_MODE_KEY)
    else storage.setItem(TURN_MODE_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Which hand you play with: the one that throws, hits and aims.
 *
 * **The problem.** Each game that needed it asked for it in its menu —the paddle at the table, the
 * bat in the cage—, and whoever is left-handed had to say it in every cabinet, between the mode and
 * the difficulty, before being able to play. It is the same answer in all of them: nobody changes
 * dominant hand when changing game.
 *
 * **Why it belongs to the hall and not to each game.** For the same reason as the scenery: it is
 * chosen once and holds for the thirteen, and so each game's menu is left with what is its own. **A
 * single key**: the game that had its own stops reading it and deletes it without migrating it,
 * because two places that say the same thing end up saying different things, and migrating it would
 * overwrite what was chosen here with what was chosen in a single cabinet.
 *
 * The values are the WebXR names (`XRHandedness`) and the ones already used by the games that had
 * the setting: they are passed as they are to `@react-three/xr` to ask it for that hand's
 * controller, and reading this one instead of their own changes where the value comes from, not
 * what it means.
 */
export const HANDS = ['right', 'left'] as const
export type Hand = (typeof HANDS)[number]

/**
 * In what order they are shown when choosing: left on the left, as hands are when seen from the
 * front. A selector with the right one on the left gets pressed the wrong way round by mistake.
 */
export const HAND_ORDER: readonly Hand[] = ['left', 'right']

/** Where it is remembered. The prefix belongs to the hall, not to a game. */
export const HAND_KEY = 'xrcade:hand'

/** The right one, which is most people's and the one the thirteen were built with. */
export const DEFAULT_HAND: Hand = 'right'

/** Parses the hand read from storage: only one that exists counts. */
export function parseHand(raw: string | null | undefined): Hand {
  return (HANDS as readonly string[]).includes(raw ?? '') ? (raw as Hand) : DEFAULT_HAND
}

/** The chosen hand, read from a storage that may not be there. */
export function readHand(storage: Pick<Storage, 'getItem'> | null): Hand {
  if (storage === null) return DEFAULT_HAND
  try {
    return parseHand(storage.getItem(HAND_KEY))
  } catch {
    // Blocked storage: you play with the right one, as you played before this existed.
    return DEFAULT_HAND
  }
}

/**
 * Stores the hand, or forgets it when it is the starting one again.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser does not
 *   store anything and the choice will live as long as the visit lasts.
 */
export function writeHand(storage: Storage | null, value: Hand): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_HAND) storage.removeItem(HAND_KEY)
    else storage.setItem(HAND_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * How much the world is raised or lowered **on top of** the play height, in centimetres.
 *
 * **The problem.** `standing|eyes` is a switch: standing, the world where it was drawn; at eye
 * height, lowered by however much the eyes are below the reference person. In between there is
 * nothing, and an office chair and a sofa do not put the eyes at the same height as the arm, nor
 * does someone 1.50 tall reach the same as someone 1.90 tall. The hall lets you fine-tune it five
 * centimetres at a time and this game only reads it: it is added to whatever the play height
 * already does and raises (positive) or lowers (negative) the whole stage, with the hand where it
 * is.
 *
 * The limit is a long hand span on each side: beyond that it is no longer fine-tuning, it is the
 * other play height, and a world thirty centimetres above the real floor looks like it is floating.
 */
export const PLAY_HEIGHT_OFFSET_KEY = 'xrcade:play-height-offset'

/** The most it is raised or lowered, in centimetres, on each side of zero. */
export const MAX_PLAY_HEIGHT_OFFSET = 30

/** Untouched: the world where the play height puts it, as before this existed. */
export const DEFAULT_PLAY_HEIGHT_OFFSET = 0

/**
 * Parses the offset read from storage.
 *
 * Only an integer within the limit is valid. A decimal, a text or a number out of range are
 * tampered storage or storage from another version, and fall back to zero: a world a metre and a
 * half above the floor because of a broken value is much worse than one without fine-tuning.
 */
export function parsePlayHeightOffset(raw: string | null | undefined): number {
  if (raw == null || !/^-?\d{1,3}$/.test(raw)) return DEFAULT_PLAY_HEIGHT_OFFSET
  const value = Number(raw)
  return Math.abs(value) <= MAX_PLAY_HEIGHT_OFFSET ? value : DEFAULT_PLAY_HEIGHT_OFFSET
}

/** The offset, in centimetres, read from a storage that may not be there. */
export function readPlayHeightOffset(storage: Pick<Storage, 'getItem'> | null): number {
  if (storage === null) return DEFAULT_PLAY_HEIGHT_OFFSET
  try {
    return parsePlayHeightOffset(storage.getItem(PLAY_HEIGHT_OFFSET_KEY))
  } catch {
    // Blocked storage: no fine-tuning, which is how you played before this existed.
    return DEFAULT_PLAY_HEIGHT_OFFSET
  }
}

/** From centimetres to the metres the stage moves in. */
export function playHeightOffsetMeters(cm: number): number {
  return cm / 100
}

/**
 * **The contract with the hall, with a number**: its version and what this file knows how to read.
 *
 * Each capability is a setting of the hall that a game may or may not read: the language, the
 * volumes, the scenery, the play height and its fine offset, the grab, the turn with the stick and
 * the hand. This file is **the same in all seventeen**, so it does not say here which ones each
 * game uses: that is declared by each game's `package.json` in `xrcade.capabilities`, and checked
 * against its code by `src/lib/contract.test.ts`. The hall reads both things by importing the
 * installed package —not by searching for text in it— to know which settings to show for each
 * cabinet and what to require on publishing (`xrcade/docs/anadir-un-juego.md`).
 *
 * **The version goes up** when the meaning of a capability that already exists changes (another
 * key, other values); adding a new capability does not raise it, because a hall that does not know
 * it simply does not show it.
 */
export const XRCADE_CONTRACT = {
  version: 2,
  capabilities: [
    'lang',
    'volumes',
    'scenery',
    'playHeight',
    'playHeightOffset',
    'grab',
    'turn',
    'hand',
  ] as const,
} as const

/** A setting of the hall that a game can declare it reads. */
export type XrcadeCapability = (typeof XRCADE_CONTRACT.capabilities)[number]
