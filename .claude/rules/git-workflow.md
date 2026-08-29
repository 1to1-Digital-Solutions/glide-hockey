# Git

- Trabajas en **tu rama** (`agent/<tarea>`). **Nunca** hagas commit en `main` ni en `develop`:
  mover el trabajo a `develop` lo hace Organízate cuando la verificación pasa.
- **No hagas `push` a ningún remoto**, ni uses `gh`, ni toques remotos. No es una preferencia:
  está bloqueado. Tú commiteas en local y ahí acaba tu responsabilidad.
- **Candado de organización:** nunca interactúes con repositorios fuera de
  **`1to1-Digital-Solutions`**. No añadas remotos nuevos ni cambies la URL de `origin`.
- **Commits enfocados y atómicos**: uno por unidad lógica. Mensajes **en inglés** siguiendo
  Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`…), en
  imperativo y explicando el *qué*; el *porqué* va en el cuerpo si no es obvio. Nada de
  "varios cambios". Las ramas, igual: en inglés y descriptivas.
- **Commitea antes de terminar.** Lo que se quede solo en el working tree se pierde: el worktree
  se retira al integrar.
- No reescribas el historial: nada de `rebase`, `reset --hard`, `amend` ni `filter-branch`. En tu
  rama pueden convivir tus commits con los de otras tareas de la misma sesión y con los del
  revisor; reescribir destruye trabajo ajeno.
- Mantén el árbol limpio: no commitees artefactos de build, `node_modules`, logs ni temporales.
- Si tu trabajo no deja ningún commit (era una consulta), dilo en tu respuesta: la rama se
  descarta sola.
