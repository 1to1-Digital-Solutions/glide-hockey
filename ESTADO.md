# Estado — Glide Hockey

> **Cómo continuar:** «lee `ESTADO.md` y sigue con el siguiente paso». Aquí va solo lo que hace
> falta para trabajar hoy; lo cerrado y el porqué están en `docs/historial.md`. Se actualiza con
> **`/estado`**, y `src/handoff.test.ts` le pone un tope de 8 KB.

---

## ⏭️ Siguiente paso

Air hockey contra la máquina (práctica, niveles con estrellas, reto, partida sin fin y duelo a
dos pasando el mando), en web y en Godot. Es un juego de **xrcade**: publica una escena que el
salón monta dentro de su Canvas (contrato en `docs/xrcade.md`).

1. **Probar con el visor.** El salón tiene instalada la **v0.24.0**; en `develop` hay trece
   commits más sin etiquetar (el port a Godot entero, el duelo, las hazañas para Steam, la
   altura fina del salón, el rayo que se esconde con algo en la mano). Qué mirar: la lista de
   glide-hockey en `organizate/docs/pendiente-de-visor.md` y el estado de `godot/README.md`
   («con visor de verdad no se ha probado»).
2. **Si se confirma, etiquetar una versión nueva** y subirla al salón con
   `npm run game:update -- glide-hockey` en xrcade (receta en `xrcade/docs/anadir-un-juego.md`).
   Etiquetar y publicar lo decide el usuario.

## 🚧 Lo que bloquea o espera

1. **Nada se ha visto con gafas de verdad**, ni la web ni el port de Godot: la vibración solo en
   el golpe del mazo, la columna del menú, el mando junto al mazo fantasma, el gol en contra como
   golpe recibido. Lista y dónde se toca cada cosa: `organizate/docs/pendiente-de-visor.md`.
2. **No hay test que monte la escena dentro de un Canvas ajeno**, como hace el salón. El contrato
   lo vigila `scripts/scene-contract.test.ts`, que lee el código.

## 👓 Pendiente de visor — el cartel del objetivo

El menú abre en el reto y el objetivo cuelga **encima del marcador del fondo** (web y Godot).
Hecho y medido en tests; **con las gafas no se ha visto**. Qué mirar, y dónde se toca:

| Qué mirar | Dónde se ajusta |
|---|---|
| ¿Se entiende la misión en los tres primeros segundos (la cuenta atrás)? ¿Se lee sin buscarlo? ¿Molesta al jugar, o tapa el disco al fondo? | `sitioDelCartel`, `AIRE_SOBRE_EL_MARCADOR` (`src/lib/cartelDelMarcador.ts`) |
| Tamaño: 24° × 4,5° a 2,28 m (0,95 m de ancho), a la altura de la vista | `PANEL_DEL_CARTEL`, `LETRA_DEL_CARTEL` (`CartelDeObjetivo.tsx`, común); en Godot, `CARTEL` (`godot/scene/interfaz/reparto.ts`) |
| Las dos tiras de neón, 15 cm más arriba: de pie a 1,9 m el cartel pisaba la de abajo; ahora quedan 0,4° | `NEONES_DEL_FONDO` (`cartelDelMarcador.ts`) |
| «Ronda 2 · a 5 goles · gol +120»: ¿se entiende de dónde salen los miles? Con el oro y seis cifras la frase baja a 0,9° | `LO_QUE_QUEDA`, `loQueQueda` (`cartelDelMarcador.ts`) |
| El marcador solo con los goles, en medio: ¿se echan de menos los puntos y la ronda debajo? | `loQueCallaElMarcador`; `filaDeLosGoles` (`XRHud.tsx`) |
| El listón cruzado: color, pulso, dos notas tras el gol y golpe en la mano del mazo; encajar puede bajar de un listón ya celebrado | `medalRecipe` (`audioEngine.ts`), `pulsosDelListon` |
| El tutorial ya no tapa cartel ni marcador: va a 32° a la derecha, a 1,2 m. ¿Se ve sin buscarlo? | `TUTORIAL_A_UN_LADO` (`cartelDelMarcador.ts`) |
| Menú: «Cuenta para medalla» junto a «Modo» y el disco dorado del reto | `MENU_MEDAL_WIDTH` (`xrMenuLayout.ts`) |
| Tanda UX 07/10: el nombre de cada modo bajo su icono, a 29 mm (`MENU_TEXT.mode`). ¿Se lee? ¿Se pisa con el icono? | `MENU_MODE_ICON_RISE`, `MENU_MODE_LABEL_DROP` (`xrMenuLayout.ts`) |
| Aprendiendo el reto los goles de la máquina no cuentan; al cerrar el tutorial el reto vuelve a empezar (cuenta atrás) con «Ahora cuenta para medalla» 2,5 s en el cartel. ¿Se entiende el reinicio? | `acabarLaLeccion` (`gameStore.ts`), `conElAvisoDeQueCuenta` (`cartelDelMarcador.ts`) |

## ▶️ Cómo arrancar

```
npm run dev              # web en plano
npm run dev:https        # para el visor, contra la IP de esta máquina
npm test                 # unitarios (vitest); incluye el tope de este fichero
npm run coverage         # 100 % de src/lib, y el mínimo es 100
npm run lint && npm run typecheck
npm run test:e2e         # Playwright; puerto E2E_PORT o PORT (3100 por defecto)
```

- **El 3000 es de Organízate**: los e2e usan su propio puerto, y en paralelo uno por agente.
- **Godot**: `GODOT="$HOME/Applications/Godot 4.7.1 GodotJS.app/Contents/MacOS/Godot" npm run godot:test`.
  El resto (jugar en plano, capturas, `--autoplay`, el `.pck` para el hub) está en
  `godot/README.md`. En el Mac no hay OpenXR: `--xr-mode off`.
- **La escena solo se deja mirar desde un test**: publica su estado en
  `window.__glideHockeyScene` si el test crea antes esa ranura (`src/lib/sceneProbe.ts`).
- El aviso `THREE.Clock deprecated` es de @react-three/fiber y está permitido en
  `e2e/consola.spec.ts`; cualquier otro aviso de consola hace fallar el e2e.

## 📌 Reglas que rigen y no se deducen del repo

- **Escena, nunca aplicación**: sin `<Canvas>`, sin `XRStore` y sin abrir ni cerrar la sesión de
  WebXR, que es del anfitrión.
- **Sin motor de física ni WebAssembly**, sin red ni fuentes remotas: la CSP del salón lo
  bloquea. La física del disco son funciones puras en `src/lib/puckPhysics.ts`.
- **El paso de la simulación es fijo (1/60 s)**, no el fotograma: la mesa es caótica y con paso
  variable cada máquina jugaría una partida distinta (`src/lib/matchLoop.ts`).
- **El audio cuelga de la escena (`GameWorld`), no de la mesa**: la mesa se estrena en cada
  ronda y cerraría el contexto en el fotograma del gol.
- Commits manuales, en inglés; `main` y las etiquetas, solo cuando lo pida el usuario.

## 🗺️ Dónde está lo demás

| Para… | Mirar |
|---|---|
| Por qué está algo así | `docs/historial.md` (no se lee al empezar) |
| El contrato con xrcade | `docs/xrcade.md` |
| Montar el juego en otra aplicación | `docs/montar-el-juego.md` |
| El port a Godot y sus comandos | `godot/README.md` |
| Qué probar con el visor | `organizate/docs/pendiente-de-visor.md` |
| Reglas comunes (XR, arquitectura, git) | `.claude/rules/` |
| Tareas cerradas desde Organízate | `TODO.md` |
