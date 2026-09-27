# AGENTS.md — glide-hockey

Las instrucciones del repo están en **`CLAUDE.md`** y el siguiente paso, en **`ESTADO.md`**.

Este fichero existe para alojar el bloque de reglas que `next dev` inyecta al detectar un
agente: Next lo escribe en `AGENTS.md` cuando existe y solo se lo añade a `CLAUDE.md` cuando no.
El bloque de abajo lo gestiona Next: no se edita a mano.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
