# AGENTS.md — glide-hockey

The repo's instructions are in **`CLAUDE.md`** and the next step, in **`ESTADO.md`**.

This file exists to hold the block of rules that `next dev` injects when it detects an
agent: Next writes it in `AGENTS.md` when it exists and only adds it to `CLAUDE.md` when it does
not. The block below is managed by Next: it is not edited by hand.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
