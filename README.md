# Glide Hockey

Air hockey against the machine, in 3D, in the browser and in a VR/AR headset (WebXR). You pick
how good the machine is and how many goals the match goes to, and you push the puck with a mallet:
with the mouse on a screen, with your hand in the headset. Every goal you score adds points and
every goal you concede takes some away.

**Live demo:** <https://glide-hockey.vercel.app>

Glide Hockey is one of the games of **xrcade**, an arcade hall you walk around in with the headset
on. The hall does not link to the game: it installs it as a package and mounts its scene inside
its own WebXR session. This repository is the game, plus a small website of its own that hosts the
same scene so it can be played and tested without the hall.

The game was called `air-hockey` before; saves written under the old storage keys are moved over
the first time it is played (`src/lib/legacyKeys.ts`).

## How to play

| Mode | |
| --- | --- |
| **Challenge** | Starts easy and steps up on its own: longer matches first, a better machine after. Every match you win chains the next one; the first one you lose ends the run. Inside the hall this is the mode that counts for a medal. |
| **Practice** | You choose the machine's level (five, from Easy to Impossible) and the goals the match goes to (3 to 15, or endless). Losing costs nothing. |
| **Levels** | One match at a time, each level harder than the one before, with up to three stars each. A level you win stays unlocked. |
| **Duel** | Two people and one controller: each plays one match against the same machine (Medium, to 7 goals, same seed) and whoever beats it by more wins. The pair's tally is kept apart from the records. |

Scoring rewards beating a strong machine and chaining goals without conceding; a goal against
takes points away and breaks the streak. Records, unlocked levels and settings are kept in the
browser (`localStorage`).

**On a screen (desktop).** Open the page and press *Play*. The mallet follows the mouse over your
half of the table. *Leave the game* asks before quitting; that dialog closes with Escape.

**In a headset.** Open the page in the headset's browser over HTTPS and press the button that
enters the immersive session (AR where the headset supports it, VR otherwise). The menu, the
scoreboard and the tutorial are panels inside the scene, operated with the controller's ray. To
play, grab the mallet: with the grip button of a controller near it, or pinching it with a bare
hand (hand tracking). The countdown waits on its last second until the mallet is in your hand. A
short tutorial and a few wordless hints explain the gesture the first time.

The interface is in English and Spanish. There is no language switch in the game: the language is
chosen once in the hall and reaches the game in a cookie; on its own, the game is served in
English.

## Run it locally

```sh
nvm use          # the exact Node version is in .nvmrc
npm install
npm run dev      # http://localhost:3000
```

WebXR only starts in a secure context, so to try it from a headset on your network:

```sh
npm run dev:https
```

`npm run build` and `npm run start` build and serve the production site.

## How it fits the xrcade hub

What the package exports is **a scene** — three.js objects drawn inside a `<Canvas>` that somebody
else owns — never an application. Whoever owns the Canvas owns the WebXR session, and that is the
host: the hall, or this repository's own website.

```tsx
import { GlideHockeyScene } from 'glide-hockey'
```

- [`docs/mounting-the-game.md`](docs/mounting-the-game.md): the ways to mount it
  (`<GlideHockeyScene>` inside an existing Canvas; `<GlideHockey>` / `mountGlideHockey` with a
  Canvas of its own), the props, and the `glide-hockey-assets` command that copies the static
  files into the host's `public/`.
- [`docs/xrcade.md`](docs/xrcade.md): the contract with the hall — what the scene must not do,
  what `package.json` has to declare, and what the hall's content security policy rules out.

Three things the game does not do, on purpose:

- **It does not go to the network.** No CDN, no remote fonts, no telemetry: the hall's security
  policy blocks it, and so does a headset with no internet.
- **It does not use WebAssembly.** The puck's physics are formulas, not an engine.
- **It does not move the player.** It places the table around wherever the host has put them.

## How the code is laid out

```
src/
  lib/          The logic, as pure functions testable without a browser: the puck's
                physics, the machine opponent, the challenge ladder, scoring and the
                state of the match.
  components/
    game/       The three.js scene: table, puck, mallets and the loop.
    ui/         The menu and the scoreboard on a screen (DOM).
    xr/         Their equivalents inside the headset, which are geometry.
  game/         What is published: the scene, the game with its own Canvas and the
                mount function for hosts that do not use React.
  app/          The website around the game. It is not the game.
e2e/            Browser tests (Playwright), with an emulated headset.
godot/          A port of the same game for xrcade's native hub: Godot scenes and UI
                running the logic of src/lib unchanged. See godot/README.md.
```

## Tests

```sh
npm run lint
npm run typecheck
npm test            # unit tests (Vitest): physics, opponent, state, panels, package contract
npm run coverage    # the same, with coverage: src/lib must stay at 100 %
npm run build
npm run test:e2e    # Playwright, against the production build
```

The browser tests build the site and serve it on the port in `E2E_PORT` (or `PORT`; 3100 by
default), not on 3000.

### Scripts that need other repositories

Some scripts reach outside this repository, into sibling checkouts that are not part of it. They
are not needed to run, build or test the web game, and each npm script stops with a message
saying what is missing:

| Script | Needs |
| --- | --- |
| `npm run comunes` | `../organizate`: the gate that checks that the files shared by every xrcade game are identical across them. |
| `npm run godot:build`, `godot:sfx`, `godot:controllers` | `../xrcade` (its `godot-kit/`): the build of the Godot port. |
| `npm run godot:test` | `../xrcade` and a Godot editor built with GodotJS, given in `GODOT`. |
| `npx tsc -p godot --noEmit` | `../xrcade`, and the engine typings generated into `godot/typings/`. |

## Licence

[MIT](LICENSE). The files under `public/` come from elsewhere and carry their own licences: see
[`public/CREDITS.md`](public/CREDITS.md).
