# History of glide-hockey

> What was done, batch by batch, from the most recent to the oldest. It comes out of `ESTADO.md`,
> which has an 8 KB cap watched by `src/handoff.test.ts`. Nothing is deleted here: this is the
> long memory, and the handoff is what is needed to work today. **It is only read if the
> question is "why is this the way it is".**

For the current status and the next step: **`ESTADO.md`**.

---

### What was in ESTADO.md until 2026-09-27

> **How to continue after a restart:** tell Claude "review `ESTADO.md` and continue with the next
> step". This file is the memory between sessions: keep it short, truthful and up to date.

---

#### 📍 Headset batch of 24/09/2026 (on v0.22.0, unpublished)

- **The controllers no longer vibrate all the time.** Out goes the puck's slide in the hand
  (`stepSlide`: overlapping pulses every frame, and in both hands because in VR it was never
  known which hand carried the mallet). Now `MalletHand` says the hand (`onMove(..., side)` →
  `noteHand`) and the only thing that vibrates is **the player's mallet hitting the puck**, in
  that hand, with the shared recipe `impact` of `lib/hapticFeedback.ts` and the strength of the
  collision speed; the goal is a soft `arrival` and the end of the match a long pulse, both in
  the mallet hand. Rail, slide and the machine's hits: nothing. No hand on the mallet: nothing.
  Logic in `lib/haptics.ts` (`frameEvents`, `eventPulses`, `playPulses`); the test of a loose
  puck bouncing for 20 s gives zero pulses. The slide **can still be heard**.
- **Column and button, together on the left** (shared rule of `xr.md`): menu, end of match and
  exit notice at 1.5 m, 55° to the left, at eye height and turned towards the player (`COLUMN`
  in `GameWorld.tsx`), scaled ×1.4 so that the lettering can be read (the tightest one, «The
  room» with eyes at 1.2 m). The button that opens it goes **in the same place** (`XR_QUIT`),
  ×2.6, blue and opaque, and hides while the notice is open. Before: panel at 1 m and 42° to the
  right, button at 0.9 m and 57° to the left without turning. Here you do not walk around the
  table (the mallet does not go past the halfway line), so the column hangs fixed; a test checks
  that it does not cover table, scoreboard or demonstration from 15 head positions in front of
  the goal.
- **The real controller beside the ghost mallet, from the first time**: out goes
  `tutorialSeen()` from `Hints.tsx`; the hint plants the right controller with the grip pulsing
  a hand's width to the right of where the mallet starts, 10 cm above the board, ×1.5 and turned
  with the grip's side facing the eyes (`controllerBesideMallet` in `lib/hintScript.ts`, prop
  `beside` of the shared `RealController`). It turns off with `grab` or after 12 s, like the
  ghost. The tutorial's copy stays on the hand's controller.

##### Pending headset check

| What to look at | Where it is tuned |
|---|---|
| The mallet's hit is felt in its hand and only in it; weak/strong can be told apart | `HAPTIC_RECIPES.impact` (`lib/hapticFeedback.ts`, shared) |
| The goal is noticed but is not confused with a hit | `GOAL_STRENGTH` (`lib/haptics.ts`) |
| The end of the match is noticed | `FINAL_PULSE` (`lib/haptics.ts`) |
| The column is found by turning the head and does not get in the way while playing | `COLUMN` (`GameWorld.tsx`) |
| The column's lettering can be read at 1.5 m | `COLUMN_SCALE` (`GameWorld.tsx`) |
| The button is seen out of the corner of the eye without looking for it, and the menu comes up where it was | `BUTTON_SCALE`, colours in `XRQuitButton` (`XRHud.tsx`) |
| With the menu at 55° to the left, on entering you know where to look | `COLUMN.azimuth` |
| The controller beside the ghost is seen and it is clear which button to squeeze | `CONTROLLER_BESIDE_MALLET`, `MANO_QUE_JUEGA` (`lib/hintScript.ts`) |
| The goal against as a hit taken (vignette, room that shakes, table in slow motion, muffled hearing, vibration in both hands) does not cause motion sickness and is noticed without bothering; «Al recibir» Apagado/Suave/Normal in both menus | strength in `GOAL_AGAINST_STRENGTH` (`lib/goalAgainst.ts`); curves in `HIT` (`lib/hitFeedback.ts`, shared) |

####  v0.7.0 (2026-09-08): background music, with its own switch

- **The room has sound.** Until now all the audio was oscillators: the hits, the goals and the
  puck's slide. The background was missing, and without it an arcade is not an arcade.
- The track is [Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k),
  **CC0**, in `public/audio/sala.mp3`. Mono at 64 kbps: 1.2 MB for two and a half minutes, which
  is what can be asked for over HTTP on a headset connected to the home network. It starts and
  ends almost in silence, so the loop has no seam. Credited in `public/CREDITS.md`.
- **Its own switch**, next to the sound one in both menus (`lib/music.ts`, with the pattern of
  `muted.ts`). They are two different decisions: some people want to hear the puck and not the
  background. Mute rules over both.
- **Entering with the music off downloads nothing**: the audio element is created the first time
  it is asked for. Checked in the browser —zero requests when off, one on turning it on.

#### v0.6.1 (2026-09-08): the table stops manufacturing energy

- **`MALLET_RESTITUTION` drops from 1.15 to 0.85**, which is that of a real mallet. Above 1 it
  meant that a mallet **at rest** returned the puck faster than it arrived: a table that plays
  by itself.
- The counterattack is not lost, because it never depended on that: the impulse is computed with
  the **relative** speed, so a mallet advancing at 3 m/s against a puck coming at 2 returns it
  at almost 7. The strength comes from the hand, not from the restitution.
- Two new guards in `puckPhysics.test.ts`: a mallet at rest cannot return the puck faster than
  it arrived, and one that advances can.
- **And along the way, the room fitted its draw budget again.** The e2e had been red for a while
  without anyone looking at it: the arcade room (v0.5.0) raised the scene from 40 calls to
  **63**, with the ceiling at 40. The ten machines were thirty meshes, the carpet's bands five
  and the walls six; instanced they are three, one and two. **36 calls** and it looks the same.

#### v0.6.0 (2026-09-07): the scenery is changed without leaving the session

- **The arcade room or your own room, chosen by whoever is playing** and not by how the headset
  was entered. Inside an augmented reality session the two are the same session painted in two
  ways, so it is changed **without leaving**: with the headset on, leaving and coming back in
  to see the room was exactly what made nobody use it.
- It is chosen from both menus —the web one and the headset one—, and inside the headset the
  switch turns off when the session is not augmented reality: without passthrough there is no
  room to show, and promising it would leave the player looking at nothing.
- It is decided by `showsPlace(sessionMode, scenery)`: outside an augmented reality session the
  arcade room is always drawn. It is a stored preference.

#### 📍 v0.5.1 (2026-09-07): the tests now say how much code they run

- **The suite measures its own coverage** (`npm run coverage`, and one more step in CI). What is
  measured is **the domain** (`src/lib`), which is the only thing that can be tested without a
  browser with WebGL; the scene is tested end to end.
- **It is at 100 %, and the minimum is 100**: whatever is added untested breaks the build. The
  few branches no test can reach —guards that would only act if the code next to them changed—
  carry `v8 ignore` with the reason written beside it, not a lower number.
- To get there, tests were written for what nobody tested: the storage when the browser does not
  allow saving, the sound engine against a fake `AudioContext`, the headset panel and the state
  of the match with fake clocks.
- The HTML report stays in `coverage/`, which is not committed.

#### ⏭️ NEXT STEP (the first thing on coming back)

- Try the game **with the headset** (`npm run dev:https`): it is the only thing of the
  first version that nobody has seen. Look above all at whether it can be played
  aiming with the controller's ray and whether the immersive menu can be read and pressed. And
  what is in the "Pending headset check" table above.

#### What glide-hockey is

- Air hockey against the machine, in 3D, for browser and headset. Two modes:
  **practice** (you choose level and goals) and **challenge** (a ladder that climbs by itself).
  Every goal adds points; every goal conceded takes them away.
- It is an **xrcade** game: it publishes a scene that the hall mounts inside its
  own Canvas. Its website is one more host (see `docs/xrcade.md`).

#### Firm decisions

- **Stack**: Next 16 (App Router) + React 19 + three 0.185 + @react-three/fiber,
  drei and xr. Tailwind 4. Vitest for unit tests, Playwright for the browser. The
  versions are the same ones the suite's sibling games use.
- **No physics engine**: the puck's are pure functions in
  `src/lib/puckPhysics.ts`. The R3F engines run on WebAssembly and the hall's
  security policy blocks them.
- **No network and no remote fonts**: the headset's numbers are drawn with
  segments (`src/lib/xrDigits.ts`) and the controller profiles are self-hosted.
- The geometry (table, puck, mallets, room) is generated in code: there are no models.
- Manual commits: do not commit unless asked.

#### Done so far

- **It is now played in a place, not in the void.** The scenery was a dark floor and little
  else, so with the headset on there was no way to judge distances: what gives the scale is the
  familiar things around. Now it is an arcade: patterned carpet, switched-off machines against the walls, neons and the low light of such a place. All geometry in code and flat
  colours, which is what the hall's security policy lets through.

- **The interface inside the scene is now visible when the hall mounts it.** It was always
  hidden when there was no WebXR session, because on its own website the DOM rules and its
  buttons would catch the mouse clicks ahead of the game. But the xrcade hall **puts no DOM**:
  mounted there and without a headset, the game was seen whole and there was no way to start
  the match. Now it is decided by `hasDomUi` —passed by whoever mounts the scene, not guessed by
  the game—, as in the new games.

- **Levels and Endless practice** (the modes as modules on top of what there was). `Levels`
  (`src/lib/levels.ts`) is the challenge's ladder one match at a time: each level is
  `challengeRound(n)`, winning it gives stars according to what was conceded (one for winning,
  two if the machine scored less than half of what you did, three if it scored none) and one
  star unlocks the next; the progress lives in the browser (`src/lib/progress.ts`). The
  Challenge stays as it was (in one go, until the first defeat). The **endless match** of
  Practice is a match to infinite goals (`ENDLESS`): it is closed by the «Terminar» button (web
  and headset) and its record is the best streak (`glide-hockey:best-streak:endless`). The
  active level is frozen when the match starts.
- First complete version, playable on desktop: menu, match, scoreboard,
  summary, record per mode, and the two modes.
- Pure, tested logic: puck physics, machine opponent by levels, challenge
  ladder, scoring, state of the match.
- xrcade contract fulfilled: `<GlideHockeyScene>` (scene), `<GlideHockey>` (with its
  Canvas), `mountGlideHockey`, `exports`/`peerDependencies`/`files`/`bin` in the
  `package.json`, and `npx glide-hockey-assets` for the static files.
- Immersive interface in geometry: menu, scoreboard, countdown and end of match.
- Sound: mallet hit, bounce off the rail and goal, synthesised with the Web
  Audio API (`src/lib/audioEngine.ts`), plus the mute setting in both
  menus, stored between visits (`src/lib/muted.ts`).
- The hit and the bounce sound and vibrate with the strength of the impact: the table says
  at what speed puck and mallet were closing in and at what speed the puck reached the
  rail (`Impact`, in `puckPhysics.ts`), and `impactStrength` maps it to 0-1 over the
  maximum speed; the volume goes between a fifth and the whole and the pitch a little
  lower the weaker it is. It is what silences the puck trapped in a corner
  rattling at full volume. The goal does not look at it.
- Controller vibration (`src/lib/haptics.ts` + `useGameHaptics`): only the mallet's hit
  on the puck, in the hand that carries it (see the batch of 24/09 above).
- 150 unit tests and 11 browser tests. Lint, types and build green.

- **v0.3.0 (2026-09-06): the table reflects, the puck glows and slides.** An **environment map
  without a file**: three's `RoomEnvironment` prefiltered with `PMREMGenerator` once on mounting
  (`lib/useRoomEnvironment.ts`), applied to the board and the puck (`envMap`, not
  `scene.environment`: inside the hall the scene belongs to the host). The task asked for a
  cubemap/HDRI from `assetsBase`; this looks the same and asks for nothing over HTTP. The puck
  carries an **emissive and an additive halo that grow with speed** (`lib/puckGlow.ts`,
  `Puck.tsx` with a speed ref that the rink writes). And the **puck's slide** can be heard: a
  continuous voice of filtered looping noise in the same `AudioContext`, whose volume (square
  root of the speed, cap 0.28) and pitch (380–1900 Hz) follow the speed with `setTargetAtTime`
  (`slideLevel`/`slidePitch` in `audioEngine.ts`, tests of the curve); it does not open the
  context on its own, it obeys mute and turns off when the rink is removed. `useGameAudio()` now
  returns `{ play, slide }`. **Cost measured** in draw calls (`e2e/table.spec.ts`, ceiling 40):
  the table in the menu stays at **27**, same as before; the halo is one more mesh only during
  a match. **Untested with the headset**: there, look at whether the slide is tiring
  (`SLIDE_MAX_LEVEL`) and whether the reflections cost frames.

#### Pending / next steps

- Try with a real headset (see "next step").
- There is no test that mounts the scene inside someone else's Canvas, as the hall does.
  Today the contract is watched by `scripts/scene-contract.test.ts`, which reads the code.

#### Caveats and notes

- **The machine aims at the side the player is not covering**, not at the centre
  (`aimPoint`). Shooting down the middle, a mallet standing still in front of the goal is a
  perfect plug and the rally never ends: it was discovered because the e2e
  was waiting for a goal that never came.
- **Looking inside the scene**: the puck and the mallets are three objects and
  cannot be read from the DOM. The scene publishes its state in
  `window.__glideHockeyScene` **only if the test creates that slot first**
  (`src/lib/sceneProbe.ts`); in production it is one check per frame.
- **Dead puck**: if it stays still for four seconds it is served from the centre. No
  mallet crosses the halfway line, so a puck at rest where the other one cannot
  reach freezes the match.
- **Rally that never ends**: after twenty seconds without a goal it is also served from the
  centre (`RALLY_SECONDS`, in `src/lib/puckPhysics.ts`). The dead puck did not
  catch it because in those rallies the puck does not stop: it bounces the same way between
  the machine's mallet and a rail because the machine always hits towards the same spot. With
  the player's mallet standing still, 4 % of the simulated matches never ended;
  `matchLoop.test.ts` plays two hundred with jitter and requires that none goes past the
  minute.
- The `THREE.Clock deprecated` warning comes from @react-three/fiber and is on the
  third-party list of `e2e/console.spec.ts`. Any other warning makes the test fail.
- **The match clock does not depend on the frames**: the loop lives in
  `src/lib/matchLoop.ts` and simulates the seconds each frame has taken to
  arrive in **fixed steps of 1/60 s**; what does not make up a step is kept
  (`leftover`) and played by the next frame. Only what exceeds
  a quarter of a second is discarded, which is a tab coming back from the background.
  Clamping the step on every frame put the game in slow motion
  below 30 fps, and with it the CI in red: there WebGL runs in software.
- **The step has to be fixed, not the frame split into equal pieces.** The
  table is chaotic: with the step tied to the frame rate there is no slow motion,
  but each machine plays a different match —the same one lasted 11 s at 60 fps,
  24 s at 7 and at 56 it never ended—. The tests of `matchLoop.test.ts` deliberately
  measure rates that are not multiples of 60 (7, 23, 45, 56): with 60/30/15 the
  bug is not seen, because there the frame does land exactly on steps of 1/60.
- The browser tests use the port in `PORT`; 3000 belongs to Organízate.
- **The audio context is created with the first sound, not when the table is mounted**:
  browsers suspend any `AudioContext` created without
  anyone having touched anything, and the table is mounted before «Jugar» is pressed. Muting
  closes it instead of lowering the volume: an open one counts as the page
  making sound, and in the headset that ducks the system's music.
- **The audio hangs from the scene (`GameWorld`), not from the table (`Rink`).** The
  table is created anew in every match and in every round of the challenge (`key={runId}`), so
  with the player inside it, winning a round closed the context on the same
  frame in which the goal that won it sounded —and opened another one per round—. It is
  watched by the first test of `e2e/sound.spec.ts`, which plays two matches and
  requires a single context.
