# Glide Hockey en Godot

El mismo juego para el hub nativo de xrcade (Steam), con **la lógica de `src/lib` sin
reescribir**: la ejecuta GodotJS dentro del motor. Aquí solo hay escena, entrada e interfaz,
sobre el kit común de `xrcade/godot-kit/`.

**Estado: se juega entero, en plano y con visor simulado; con visor de verdad no se ha probado.**
La mesa avanza con `advanceTable` de `matchLoop.ts` a pasos fijos de 1/60 s —la física de Godot no
se usa—, la máquina elige sus tiros con su semilla (`opponent.ts`), y los puntos, los modos, la
escalera del reto y los niveles son los de la web. Se empieza en el **menú** del visor de la web
(`lib/xrMenuLayout.ts` sin tocar una cota): el confort del golpe recibido arriba, el modo, y solo
lo que el modo pregunta (en la práctica el nivel de la máquina y a cuántos goles, o sin fin; en los
niveles, cuál, con sus estrellas; en el desafío, nada), jugar en medio y salir en la esquina de
abajo a la derecha. La partida empieza con la **cuenta atrás**, que con visor se para en su último
segundo hasta que el mazo está en la mano y lo dice; mientras, el **marcador** de siete segmentos
sobre la portería de la máquina, el botón de parar y el **aviso** antes de dejar la partida; al
acabar, el **final** con los puntos (en oro si son récord), las estrellas del nivel, otra vez, menú
y salir. Lo guardado —récords, la mejor racha sin fin, niveles y estrellas, el confort— va con el
`highScore.ts` y el `progress.ts` de la web sobre el guardado del kit en `user://`.

Con visor usa **la gramática XR del kit** (`@kit/runtime/xr/jugador`): la mesa se planta donde la
presta el salón, baja a los ojos de quien juega sentado y gira con el stick de la mano libre; el
mazo se coge con el puño (o un pellizco) de cualquier mano, con la buena por delante, manteniendo o
con un toque. Como en la web, **el mazo no cuelga del puño**: va sobre la mesa, donde el puño la
sobrevuela, y golpea con la velocidad de la mano (`inHand` de `matchLoop.ts`). Vibra con las
recetas de `tactos.ts` en la mano que lo lleva: el golpe al disco con su fuerza, el gol y el final.
El gol en contra es además el **golpe que recibe el cuerpo** (`lib/golpeRecibido.ts` y
`golEnContra.ts`): viñeta, sacudida de la sala, cámara lenta de la mesa, paso bajo en el bus del
juego y el háptico común, con el confort que se elija. La columna va a 55° a la izquierda y
agrandada, y el **tutorial** de la web sale la primera vez sobre la mesa. En plano, el mazo sigue
al ratón y la columna va a un lado de la mesa, de cara a la cámara.

Suena con los efectos de la web renderizados de su `audioEngine.ts` (el golpe y el rebote a tres
fuerzas, el gol, ganar, perder y el récord) y con su música y su fundido; el idioma y los
volúmenes son los del salón, del guardado.

**El reto del salón** (`semilla.ts`): con `-- --reto=<semilla>`, o si el autoload `XRcade` lleva
el metadato `challenge_seed`, se entra directo en el desafío con los tiros de la máquina sacados
de esa semilla (`semillaDeLaMesa`); al acabar cada partida con puntuación se imprime
`GH-RESULTADO {modo, puntos, reto}` y, si el salón tiene `report_result(json)`, se le llama. **El
hub nativo todavía no pasa retos ni recoge resultados**: son los enganches para cuando lo haga.

Por qué existe y qué se midió: `xrcade/docs/salir-en-steam.md`, sección 4.

## Qué hay

| Ruta | Qué es |
|---|---|
| `scene/main.ts` | La escena: la mesa de `Table.tsx`, el disco, los mazos, la entrada (visor, ratón, jugador automático), el sonido y lo que se siente |
| `scene/juego/` | El jugador automático (`bot.ts`), el golpe recibido (`golpe.ts`) y lo que suena y se siente de cada fotograma (`sucesos.ts`, lo que de `haptics.ts` y `audioEngine.ts` no entra en el motor) |
| `scene/interfaz/partida.ts` | La sesión: el `gameStore.ts` de la web sin React (qué se elige, la fase, el marcador, el reto, lo que se guarda) |
| `scene/interfaz/` | El menú, el marcador y la cuenta atrás, el final, el aviso de salir y el tutorial, con las cotas de la web (`reparto.ts` copia las que en la web viven en componentes de React) |
| `scene/interfaz/*.motor.test.ts` | La sesión contra las reglas del store de la web, y los paneles medidos con el instrumento de la web (`legibilidad.ts`, `panelReading.ts`, `exitCorner.ts`) en los dos idiomas, y pulsados con el ratón: corren con los tests de dominio |
| `godot-kit.json` | Para el kit: el id, el repo (`..`) y qué sonidos se renderizan del `audioEngine.ts` |
| `games/glide-hockey/` | Lo que va en el `.pck`; `tests/` se queda fuera al exportar |
| `games/glide-hockey/sfx/`, `music/` | Los efectos renderizados (`npm run godot:sfx`) y la música de `public/audio/`. Se versionan |
| `games/glide-hockey/tests/partida_auto.*` | Una partida automática contra la máquina hasta el final: goles de los dos lados, marcador, sonidos, golpe recibido, resultado al salón; y el reto con la semilla del salón |
| `games/glide-hockey/tests/menu_raton.*` | La escena de verdad con clics del ratón: elegir modo, jugar, Escape, volver al menú desde el aviso y salir |
| `games/glide-hockey/tests/xr_mando.*` | Dos partidas con visor simulado (mandos de mentira del kit): diestro sentado en el salón y zurdo de pie con un toque. La mano que coge, la cuenta que espera al mazo, la altura, el anclaje, el giro y los pulsos |
| `tests/run.sh` | Todo lo del motor de una vez (`npm run godot:test`) |

**Qué tests entran en el motor** lo decide el kit por el grafo de imports: 32 de los 44 ficheros de
`src/lib`, más los del kit y los del port: **467 tests**. `npm run godot:build -- --list-tests`
dice cuáles y por qué no los otros 12 (los que usan `vi`, los que tocan `window` en el propio test,
`textos.test.ts` que lee el disco). `haptics.ts` y `audioEngine.ts` no entran porque el segundo abre
un `AudioContext`: por eso `scene/juego/sucesos.ts` copia `impactStrength` y los sucesos de la
mano; si pasaran a un fichero sin navegador, esa copia se borraría.

## Cómo se usa

Hace falta el editor de Godot 4.7.1 **compilado con GodotJS** (`xrcade/scripts/godotjs/`), en
`$GODOT`, y el repo de xrcade al lado (`../xrcade`). Desde esta carpeta:

```sh
(cd .. && GODOT=$GODOT npm run godot:test)     # todo lo del motor, de una vez
(cd .. && npm run godot:build -- --tests)      # escena y tests → games/glide-hockey/
$GODOT --headless --editor --generate-types --path .   # typings/ para comprobar tipos
../node_modules/.bin/tsc -p tsconfig.json
$GODOT --headless --path . --import
$GODOT --headless --xr-mode off --path . res://games/glide-hockey/tests/domain_tests.tscn

# Los efectos, del audioEngine.ts de la web (Chromium), y comprobarlos
(cd .. && npm run godot:sfx)
(cd .. && npm run godot:sfx -- --check)

# Una partida automática contra la máquina (práctica, Imposible, a 7): imprime WAM-RESULT con el
# marcador y el coste por fotograma. `--dificultad=` y `--goles=` para otra
$GODOT --headless --xr-mode off --fixed-fps 72 --path . -- --autoplay

# El reto con una semilla
$GODOT --xr-mode off --path . -- --reto=4242

# Jugar en plano con el ratón (Escape para parar o salir); `--lang=es|en`, `--tutorial`
$GODOT --xr-mode off --path .
# Capturas: el menú, a mitad de partida y el final
$GODOT --xr-mode off --path . -- --shot-menu=/tmp/menu.png --lang=es
$GODOT --xr-mode off --fixed-fps 60 --path . -- --autoplay --shot=/tmp/partida.png
$GODOT --xr-mode off --fixed-fps 60 --path . -- --autoplay --shot-final=/tmp/final.png

# El .pck para el hub (ejecuta antes el build)
GODOT=$GODOT ../../xrcade/scripts/pack-game.sh "$PWD" glide-hockey
```

Glide Hockey está en el catálogo del hub de visor (`targets.godot` en
`xrcade/registry/games/glide-hockey.json`): `npm run godot:test` de xrcade lo empaqueta desde aquí
y comprueba que el hub lo monta, le cede la pantalla y vuelve al salón con Escape.

## Lo que se sabe y lo que falta

- **Coste por fotograma** (escena entera: mano, mesa, sonido, golpe recibido, pintar e interfaz),
  partida automática a 72 fps: ~100 µs de media y 0,35–0,53 ms de pico jugando en macOS (M5 Pro,
  QuickJS); con las plantillas release en Docker, 95 µs y 0,8 ms en Linux arm64 y 147 µs y 1,1 ms
  en Linux x86_64 emulado. El único fotograma caro es el del final (6–7 ms en macOS): escribe el
  guardado en disco y monta el panel.
- **La misma semilla no da la misma partida en todas las plataformas**: la mesa es caótica y las
  funciones de `Math` (`hypot`, `atan2`…) salen de la libm de cada sistema, así que la partida
  automática acaba 7–1 en macOS y Linux arm64 y 7–0 en Linux x86_64. Dentro de una plataforma se
  repite exacta. Para el reto entre plataformas, la semilla iguala las decisiones de la máquina,
  no cada rebote.
- **La puntería de la interfaz solo lleva los botones que se ven** (`apuntables` en
  `interfaz.ts`): la del kit repinta cada fotograma todos los que tiene, y con los treinta de este
  juego la interfaz costaba más que la mesa (105 µs de 170).
- **El tutorial del kit se agranda 1,2 veces**: trae las letras de Hole Patrol (contador a 30 mm)
  y aquí va sobre la mesa, donde la web subió el suyo a 36 mm.
- **No está**: el roce del disco (un sonido continuo; el render del kit solo sabe de disparos), las
  ayudas de `lib/ayudas.ts` (huellas, mazo fantasma), la sala de la web alrededor (aquí, solo el
  suelo), el decorado en tu habitación, la subida de la interfaz con la estatura (`XRUiHeight`) y
  el mando de verdad en la mano en el tutorial.
- **Lo que solo puede decir el visor**, además de lo de `salir-en-steam.md` 4.2 y 4.3: que el mazo
  se coja al acercar el puño al pomo (18,6 cm desde el pomo, en 3D; la web mide solo en el plano de
  la mesa), que golpear con la mano se sienta como en la web, que la cuenta atrás parada en el 1
  con el aviso se entienda, que el golpe recibido del gol en contra no maree con el confort normal,
  y la vibración del final (0,6 durante 220 ms).
