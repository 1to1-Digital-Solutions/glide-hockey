# Montar Glide Hockey dentro de otra aplicación

Glide Hockey se publica como **paquete**, y lo que exporta es una **escena**:
objetos de three que se pintan dentro del `<Canvas>` del anfitrión. Quien es
dueño del Canvas es dueño de la sesión de WebXR, y ese es el anfitrión — nunca
el juego. El porqué está en [`xrcade.md`](./xrcade.md).

Hay dos formas de montarlo, y la que toque depende de si ya hay un Canvas.

## Dentro de un Canvas que ya existe: `<GlideHockeyScene>`

Es lo que hace el salón de xrcade. No crea Canvas, no abre ni cierra la sesión
y no pinta una sola etiqueta de DOM.

```tsx
import { GlideHockeyScene } from 'glide-hockey'

<Canvas>
  <XR store={store}>
    <XROrigin position={[0, 0, 0]} />
    <GlideHockeyScene
      assetsBase="/juegos/glide-hockey/"
      onExit={() => volverAlSalon()}
    />
  </XR>
</Canvas>
```

| Prop | Qué |
| --- | --- |
| `assetsBase` | De dónde cuelgan los ficheros estáticos del juego en este anfitrión. Sin ella, la raíz del sitio. |
| `onExit` | Devolver al jugador a donde estaba. Lo llama el juego desde su menú inmersivo; **qué significa volver lo decide quien monta**. |

`onExit` es obligatoria a propósito: en el salón, cerrar la sesión sería
arrancarle el visor al jugador en vez de devolverlo al arco de cabinas.

El store también es del anfitrión, y con él los perfiles de mando: hay que
crearlo con `baseAssetPath` apuntando a los perfiles que sirva —valen los que
copia `glide-hockey-assets` en `<assetsBase>/webxr-profiles/`—. Por defecto
@react-three/xr los descarga de un CDN, y bajo la política de seguridad del
salón eso deja al jugador sin mandos: sin rayo no se mueve el mazo ni se pulsa
nada.

**La mesa se planta donde esté el jugador y encarada hacia donde mire**, una vez
al empezar la sesión (ver `components/game/WorldAnchor.tsx`). El juego no pone
`<XROrigin>`: mueve su decorado, no al jugador.

### El reto y el aviso de fin de partida

Dos props opcionales, en la escena y en `<GlideHockey>` (y en `mountGlideHockey`,
que le pasa sus opciones), y una tercera, `objetivo`, solo en la escena; sin ellas el juego es
el de siempre.

- **`reto?: Reto`** (`{ semilla }`, un entero de 32 bits): la partida del reto
  del día o de «reta mi puntuación». Con él la escena **no abre el menú: entra
  ya en el reto** (`challenge`, que se acaba con la primera partida perdida),
  que es el modo del récord (`glide-hockey:best-points:challenge`), con su
  cuenta atrás y esperando, como siempre en el visor, a que se coja el mazo. No
  hay ajustes que fijar: el nivel de la máquina y los goles de cada ronda los
  pone la escalera del reto, no el menú. **No hay tutorial**: su demostración
  retrasa el saque solo a quien no la ha visto. **Los tiros de la máquina salen
  de la semilla**: el plan de cada golpe es un hash de la mesa, la jugada y el
  golpe, y la mesa de cada ronda es `semillaDe(semilla, ronda)`
  (`semillaDeLaMesa` en `lib/opponent.ts`), así que perder goles en una ronda
  no cambia los tiros de la siguiente. El resto de la mesa es física en pasos
  fijos, sin azar. El reto se lee al montar; para otro, se monta otra escena.
- **`onTerminar?: (resultado: Resultado) => void`**: se llama **una vez** al
  acabar cada partida —prueba, niveles o reto—, justo donde se guarda el
  récord, con `{ modo, puntos, reto }`: el modo (`practice`, `levels`,
  `challenge`), los puntos de la partida aunque no sean récord y `reto: true`
  solo en la partida del `reto`. «Otra partida» después ya es una normal, con
  la máquina de siempre y `reto: false`. Dejarla a medias (volver al menú o
  salir) no la cuenta; la prueba sin fin sí, al terminarla con su botón, que
  es su final.
  El duelo a dos **no se cuenta**: sus goles son de dos personas, no de quien
  lleva el visor, y no tiene récord.
- **`objetivo?: Objetivo`** (el tipo de `src/lib/objetivo.ts`, exportado por el paquete; solo en
  `<GlideHockeyScene>`): `{ medallas: { bronce, plata, oro }, mejorEs: 'mas' | 'menos', unidad,
  record, modo }`. Con él, el **cartel de encima del marcador del fondo** dice qué hay que
  superar: en la primera cuenta atrás, la misión y los tres listones; jugando, el listón que
  falta, lo que se lleva, la ronda y lo que vale el próximo gol; al acabar, lo que faltó. `modo`
  es el modo del que salen las medallas (`challenge`): en cualquier otro, el cartel dice que la
  partida no cuenta para medalla. Sin la prop, en el reto dice la misión y el récord guardado en
  este navegador. `unidad` llega ya en el idioma de quien juega. El menú abre siempre en el reto.

```tsx
<GlideHockeyScene reto={{ semilla: 20260925 }} onTerminar={apuntarPartida} onExit={volverAlSalon} />
```

## Con su propio Canvas: `<GlideHockey>`

Para una página web normal que quiera una pantalla de juego. Trae el Canvas, la
sesión de WebXR, el menú 2D y el botón de entrar al visor.

```tsx
import { GlideHockey } from 'glide-hockey'

<div style={{ height: '100dvh' }}>
  <GlideHockey assetsBase="/juegos/glide-hockey/" />
</div>
```

Ocupa lo que mida su contenedor, así que hay que darle altura. Aquí `onExit` no
existe: salir es cerrar la sesión, porque no hay ningún sitio al que volver.

Para quien no renderiza React por su cuenta está
`mountGlideHockey(elemento, opciones)`, que devuelve un `{ unmount() }`.

## Los tres pasos que hay que dar sí o sí

### 1. Copiar los ficheros estáticos

Los perfiles de mando de WebXR no viajan en el código: el navegador los pide por
HTTP al entrar en el visor. Sin ellos, @react-three/xr no llega a registrar
ningún mando y el jugador se queda sin rayo con el que apuntar.

```sh
npx glide-hockey-assets public/juegos/glide-hockey
```

Y luego se le dice al juego dónde han quedado con `assetsBase`. **Dos juegos en
el mismo origen se pisarían** si los dos colgaran de la raíz, y por eso la ruta
es una decisión del anfitrión y no del juego.

Vuelve a ejecutarse al subir de versión: es idempotente y deja el destino con
los ficheros de la versión nueva.

### 2. Incluir el juego entre las fuentes de Tailwind

El menú y el marcador en 2D usan clases utilitarias que Tailwind genera
escaneando el código. Si el anfitrión no mira dentro del paquete, el juego se
monta sin estilos.

```css
@import "tailwindcss";
@source "../node_modules/glide-hockey/src";
@import "glide-hockey/styles.css";
```

`styles.css` es cómo el juego usa sus colores y las animaciones de sus
pantallas. Todo cuelga de la clase `.glide-hockey`, así que no le cambia el
aspecto a nada del anfitrión: los valores de la paleta los pone el propio juego
sobre su contenedor, y son los mismos que usan la escena y la interfaz del visor
(`src/lib/palette.ts`).

Montando solo `<GlideHockeyScene>` —dentro de un Canvas— no hace falta nada de
esto: ahí el juego no pinta DOM.

### 3. No duplicar React ni three

React y three van en `peerDependencies`, **nunca** en `dependencies`. Dos copias
de React rompen los hooks y dos de three, la escena. Es el fallo caro porque no
rompe el build: rompe la partida.

## Lo que el juego da por sentado

- **Nada de red.** El juego no se conecta a ningún sitio: sin servidor, sin
  telemetría y sin marcas ajenas. El récord vive en el `localStorage` del
  navegador.
- **Nada de WebAssembly.** La física del disco es un puñado de fórmulas
  (`src/lib/puckPhysics.ts`), no un motor: los del ecosistema de R3F van en wasm
  y la política de seguridad del salón los bloquea.
- **Nada de fuentes remotas.** Los números del visor se dibujan con segmentos
  (`src/lib/xrDigits.ts`), porque `<Text>` de drei descarga la fuente de un CDN.
- **Nada de ficheros de audio ni de modelos.** La mesa, el disco y los mazos son
  geometría generada en código, y el golpe, el rebote y el gol se sintetizan con
  la Web Audio API (`src/lib/audioEngine.ts`), así que lo único que hay que
  copiar son los perfiles de mando.
- **Un `AudioContext`, y del juego.** Se abre con el primer sonido de la partida
  y se cierra al desmontar la escena, así que volver al salón no deja el audio
  del sistema agachado. Quien juega puede silenciarlo desde el menú, y entonces
  no se abre ninguno.
- **El jugador se queda donde lo puso su anfitrión.** El juego coloca su mesa
  alrededor de él y no pone `<XROrigin>`.

## Almacenamiento que usa

Cuatro claves en `localStorage`, sin nada que identifique a nadie:

| Clave | Qué |
| --- | --- |
| `glide-hockey:best-points` | El récord del modo prueba. |
| `glide-hockey:best-points:challenge` | El récord del modo reto. |
| `glide-hockey:duel-tally` | Los duelos ganados por cada uno de la pareja y los empatados (`{ wins: [n, n], ties: n }`). No es un récord. |
| `glide-hockey:muted` | Si el jugador dejó el juego callado (`1`) o sonando (`0`). |

El escenario —la sala o la habitación de quien juega— **no** es suyo: es `xrcade:scenery`, la
misma clave que escribe el salón (`place` o `room`, y `place` si no hay nada). Los menús del
juego lo pueden cambiar, pero escriben esa clave: hay una sola preferencia, y fuera del salón
funciona igual en el origen de la web del juego. La clave propia del juego,
`glide-hockey:scenery`, no la escribe nadie: se borra al montar el estado de la partida, sin
trasladarla (ver `src/lib/ajustes.ts` y `src/lib/scenery.ts`).

La mano buena del salón (`xrcade:hand`) **no la lee**: el mazo se coge con la mano que esté
libre y se cambia de mano a media partida (`MalletHand`), así que no importa cuál sea la
buena y ninguno de sus menús la pregunta. Si algún día el juego necesitara una mano, la lee de
esa clave con `useHand()`, como el escenario, en vez de preguntarla en su menú.

Sus dos menús —el de la web y el del visor— **empiezan por el modo, y solo la práctica
pregunta**: en ella se eligen el nivel de la máquina y los goles; en niveles solo qué nivel
desbloqueado se juega, y en el reto nada, porque la escalera ya los pone. En el duelo
tampoco: los dos juegan lo mismo (`DUEL_SETUP` en `src/lib/duel.ts`).

Si el almacenamiento está bloqueado (ventana privada, política del navegador),
el juego funciona igual: se juega sin récord y sonando.
