# Status — Glide Hockey

> **How to continue:** "read `ESTADO.md` and carry on with the next step". Only what is needed to
> work today goes here; what is closed and the why are in `docs/historial.md`. It is updated with
> **`/estado`**, and `src/handoff.test.ts` caps it at 8 KB.

---

## ⏭️ Next step

Air hockey against the machine (practice, levels with stars, challenge, endless match and a
two-player duel passing the controller), on the web and in Godot. It is an **xrcade** game: it
publishes a scene that the hall mounts inside its Canvas (contract in `docs/xrcade.md`).

1. **Try it with the headset.** The hall has **v0.24.0** installed; `develop` has thirteen more
   untagged commits (the whole Godot port, the duel, the feats for Steam, the hall's fine height,
   the ray that hides with something in the hand). What to look at: the glide-hockey list in
   `organizate/docs/pendiente-de-visor.md` and the status in `godot/README.md` ("it has not been
   tried with a real headset").
2. **If confirmed, tag a new version** and push it to the hall with
   `npm run game:update -- glide-hockey` in xrcade (recipe in `xrcade/docs/anadir-un-juego.md`).
   Tagging and publishing are the user's decision.

## 🚧 What blocks or waits

1. **Nothing has been seen with a real headset**, neither the web nor the Godot port: the vibration
   only on the mallet's hit, the menu column, the controller beside the ghost mallet, the goal
   against as a hit taken. List and where each thing is tuned: `organizate/docs/pendiente-de-visor.md`.
2. **There is no test that mounts the scene inside someone else's Canvas**, as the hall does. The
   contract is watched by `scripts/scene-contract.test.ts`, which reads the code.

## 👓 Pending headset check — the goal sign

The menu opens on the challenge and the goal hangs **above the back scoreboard** (web and Godot).
Done and measured in tests; **it has not been seen with the headset on**. What to look at, and where
it is tuned:

| What to look at | Where it is adjusted |
|---|---|
| Is the mission understood in the first three seconds (the countdown)? Can it be read without looking for it? Does it bother play, or cover the puck at the back? | `signPlacement`, `GAP_ABOVE_SCOREBOARD` (`src/lib/scoreboardSign.ts`) |
| Size: 24° × 4.5° at 2.28 m (0.95 m wide), at eye height | `SIGN_PANEL`, `SIGN_FONT` (`GoalSign.tsx`, shared); in Godot, `SIGN` (`godot/scene/ui/layout.ts`) |
| The two neon strips, 15 cm higher: standing at 1.9 m the sign overlapped the lower one; now 0.4° remain | `BACK_NEONS` (`scoreboardSign.ts`) |
| «Ronda 2 · a 5 goles · gol +120»: is it clear where the thousands come from? With gold and six digits the phrase drops to 0.9° | `REMAINING_TEMPLATE`, `remainingText` (`scoreboardSign.ts`) |
| The scoreboard with only the goals, in the middle: are the points and the round below missed? | `scoreboardOmits`; `goalsRow` (`XRHud.tsx`) |
| The threshold crossed: colour, pulse, two notes after the goal and a hit in the mallet hand; conceding can drop below a threshold already celebrated | `medalRecipe` (`audioEngine.ts`), `thresholdPulses` |
| The tutorial no longer covers sign or scoreboard: it sits 32° to the right, at 1.2 m. Is it seen without looking for it? | `TUTORIAL_TO_ONE_SIDE` (`scoreboardSign.ts`) |
| Menu: «Cuenta para medalla» next to «Modo» and the challenge's golden disc | `MENU_MEDAL_WIDTH` (`xrMenuLayout.ts`) |
| UX batch 07/10: each mode's name under its icon, at 29 mm (`MENU_TEXT.mode`). Can it be read? Does it overlap the icon? | `MENU_MODE_ICON_RISE`, `MENU_MODE_LABEL_DROP` (`xrMenuLayout.ts`) |
| UX batch 09/10: the cabinet's name and «Más opciones» in a new band at the top (the panel grows 10 cm); it folds level, goals, scenery and comfort as in the others. Not in the challenge: comfort is changed in another mode. Can it be found? | `MENU_TITLE_BAND`, `MENU_BUTTON.toggle` (`xrMenuLayout.ts`) |
| While learning the challenge the machine's goals do not count; on closing the tutorial the challenge starts over (countdown) with «Ahora cuenta para medalla» for 2.5 s on the sign. Is the restart understood? | `finishLesson` (`gameStore.ts`), `withNowItCountsNotice` (`scoreboardSign.ts`) |

## ▶️ How to start

```
npm run dev              # flat web
npm run dev:https        # for the headset, against this machine's IP
npm test                 # unit tests (vitest); includes this file's cap
npm run coverage         # 100 % of src/lib, and the minimum is 100
npm run lint && npm run typecheck
npm run test:e2e         # Playwright; port E2E_PORT or PORT (3100 by default)
```

- **3000 belongs to Organízate**: the e2e use their own port, and in parallel one per agent.
- **Godot**: `GODOT="$HOME/Applications/Godot 4.7.1 GodotJS.app/Contents/MacOS/Godot" npm run godot:test`.
  The rest (playing flat, screenshots, `--autoplay`, the `.pck` for the hub) is in
  `godot/README.md`. There is no OpenXR on the Mac: `--xr-mode off`.
- **The scene can only be looked into from a test**: it publishes its state in
  `window.__glideHockeyScene` if the test creates that slot first (`src/lib/sceneProbe.ts`).
- The `THREE.Clock deprecated` warning comes from @react-three/fiber and is allowed in
  `e2e/console.spec.ts`; any other console warning makes the e2e fail.

## 📌 Rules that apply and cannot be deduced from the repo

- **A scene, never an application**: no `<Canvas>`, no `XRStore` and no opening or closing the
  WebXR session, which belongs to the host.
- **No physics engine and no WebAssembly**, no network and no remote fonts: the hall's CSP blocks
  them. The puck's physics are pure functions in `src/lib/puckPhysics.ts`.
- **The simulation step is fixed (1/60 s)**, not the frame: the table is chaotic and with a
  variable step each machine would play a different match (`src/lib/matchLoop.ts`).
- **The audio hangs from the scene (`GameWorld`), not from the table**: the table is created anew
  every round and would close the context on the frame of the goal.
- Manual commits, in English; `main` and the tags, only when the user asks.

## 🗺️ Where the rest is

| For… | Look at |
|---|---|
| Why something is the way it is | `docs/historial.md` (not read at the start) |
| The contract with xrcade | `docs/xrcade.md` |
| Mounting the game in another application | `docs/mounting-the-game.md` |
| The Godot port and its commands | `godot/README.md` |
| What to try with the headset | `organizate/docs/pendiente-de-visor.md` |
| Shared rules (XR, architecture, git) | `.claude/rules/` |
| Tasks closed from Organízate | `TODO.md` |
