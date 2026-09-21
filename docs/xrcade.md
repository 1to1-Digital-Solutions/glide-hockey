# glide-hockey dentro de xrcade

Este juego se desarrolla en su propio repositorio y el salón de
[xrcade](https://github.com/1to1-Digital-Solutions/xrcade) lo instala por tag y lo **monta
dentro de sí mismo**. No se enlaza: WebXR concede una sesión inmersiva por documento, así que
cruzar a otra pestaña o a otro dominio la termina — entrar a jugar quitándose el salón y volver
quitándose el visor.

## Publica una escena, no una aplicación

Lo que el paquete exporta es una **escena**: un componente que se pinta dentro del `<Canvas>`
que ya está montado. Quien es dueño del Canvas es dueño de la sesión, y ese es el anfitrión.

```tsx
export type GameSceneProps = {
  /** De dónde cuelgan los ficheros estáticos del juego en este anfitrión. */
  assetsBase: string
  /** Devolver al jugador a donde estaba. Lo llama el juego desde su interfaz. */
  onExit: () => void
}
```

La escena **no**:

- crea `<Canvas>` ni `XRStore`, ni llama a `enterVR()`, `enterAR()` o `session.end()`;
- pone `<XROrigin>` — el sitio del jugador lo decide el anfitrión, así que el juego coloca su
  mundo alrededor de donde esté, corriendo el decorado en vez de mover al jugador;
- pinta DOM — dentro de un Canvas solo caben objetos de three, así que el menú y el marcador en
  2D se quedan en la web del juego y sus equivalentes inmersivos son geometría.

`onExit` es cómo el juego devuelve al jugador sin decidir a dónde: en su propia web puede ser
cerrar la sesión; en el salón es volver al arco de cabinas.

## Su propia web es un anfitrión más

El repositorio se parte en dos: **el juego** (la escena) y **su web**, que pone el Canvas, la
sesión y el botón de entrar al visor alrededor de esa misma escena. No es simetría gratuita: es
cómo se prueba el juego con el visor sin levantar el hub, y lo que hace que romper el contrato
se note aquí y no en el salón.

## Lo que exige el `package.json`

`npm run catalog:validate` de xrcade lo comprueba al dar el alta, así que fallar aquí es no
poder publicarse:

| Campo | Qué |
| --- | --- |
| `exports` | Con entrada por defecto (`"."`). Sin ella el hub no puede importarlo. |
| `peerDependencies` | React, three y `@react-three/*`. **Nunca** en `dependencies`: dos copias de React rompen los hooks, y dos de three, la escena. Es el fallo caro, porque no rompe el build — rompe la partida. |
| `files` | Solo lo que se publica. |
| `sideEffects` | `["*.css"]` si hay estilos, para que el empaquetador del anfitrión no se los coma. |
| `bin` | Un ejecutable que copie los ficheros estáticos al `public/` del anfitrión, con rutas relativas a `assetsBase`. Dos juegos en el mismo origen se pisarían. |

## Lo que la CSP del salón NO deja usar

El salón se sirve con una política de seguridad cerrada y un juego montado dentro la hereda
entera. Dos cosas que se dan por hechas al elegir librerías y aquí no funcionan:

| Bloqueado | Qué descarta | Salida |
| --- | --- | --- |
| `script-src` sin `'wasm-unsafe-eval'` | **WebAssembly**: compilar un módulo wasm lanza. Se lleva por delante los motores de física del ecosistema de R3F que van en wasm (Rapier, Jolt), que son justo los primeros a los que se tira. | Un motor en JavaScript puro (`cannon-es`), o aflojar la CSP del hub. |
| `connect-src 'self'` | Cualquier conexión a otro origen: WebSocket, fetch a una API, telemetría. Descarta el multijugador en red tal cual. | Servirlo desde el propio xrcade, o aflojar la CSP del hub. |

Ninguna de las dos rompe el build ni se nota en local, donde el juego se prueba con una CSP más
laxa: revientan al montarlo en el salón, con la primera versión ya escrita. Elige el motor con
esto delante.

## Publicar

Se consume **por tag**, nunca por rama: `vX.Y.Z` acompañando a la `version` del
`package.json`. Actualizarlo en el salón es `npm run game:update -- <id>` desde xrcade, o el
panel de juegos de Organízate.

Dar de alta el juego pide además dos líneas a mano en el hub —el registro de montadores y un
`@source` para Tailwind—: importar un módulo es código y el catálogo son datos.
