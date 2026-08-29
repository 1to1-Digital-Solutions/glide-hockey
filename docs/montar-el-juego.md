# Montar Air Hockey dentro de otra aplicación

Air Hockey se publica como **paquete**, y lo que exporta es una **escena**:
objetos de three que se pintan dentro del `<Canvas>` del anfitrión. Quien es
dueño del Canvas es dueño de la sesión de WebXR, y ese es el anfitrión — nunca
el juego. El porqué está en [`xrcade.md`](./xrcade.md).

Hay dos formas de montarlo, y la que toque depende de si ya hay un Canvas.

## Dentro de un Canvas que ya existe: `<AirHockeyScene>`

Es lo que hace el salón de xrcade. No crea Canvas, no abre ni cierra la sesión
y no pinta una sola etiqueta de DOM.

```tsx
import { AirHockeyScene } from 'air-hockey'

<Canvas>
  <XR store={store}>
    <XROrigin position={[0, 0, 0]} />
    <AirHockeyScene
      assetsBase="/juegos/air-hockey/"
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
copia `air-hockey-assets` en `<assetsBase>/webxr-profiles/`—. Por defecto
@react-three/xr los descarga de un CDN, y bajo la política de seguridad del
salón eso deja al jugador sin mandos: sin rayo no se mueve el mazo ni se pulsa
nada.

**La mesa se planta donde esté el jugador y encarada hacia donde mire**, una vez
al empezar la sesión (ver `components/game/WorldAnchor.tsx`). El juego no pone
`<XROrigin>`: mueve su decorado, no al jugador.

## Con su propio Canvas: `<AirHockey>`

Para una página web normal que quiera una pantalla de juego. Trae el Canvas, la
sesión de WebXR, el menú 2D y el botón de entrar al visor.

```tsx
import { AirHockey } from 'air-hockey'

<div style={{ height: '100dvh' }}>
  <AirHockey assetsBase="/juegos/air-hockey/" />
</div>
```

Ocupa lo que mida su contenedor, así que hay que darle altura. Aquí `onExit` no
existe: salir es cerrar la sesión, porque no hay ningún sitio al que volver.

Para quien no renderiza React por su cuenta está
`mountAirHockey(elemento, opciones)`, que devuelve un `{ unmount() }`.

## Los tres pasos que hay que dar sí o sí

### 1. Copiar los ficheros estáticos

Los perfiles de mando de WebXR no viajan en el código: el navegador los pide por
HTTP al entrar en el visor. Sin ellos, @react-three/xr no llega a registrar
ningún mando y el jugador se queda sin rayo con el que apuntar.

```sh
npx air-hockey-assets public/juegos/air-hockey
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
@source "../node_modules/air-hockey/src";
@import "air-hockey/styles.css";
```

`styles.css` es cómo el juego usa sus colores y las animaciones de sus
pantallas. Todo cuelga de la clase `.air-hockey`, así que no le cambia el
aspecto a nada del anfitrión: los valores de la paleta los pone el propio juego
sobre su contenedor, y son los mismos que usan la escena y la interfaz del visor
(`src/lib/palette.ts`).

Montando solo `<AirHockeyScene>` —dentro de un Canvas— no hace falta nada de
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
  geometría generada en código, así que lo único que hay que copiar son los
  perfiles de mando.
- **El jugador se queda donde lo puso su anfitrión.** El juego coloca su mesa
  alrededor de él y no pone `<XROrigin>`.

## Almacenamiento que usa

Dos claves en `localStorage`, sin nada que identifique a nadie:

| Clave | Qué |
| --- | --- |
| `air-hockey:best-points` | El récord del modo prueba. |
| `air-hockey:best-points:challenge` | El récord del modo reto. |

Si el almacenamiento está bloqueado (ventana privada, política del navegador),
el juego funciona igual: se juega sin récord.
