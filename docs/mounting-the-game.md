# Mounting Glide Hockey inside another application

Glide Hockey is published as a **package**, and what it exports is a **scene**:
three objects that are drawn inside the host's `<Canvas>`. Whoever owns the
Canvas owns the WebXR session, and that is the host — never
the game. The why is in [`xrcade.md`](./xrcade.md).

There are two ways to mount it, and which one applies depends on whether there is already a Canvas.

## Inside a Canvas that already exists: `<GlideHockeyScene>`

It is what the xrcade hall does. It creates no Canvas, does not open or close the session
and does not draw a single DOM tag.

```tsx
import { GlideHockeyScene } from 'glide-hockey'

<Canvas>
  <XR store={store}>
    <XROrigin position={[0, 0, 0]} />
    <GlideHockeyScene
      assetsBase="/juegos/glide-hockey/"
      onExit={() => backToTheHall()}
    />
  </XR>
</Canvas>
```

| Prop | What |
| --- | --- |
| `assetsBase` | Where the game's static files hang from in this host. Without it, the root of the site. |
| `onExit` | Return the player to where they were. The game calls it from its immersive menu; **what going back means is decided by whoever mounts it**. |

`onExit` is mandatory on purpose: in the hall, closing the session would be
tearing the headset off the player instead of returning them to the arc of cabinets.

The store also belongs to the host, and with it the controller profiles: it has to be
created with `baseAssetPath` pointing at the profiles it serves —the ones that
`glide-hockey-assets` copies into `<assetsBase>/webxr-profiles/` will do—. By default
@react-three/xr downloads them from a CDN, and under the hall's security policy
that leaves the player without controllers: without a ray the mallet does not move and nothing
can be pressed.

**The table is planted wherever the player is and facing wherever they look**, once
when the session starts (see `components/game/WorldAnchor.tsx`). The game does not place an
`<XROrigin>`: it moves its scenery, not the player.

### The challenge and the end-of-match notice

Two optional props, on the scene and on `<GlideHockey>` (and on `mountGlideHockey`,
which passes its options on to it), and a third one, `goal`, only on the scene; without them the
game is the usual one.

- **`challenge?: Challenge`** (`{ seed }`, a 32-bit integer): the run of the challenge
  of the day or of "challenge my score". With it the scene **does not open the menu: it goes
  straight into the challenge** (`challenge`, which ends with the first match lost),
  which is the mode of the record (`glide-hockey:best-points:challenge`), with its
  countdown and waiting, as always in the headset, for the mallet to be grabbed. There are
  no settings to fix: the machine's level and the goals of each round are
  set by the challenge's ladder, not by the menu. **There is no tutorial**: its demonstration
  delays the serve only for whoever has not seen it. **The machine's shots come
  from the seed**: the plan of each hit is a hash of the table, the rally and the
  hit, and the table of each round is `deriveSeed(seed, round)`
  (`tableSeed` in `lib/opponent.ts`), so losing goals in one round
  does not change the shots of the next. The rest of the table is physics in fixed
  steps, with no randomness. The challenge is read on mounting; for another one, another scene is mounted.
- **`onFinish?: (result: GameResult) => void`**: it is called **once** when
  each match ends —practice, levels or challenge—, right where the record is
  stored, with `{ mode, points, challenge }`: the mode (`practice`, `levels`,
  `challenge`), the points of the match even if they are not a record and `challenge: true`
  only in the run of the `challenge`. «Otra partida» afterwards is a normal one, with
  the usual machine and `challenge: false`. Leaving it halfway (going back to the menu or
  exiting) does not count it; the endless practice does count, on finishing it with its button, which
  is its ending.
  The two-player duel **is not counted**: its goals belong to two people, not to whoever
  wears the headset, and it has no record.
- **`goal?: Goal`** (the type of `src/lib/goal.ts`, exported by the package; only on
  `<GlideHockeyScene>`): `{ medals: { bronze, silver, gold }, better: 'higher' | 'lower', unit,
  record, mode }`. With it, the **sign above the back scoreboard** says what has to be
  beaten: in the first countdown, the mission and the three thresholds; while playing, the
  threshold that is missing, what has been scored so far, the round and what the next goal is
  worth; at the end, what was missing. `mode` is the mode the medals come from (`challenge`): in
  any other, the sign says that the match does not count for a medal. Without the prop, in the
  challenge it says the mission and the record stored in this browser. `unit` arrives already in
  the language of whoever is playing. The menu always opens on the challenge.

```tsx
<GlideHockeyScene challenge={{ seed: 20260925 }} onFinish={recordRun} onExit={backToTheHall} />
```

## With its own Canvas: `<GlideHockey>`

For an ordinary web page that wants a game screen. It brings the Canvas, the
WebXR session, the 2D menu and the button for entering the headset.

```tsx
import { GlideHockey } from 'glide-hockey'

<div style={{ height: '100dvh' }}>
  <GlideHockey assetsBase="/juegos/glide-hockey/" />
</div>
```

It takes up whatever its container measures, so it has to be given a height. Here `onExit` does
not exist: exiting is closing the session, because there is nowhere to go back to.

For whoever does not render React on their own there is
`mountGlideHockey(container, options)`, which returns a `{ unmount() }`.

## The three steps that have to be taken no matter what

### 1. Copy the static files

The WebXR controller profiles do not travel in the code: the browser asks for them over
HTTP on entering the headset. Without them, @react-three/xr never gets to register
any controller and the player is left without a ray to aim with.

```sh
npx glide-hockey-assets public/juegos/glide-hockey
```

And then the game is told where they have ended up with `assetsBase`. **Two games on
the same origin would overwrite each other** if both hung from the root, and that is why the path
is a decision of the host and not of the game.

It is run again when the version goes up: it is idempotent and leaves the destination with
the files of the new version.

### 2. Include the game among Tailwind's sources

The 2D menu and scoreboard use utility classes that Tailwind generates by
scanning the code. If the host does not look inside the package, the game is
mounted without styles.

```css
@import "tailwindcss";
@source "../node_modules/glide-hockey/src";
@import "glide-hockey/styles.css";
```

`styles.css` is how the game uses its colours and the animations of its
screens. Everything hangs from the `.glide-hockey` class, so it does not change the
look of anything in the host: the palette's values are set by the game itself
on its container, and they are the same ones the scene and the headset interface use
(`src/lib/palette.ts`).

Mounting only `<GlideHockeyScene>` —inside a Canvas— none of this is
needed: there the game draws no DOM.

### 3. Do not duplicate React or three

React and three go in `peerDependencies`, **never** in `dependencies`. Two copies
of React break the hooks and two of three, the scene. It is the expensive failure because it does
not break the build: it breaks the match.

## What the game takes for granted

- **No network.** The game does not connect anywhere: no server, no
  telemetry and no third-party brands. The record lives in the browser's
  `localStorage`.
- **No WebAssembly.** The puck's physics is a handful of formulas
  (`src/lib/puckPhysics.ts`), not an engine: those of the R3F ecosystem run on wasm
  and the hall's security policy blocks them.
- **No remote fonts.** The headset's numbers are drawn with segments
  (`src/lib/xrDigits.ts`), because drei's `<Text>` downloads the font from a CDN.
- **No audio files and no models.** The table, the puck and the mallets are
  geometry generated in code, and the hit, the bounce and the goal are synthesised with
  the Web Audio API (`src/lib/audioEngine.ts`), so the only thing that has to be
  copied is the controller profiles.
- **One `AudioContext`, and the game's own.** It is opened with the first sound of the match
  and closed when the scene is unmounted, so going back to the hall does not leave the system's
  audio ducked. Whoever is playing can mute it from the menu, and then
  none is opened.
- **The player stays where their host put them.** The game places its table
  around them and does not place an `<XROrigin>`.

## Storage it uses

Four keys in `localStorage`, with nothing that identifies anyone:

| Key | What |
| --- | --- |
| `glide-hockey:best-points` | The record of the practice mode. |
| `glide-hockey:best-points:challenge` | The record of the challenge mode. |
| `glide-hockey:duel-tally` | The duels won by each of the pair and the tied ones (`{ wins: [n, n], ties: n }`). It is not a record. |
| `glide-hockey:muted` | Whether the player left the game silent (`1`) or sounding (`0`). |

The scenery —the arcade room or the room of whoever is playing— is **not** its own: it is
`xrcade:scenery`, the same key the hall writes (`place` or `room`, and `place` if there is
nothing). The game's menus can change it, but they write that key: there is a single preference,
and outside the hall it works the same on the origin of the game's website. The game's own key,
`glide-hockey:scenery`, is written by nobody: it is deleted when the state of the match is
mounted, without migrating it (see `src/lib/settings.ts` and `src/lib/scenery.ts`).

The hall's dominant hand (`xrcade:hand`) **is not read**: the mallet is grabbed with whichever
hand is free and is switched from hand to hand mid-match (`MalletHand`), so it does not matter
which one is the dominant one and none of its menus asks. If one day the game needed a hand, it
reads it from that key with `useHand()`, like the scenery, instead of asking in its menu.

Its two menus —the web one and the headset one— **start with the mode, and only practice
asks**: in it the machine's level and the goals are chosen; in levels only which unlocked
level is played, and in the challenge nothing, because the ladder already sets them. In the duel
neither: both play the same (`DUEL_SETUP` in `src/lib/duel.ts`).

If the storage is blocked (private window, browser policy),
the game works the same: it is played without a record and with sound.
