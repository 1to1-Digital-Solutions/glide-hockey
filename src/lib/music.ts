import { assetUrl } from './assets'

/**
 * The background music: whether it plays and which one it is.
 *
 * It is the only thing in the game that is **not** synthesised. The strikes,
 * the goals and the slide of the puck come from oscillators (`audioEngine.ts`)
 * because they are short and respond to what happens; a two and a half minute
 * piece of music made by hand would sound like what it is. So it is a file,
 * and that is why it travels in `public/` like the HDRI of other games: never
 * from a CDN, since the headset may be connected only to the home network.
 *
 * It goes apart from the mute (`muted.ts`) on purpose: they are two different
 * decisions. Some want to hear the puck and not the music, and some put the
 * game in the background and prefer the opposite. The mute rules over both
 * —if the game is silenced, nothing sounds— and the music only turns itself off.
 */

/** The loop of the room, relative to the base of the static files. */
const MUSIC_PATH = 'audio/sala.mp3'

/**
 * At what volume it plays, from 0 to 1.
 *
 * Low on purpose: it is the background of an amusement arcade, not the match.
 * It has to be heard when nothing happens and disappear under the puck as
 * soon as there is one.
 */
export const MUSIC_VOLUME = 0.22

/** The URL the music is requested from, already with the base of whoever mounts the game. */
export function musicUrl(): string {
  return assetUrl(MUSIC_PATH)
}
