# Glide Hockey in Godot

The same game for xrcade's native hub (Steam), with **the logic of `src/lib` not rewritten**:
GodotJS runs it inside the engine. Here there is only scene, input and interface, on top of the
shared kit of `xrcade/godot-kit/`.

**Status: it is played whole, on the flat screen and with a simulated headset; with a real headset
it has not been tried.** The table advances with `advanceTable` of `matchLoop.ts` in fixed steps of
1/60 s —Godot's physics is not used—, the machine chooses its shots with its seed (`opponent.ts`),
and the points, the modes, the challenge's ladder, the levels and the **two-player duel** are the
web's. It starts at the web's headset **menu** (`lib/xrMenuLayout.ts` without touching a single
measurement): the comfort of the hit taken at the top, the mode —with the web's icons: puck, stars,
ladder and two pucks for the duel—, and only what the mode asks (in practice the machine's level
and up to how many goals, or endless; in the levels, which one, with its stars; in the challenge
and in the duel, nothing), play in the middle and exit in the bottom right corner. The match starts
with the **countdown**, which with a headset stops on its last second until the mallet is in the
hand, and says so; meanwhile, the seven-segment **scoreboard** above the machine's goal, the stop
button and the **prompt** before leaving the match; at the end, the **game over** panel with the
points (in gold if they are a record), the level's stars, play again, menu and exit. What is saved
—records, the best endless streak, levels and stars, the comfort, the pair's duels— goes with the
web's `highScore.ts`, `progress.ts` and `duelTally.ts` on top of the kit's save in `user://`.

**The duel** (`lib/duel.ts`, as it is): two people pass the controller and each plays a match
against the same machine —«Media», up to 7 and with the same seed (`Duel.seed`)—; whoever gets the
bigger margin over it (goals for minus goals against) wins, and with the same one it is a tie. The
end of the first one's match is the **handover**, written as on the web (`drawDuel`): «Jugador 1:
7–0 · Pásale el mando a Jugador 2», and the wide button starts the second one's; the end of the
second says who wins, the two margins and how many duels the pair has played, and **sounds like a
win** (`endSoundsLikeWin`). The scoreboard shows in its bottom row the number of whoever has the
controller. No record and no notice to the hall.

Around it is **the web's arcade room** (`Room.tsx`): the carpet with its stripes, three walls with
trim, the ceiling, the two neons at the back (at the height the sign leaves free: `BACK_NEONS`),
ten switched-off arcade machines with their lit sign and the halo under the table. With **your
room** —the hall's scenery (`xrcade:scenery`), which the window button of the menu toggles— and a
headset with camera passthrough, the room is hidden and the background turns transparent (the
kit's `SceneryRig`); without augmented reality the button comes up disabled and the room is seen.

With a headset it uses **the kit's XR grammar** (`@kit/runtime/xr/player`): the table is planted
where the hall lends it, drops to the eyes of whoever plays seated and turns with the free hand's
stick, and the **interface rises with the eyes** over the world (`uiRiseOverWorld`, the web's
`XRUiHeight`); the mallet is grabbed with the fist (or a pinch) of either hand, with the dominant
one first, holding or with one tap. As on the web, **the mallet does not hang from the fist**: it
goes on the table, where the fist hovers over it, and hits with the speed of the hand (`inHand` of
`matchLoop.ts`). It vibrates with the recipes of `hapticFeedback.ts` in the hand that carries it:
the hit on the puck with its strength, the goal and the ending. The goal against is also the **hit
the body takes** (`lib/hitFeedback.ts` and `goalAgainst.ts`): vignette, shake of the room, slow
motion of the table, low-pass on the game's bus and the shared haptic, with whichever comfort is
chosen. The column goes at 55° to the left and enlarged, and the web's **tutorial** comes up the
first time at eye height and at 32° to the right, to one side of the sign and of the scoreboard so
as not to cover them (`tutorialPlacement`; on the flat screen, straight ahead). **The real
controller** (the Quest models, the kit's `RealController`) goes in both hands: with the grip lit
while the countdown waits for the mallet —the grab step is passed there, before the tutorial ever
comes up, as in `XRCountdown`— and with the button of each step of the tutorial; the two take
turns with the same model (`SharedController`). The web's **hints** (`hintScript.ts` on top of
`hints.ts`, as they are) show the gesture without letters and leave by themselves: the footprints
at the feet, the ghost mallet pushing until it touches the puck, the real controller a hand's
breadth from it with the grip throbbing, and the mark traced on the opposite goal. On the flat
screen, the mallet follows the mouse and the column goes to one side of the table, facing the
camera; the hints and the tutorial, as on the web, only with a headset.

It sounds with the web's effects rendered from its `audioEngine.ts` (the strike and the bounce at
three strengths, the goal, winning, losing, the record and the three medal thresholds, and the
puck's slide in a loop following its speed) and with its music and its fade; the language and the
volumes are the hall's, from the save.

**The menu opens on the challenge** and **the goal is read above the back scoreboard**
(`ui/sign.ts`): the web's sign with what `goal.ts` says and in the place of `scoreboardSign.ts`
—the mission in the first countdown; what has been scored so far, the round and what the next goal
is worth while playing; what was missing at the end—, the same size in the eye as on the web; the
scoreboard omits what the sign already says (the points and the round) and keeps the goals. The
menu says of each mode whether it counts for a medal, and the one that gives it carries a golden
puck on its button. On crossing a threshold the sign changes colour, grows and comes back, sounds
(`medal-*`) and is felt in the mallet's hand. **The medal thresholds are passed by the native
hall** in the `goal` metadata of its `XRcade` autoload: `hallGoal` (`main.ts`) reads it with the
kit's reader (`goalFrom`, that of `base.objetivo()`) and gives it to `Match`, just as the web
receives the `goal` prop. With it the sign says the thresholds, celebrates the medals and outside
the record's mode says it does not count; with the game on its own it says the mission and the
saved record, and outside the challenge it is not hung.

**The hall's challenge** (`seed.ts`): with `-- --reto=<seed>`, or if the `XRcade` autoload carries
the `challenge_seed` metadata, it goes straight into the challenge with the machine's shots drawn
from that seed (`tableSeed`); at the end of each scored match it prints
`GH-RESULTADO {mode, points, challenge}` and, if the hall has `report_result(json)`, it is called.
**The native hub does not pass challenges or collect results yet**: these are the hooks for when
it does.

Why it exists and what was measured: `xrcade/docs/salir-en-steam.md`, section 4.

## What is here

| Path | What it is |
|---|---|
| `scene/main.ts` | The scene: the table of `Table.tsx`, the puck, the mallets, the input (headset, mouse, automatic player), the sound, what is felt, the scenery, the interface's height and the real controller in the hands |
| `scene/world/` | The arcade room of `Room.tsx` (`room.ts`, with multimeshes like the web's `instancedMesh`) and the hints of `Hints.tsx` (`hints.ts`), with the kit's parts |
| `scene/game/` | The automatic player (`bot.ts`), the hit taken (`hitFeedback.ts`) and what sounds and is felt of each frame (`events.ts`, what of `haptics.ts` and `audioEngine.ts` does not go into the engine) |
| `scene/ui/match.ts` | The session: the web's `gameStore.ts` without React (what is chosen, the phase, the scoreboard, the challenge, what is saved) |
| `scene/ui/` | The menu, the scoreboard and the countdown, the game over panel, the exit prompt and the tutorial, with the web's measurements (`layout.ts` copies the ones that on the web live in React components) |
| `scene/**/*.engine.test.ts` | The session against the rules of the web's store; the panels measured with the web's instrument (`legibility.ts`, `panelReading.ts`, `exitCorner.ts`) in both languages —also with «Tu habitación» written— and pressed with the mouse; the arcade room, the room and your room, and the hints against the web's script and measurements: they run with the domain tests |
| `godot-kit.json` | For the kit: the id, the repo (`..`), **the kit's version** (`kit`, an xrcade tag) and which sounds are rendered from `audioEngine.ts` |
| `games/glide-hockey/mandos/`, `CREDITS.md` | The Quest controllers (`npm run godot:controllers`, from `public/webxr-profiles/`) with their MIT licence, and the package's credits. They are versioned; the «pack» preset includes the `.json` files, the licence and the credits |
| `games/glide-hockey/` | What goes in the `.pck`; `tests/` stays out on export |
| `games/glide-hockey/sfx/`, `music/` | The rendered effects (`npm run godot:sfx`) and the music of `public/audio/`. They are versioned |
| `games/glide-hockey/tests/auto_run.*` | An automatic match against the machine to the end: goals on both sides, scoreboard, sounds, hit taken, result to the hall; the challenge with the hall's seed, without thresholds and with those of the `goal` metadata on the sign; and a whole two-player duel (the two matches with the same seed and up to 7, the handover, who wins by margin, the pair's tally, no record and no notice to the hall, and the endings «how it went» and «win») |
| `games/glide-hockey/tests/menu_mouse.*` | The real scene with mouse clicks: choosing a mode, playing, Escape, going back to the menu from the prompt and exiting |
| `games/glide-hockey/tests/xr_controller.*` | Two matches with a simulated headset (the kit's fake controllers): right-handed, seated in the hall and late grabbing the mallet, and left-handed, standing with one tap. The hand that grabs, the countdown that waits for the mallet with the grip lit on both controllers, the height of the world and of the interface, the anchor, the turn, the pulses, the four hints (and none at the end), the tutorial with the real controller in both hands and the room |
| `tests/run.sh` | Everything of the engine at once (`npm run godot:test`) |

**Which tests go into the engine** is decided by the kit from the import graph: 37 of the 51 files
of `src/lib`, plus the kit's and the port's: **695 tests**. `npm run godot:build -- --list-tests`
says which ones and why not the other 14 (those that use `vi`, those that touch `window` in the
test itself, `textos.test.ts` which reads the disk). `haptics.ts` and `audioEngine.ts` do not go in
because the second opens an `AudioContext`: that is why `scene/game/events.ts` copies
`impactStrength` and the hand's events; if they moved to a file with no browser, that copy would
be deleted.

## How it is used

It needs the Godot 4.7.1 editor **built with GodotJS** (`xrcade/scripts/godotjs/`), in `$GODOT`,
and the xrcade repo next to this one (`../xrcade`). From this folder:

```sh
(cd .. && GODOT=$GODOT npm run godot:test)     # everything of the engine, at once
(cd .. && npm run godot:build -- --tests)      # scene and tests → games/glide-hockey/
$GODOT --headless --editor --generate-types --path .   # typings/ to check types
../node_modules/.bin/tsc -p tsconfig.json
$GODOT --headless --path . --import
$GODOT --headless --xr-mode off --path . res://games/glide-hockey/tests/domain_tests.tscn

# The effects, from the web's audioEngine.ts (Chromium), and checking them; the Quest controllers
(cd .. && npm run godot:sfx)
(cd .. && npm run godot:sfx -- --check)
(cd .. && npm run godot:controllers)

# An automatic match against the machine (practice, «Imposible», up to 7): it prints WAM-RESULT with
# the score and the cost per frame. `--difficulty=` and `--goals=` for another; `--duel`, a whole duel
$GODOT --headless --xr-mode off --fixed-fps 72 --path . -- --autoplay
$GODOT --headless --xr-mode off --fixed-fps 72 --path . -- --autoplay --duel

# The challenge with a seed
$GODOT --xr-mode off --path . -- --reto=4242

# Playing on the flat screen with the mouse (Escape to stop or exit); `--lang=es|en`, `--tutorial`,
# `--ayudas`, `--habitacion` (your room without a headset, to see what is removed)
$GODOT --xr-mode off --path .
# Screenshots: the menu (`--mode=duel` leaves it with that mode chosen), mid-match and the ending
# (with `--duel`, the handover)
$GODOT --xr-mode off --path . -- --shot-menu=/tmp/menu.png --lang=es
$GODOT --xr-mode off --path . -- --shot-menu=/tmp/menu-duel.png --mode=duel --lang=es
$GODOT --xr-mode off --fixed-fps 60 --path . -- --autoplay --duel --shot-final=/tmp/handover.png --lang=es
$GODOT --xr-mode off --fixed-fps 60 --path . -- --autoplay --shot=/tmp/match.png
$GODOT --xr-mode off --fixed-fps 60 --path . -- --autoplay --shot-final=/tmp/final.png
# The hints with the match just started: on the flat screen, or with the simulated headset (the
# camera is the fake head; `--pitch=-50` is from where `e2e/hints.spec.ts` looks at them,
# `--mirar=<degrees>` turns it)
$GODOT --xr-mode off --fixed-fps 60 --path . -- --shot-hints=/tmp/hints.png
$GODOT --xr-mode off --fixed-fps 60 --resolution 1280x720 --path . -- --visor-simulado --pitch=-50 --shot-hints=/tmp/hints-headset.png

# The .pck for the hub (run the build first)
GODOT=$GODOT ../../xrcade/scripts/pack-game.sh "$PWD" glide-hockey
```

**The kit's version is pinned** in `godot-kit.json` (`"kit": "v0.20.0"`). Day-to-day work does not
look at it: `npm run godot:build`, `godot:test` and `pack-game.sh --local` use the checkout next to
this one (`../xrcade/godot-kit`). The `.pck` that goes to the hall does: xrcade's
`npm run game:pack` takes the kit from that tag and not from the checkout, and `hub:build` and
`godot:quest` do not carry it if it was built with another. To use something new from the kit,
`kit` is raised to an xrcade tag that brings it before publishing the game
(`xrcade/docs/anadir-un-juego.md`, «La versión del kit»).

Glide Hockey is in the catalogue of the headset hub (`targets.godot` in
`xrcade/registry/games/glide-hockey.json`): xrcade's `npm run godot:test` packages it from here and
checks that the hub mounts it, hands it the screen and goes back to the hall with Escape.

## What is known and what is missing

- **Cost per frame** (the whole scene: hand, table, sound, hit taken, painting and interface),
  automatic match at 72 fps: ~75–105 µs on average depending on how loaded the machine is and
  0.4–2 ms at peak while playing on macOS (M5 Pro, QuickJS). Measured alternating with the version
  without the room or the hints, they add **~5–8 µs** (95 → 103): the scenery asks the headset
  every half second, the hints when off do not touch the engine and the room is still. With a
  simulated headset and the automatic player inside, ~140–160 µs; with the release templates in
  Docker, 95 µs and 0.8 ms on Linux arm64 and 147 µs and 1.1 ms on emulated Linux x86_64. The only
  expensive frame is that of the ending (6–7 ms on macOS): it writes the save to disk and mounts
  the panel.
- **The same seed does not give the same match on every platform**: the table is chaotic and the
  `Math` functions (`hypot`, `atan2`…) come from each system's libm, so the automatic match ends
  7–1 on macOS and Linux arm64 and 7–0 on Linux x86_64. Within one platform it repeats exactly.
  For the challenge across platforms, the seed evens out the machine's decisions, not every
  bounce.
- **The interface's aim only carries the buttons that are seen** (`apuntables` in `ui.ts`): the
  kit's repaints every frame all the ones it has, and with the thirty of this game the interface
  cost more than the table (105 µs of 170).
- **The tutorial carries the web's letters and buttons** (`TUTORIAL_SIZES`: counter and buttons at
  36 mm, buttons of 37 cm): it goes over the table, at 1.2 m from the eyes, where those of Hole
  Patrol stayed at 1°.
- **The light is not the kit's recipe** (`webToneMapping`): the scene carries its earlier sun and
  ambient light, without the web's ACES tone mapping, and that is why the carpet, the walls and the
  top come out somewhat lighter and with less contrast than in the web's screenshots. Adjusting it
  means looking at screenshots, as in Tower Tumble; here it has not been touched.
- **Two quirks of the web copied as they are**: the carpet is centred on the feet and not on the
  table (between its edge and the back wall there is 1.2 m with no floor, which the dark background
  hides), and the screens of the arcade machines on the sides tilt toward one flank (three's
  `Euler(tilt, rotation, 0)` composes in XYZ order). If they are corrected, it is in `Room.tsx` and
  here at the same time.
- **Without a headset the footprints are not seen in the flat-screen screenshot**: the web's camera
  looks at the table and leaves the feet out of the frame; with `--visor-simulado --pitch=-50` they
  are.
- **Not here**: the shader prewarm (`PrewarmShaders`), the table's reflection map
  (`useRoomEnvironment`) or the scene probe for the web's e2e.
- **The duel against the automatic player always ends in a tie**: it plays both matches the same
  against the same machine, and the shared seed makes it get the same (7–0 and 7–0 on «Media»). It
  is what the test checks; that one or the other wins by margin is proven by `duel.test.ts` and
  `match.engine.test.ts`.
- **What only the headset can tell**, besides what is in `salir-en-steam.md` 4.2 and 4.3: that the
  mallet is grabbed on bringing the fist close to the knob (18.6 cm from the knob, in 3D; the web
  measures only in the plane of the table), that hitting with the hand feels as on the web, that
  the countdown stopped on the 1 with the notice is understood, that the hit taken of the goal
  against is not dizzying with the normal comfort, the vibration of the ending (0.6 for 220 ms),
  the real controller of the OpenXR profile in each hand (with the grip lit where it should be in
  the countdown), the hints at their size (the controller beside the ghost, at 1.5 times), the
  interface at eye height and your room with real camera passthrough
  (`XR_ENV_BLEND_MODE_ALPHA_BLEND`).
