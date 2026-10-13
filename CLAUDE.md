# CLAUDE.md — glide-hockey

**What it is:** An air hockey game to play against the machine. You choose the difficulty in the start menu and how many goals the match goes to. It is the table game that blows air, with a hockey puck on the table. The players, one facing the other, hold a thing in their hand to push the puck.
Like other xrcade games, two modes: practice mode and challenge mode. In challenge mode, the difficulty and the number of goals keep going up.
A score also has to be kept for every goal scored (and points are taken away for every goal you concede).

This project is an **xrcade** game: it is mounted INSIDE the hub's immersive hall, not linked to. It publishes a **scene** (three objects), never an application: no `<Canvas>`, no `XRStore` and no opening or closing the WebXR session, which belongs to the host. Its own website is one more host, so that `glide-hockey` can be tried with the headset without bringing up xrcade. The full contract, with what the `package.json` requires, is in `docs/xrcade.md`: comply with it from the first commit.

**How it is built:** follow the rules in `.claude/rules/` (architecture, security, design,
git) in every change. Read the repo's context first, make the minimal, focused change, reuse
before creating and verify (typecheck/lint/build/tests) before calling anything done.

**Status and next step:** see **`ESTADO.md`** — that file is the handoff between sessions and
says what has to be done now.

**Firm decisions:**
- (Document here the stack and product decisions that are not renegotiated: language, framework,
  database, deployment, etc.)
- Manual commits: do not commit unless asked.

> Base installed with the Organízate suite. The shared rules live in `.claude/rules/`. The provenance of what
> was installed is in `.organizate/install-state.json`.
