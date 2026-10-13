# glide-hockey inside xrcade

This game is developed in its own repository and the hall of
[xrcade](https://github.com/1to1-Digital-Solutions/xrcade) installs it by tag and **mounts it
inside itself**. It is not linked to: WebXR grants one immersive session per document, so
crossing to another tab or another domain ends it — going in to play would take the hall off and
coming back would take the headset off.

## It publishes a scene, not an application

What the package exports is a **scene**: a component that is drawn inside the `<Canvas>` that is
already mounted. Whoever owns the Canvas owns the session, and that is the host.

```tsx
export type GameSceneProps = {
  /** Where the game's static files hang from in this host. */
  assetsBase: string
  /** Return the player to where they were. The game calls it from its interface. */
  onExit: () => void
}
```

The scene does **not**:

- create a `<Canvas>` or an `XRStore`, or call `enterVR()`, `enterAR()` or `session.end()`;
- place an `<XROrigin>` — the player's spot is decided by the host, so the game places its
  world around wherever they are, shifting the scenery instead of moving the player;
- draw DOM — only three objects fit inside a Canvas, so the 2D menu and scoreboard stay on the
  game's website and their immersive equivalents are geometry.

`onExit` is how the game returns the player without deciding where to: on its own website it can
be closing the session; in the hall it is going back to the arc of cabinets.

## Its own website is one more host

The repository is split in two: **the game** (the scene) and **its website**, which puts the
Canvas, the session and the button for entering the headset around that same scene. It is not
gratuitous symmetry: it is how the game is tried with the headset without bringing up the hub,
and what makes breaking the contract show up here and not in the hall.

## What the `package.json` requires

xrcade's `npm run catalog:validate` checks it on registration, so failing here means not being
able to be published:

| Field | What |
| --- | --- |
| `exports` | With a default entry (`"."`). Without it the hub cannot import it. |
| `peerDependencies` | React, three and `@react-three/*`. **Never** in `dependencies`: two copies of React break the hooks, and two of three, the scene. It is the expensive failure, because it does not break the build — it breaks the match. |
| `files` | Only what is published. |
| `sideEffects` | `["*.css"]` if there are styles, so that the host's bundler does not swallow them. |
| `bin` | An executable that copies the static files into the host's `public/`, with paths relative to `assetsBase`. Two games on the same origin would overwrite each other. |

## What the hall's CSP does NOT let you use

The hall is served with a closed security policy and a game mounted inside inherits it
whole. Two things that are taken for granted when choosing libraries and do not work here:

| Blocked | What it rules out | Way out |
| --- | --- | --- |
| `script-src` without `'wasm-unsafe-eval'` | **WebAssembly**: compiling a wasm module throws. It takes with it the physics engines of the R3F ecosystem that run on wasm (Rapier, Jolt), which are exactly the first ones people reach for. | An engine in pure JavaScript (`cannon-es`), or loosening the hub's CSP. |
| `connect-src 'self'` | Any connection to another origin: WebSocket, fetch to an API, telemetry. It rules out networked multiplayer as is. | Serving it from xrcade itself, or loosening the hub's CSP. |

Neither of the two breaks the build or shows up locally, where the game is tried with a more
lenient CSP: they blow up on mounting it in the hall, with the first version already written.
Choose the engine with this in front of you.

## Publishing

It is consumed **by tag**, never by branch: `vX.Y.Z` accompanying the `version` of the
`package.json`. Updating it in the hall is `npm run game:update -- <id>` from xrcade, or
Organízate's games panel.

Registering the game also asks for two lines by hand in the hub —the registry of mounters and a
`@source` for Tailwind—: importing a module is code and the catalogue is data.
