# Seguridad

> ⚠️ **Todo lo que commitees puede acabar a la vista de cualquiera.** Organízate escanea la rama
> antes de integrarla y **bloquea la integración si detecta secretos** (`.env`, claves, tokens,
> credenciales), pero el escáner es heurístico: la responsabilidad de no introducir secretos es tuya.

## Valores de alta entropía en tests

Un test con vectores fijos —hashes, firmas HMAC, tokens de ejemplo— dispara el escáner por su
entropía aunque no sea ningún secreto. Cuando eso pase:

1. Asegúrate de que **de verdad** es un falso positivo: el valor debe derivarse de un secreto de
   prueba que esté en el propio fichero, o ser inventado. Si viene de un `.env` real, no es falso
   positivo por mucho que sea "solo un test".
2. Márcalo con `// gitleaks:allow` en esa línea **desde el primer commit**, y escribe encima por
   qué es inofensivo.
3. Si el valor ya está commiteado sin marcar, el marcador inline **no sirve**: el escáner recorre
   el historial de la rama, no solo su estado final (así caza secretos commiteados y borrados
   después). En ese caso, añade una entrada acotada en `.secretsallow` con la ruta del fichero y
   documenta ahí mismo la comprobación que hiciste.

Silenciar el escáner sin comprobar el origen del valor es exactamente la clase de atajo que la
regla de "no silenciar la verificación" prohíbe.

- **Nunca** hardcodees secretos (claves, tokens, contraseñas). Usa variables de entorno y ficheros
  `.env*` ya ignorados por git. No imprimas secretos en logs.
- **No commitees** `.env`, credenciales, ni datos sensibles. Verifica el `.gitignore` (y que `.env*`
  esté ignorado salvo `.env.example`). Si necesitas documentar variables, usa un `.env.example` SIN valores reales.
- **Valida y sanea** toda entrada externa (formularios, params, datos de red) antes de usarla.
- **Mínimo privilegio**: no abras permisos, CORS, RLS ni endpoints más de lo necesario.
- **Dependencias**: no añadas paquetes innecesarios; preferir los ya presentes. Ante un paquete
  nuevo, comprueba que existe y es el oficial (cuidado con typosquatting/supply-chain).
- **No ejecutes** comandos destructivos (borrados masivos, `git push --force`, `rm -rf` amplio) ni
  toques `main`/`master`. Trabaja siempre en la rama de trabajo asignada.
- Si detectas una vulnerabilidad o secreto expuesto en el repo, **párate y repórtalo**; no lo
  "arregles" silenciosamente commiteando el secreto.

## Secretos = hallazgo BLOQUEANTE (para agentes y revisores)

- En cualquier revisión de código, un secreto, un `.env` con valores reales o unas credenciales
  en el diff son **BLOQUEANTES**: el veredicto es "rechazar" hasta que desaparezcan (también del
  historial de la rama, no solo del último commit).
- El candado de Organízate escanea la rama antes del push (gitleaks si está instalado + patrones
  + entropía). **No lo esquives**: los marcadores inline (`gitleaks:allow`, `nomistakes:allow`,
  `pragma: allowlist secret`) y el fichero `.secretsallow` de la raíz son SOLO para falsos
  positivos evidentes (fixtures, ejemplos sin valor real) y siempre con OK humano explícito.
- No añadas binarios grandes (>500KB) sin justificarlo: no se pueden inspeccionar como texto y
  el candado los marcará.
- Nunca uses `git push --force`; si algún día hace falta forzar, solo `--force-with-lease` y
  lo decide el humano, no un agente.

## Lo irreversible se pregunta, no se ejecuta

Si nadie revisa el diff, el único riesgo que no se recupera es el irreversible. Por eso hay
acciones que el agente **no tiene**: `rm -rf`, `git reset --hard`, `git clean`, `git rebase`,
`git filter-branch`/`filter-repo`, `supabase db reset` y cualquier reescritura de historial
están denegadas por el CLI. Si de verdad hace falta una, se pide con `ask_user` explicando qué y
por qué, y la ejecuta la persona.

Y hay cambios que **no se integran solos** aunque los gates pasen: Organízate los para antes
del merge y los manda a la bandeja con el motivo exacto.

- **SQL destructivo en migraciones**: `drop table/column/schema`, `truncate`, `delete` sin
  `where`. Si la tarea lo necesita, deja la migración escrita y explícalo en tu respuesta: la
  integra una persona.
- **Ficheros de despliegue**: `.github/workflows/`, `vercel.json`, `Dockerfile`,
  `docker-compose`, `netlify.toml`, `fly.toml`… Cambiarlos es cambiar qué llega a producción
  y con qué permisos.
- **Dependencias nuevas** sí se integran, pero quedan registradas en el changelog. Antes de
  añadir una, mira si lo que hace ya está en el proyecto o cabe en veinte líneas propias.

