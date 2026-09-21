# Glide Hockey

Hockey sobre colchón de aire contra la máquina, en 3D y en el navegador. Se
elige el nivel y a cuántos goles se juega, y se mueve el mazo con el ratón —o con
el rayo del mando si se juega con el visor—. Cada gol suma puntos y cada gol
encajado los resta.

Es un juego de **xrcade**: se monta dentro del salón inmersivo del hub, no se
enlaza. Esta web es uno de sus anfitriones, el que permite probarlo con el visor
sin levantar el hub entero.

Se llamó `air-hockey` hasta el cambio de nombres
(`xrcade/docs/nombres-y-marcas.md`): «AIR-HOCKEY» sigue registrada a nombre de
Brunswick, y aunque hoy el término se comporte como descriptivo, una cabina
rotulada es justo donde deja de serlo. El nombre cambió entero —repositorio,
paquete, exportaciones y claves de almacenamiento—, y lo que hubiera guardado con
las claves viejas se traslada solo la primera vez que se juega
(`src/lib/legacyKeys.ts`). El mueble se sigue llamando mesa de air hockey en los
comentarios: ahí es el objeto, no el producto.

## Cómo se juega

| | |
| --- | --- |
| **Prueba** | Eliges nivel (de Fácil a Imposible) y a cuántos goles se juega, de 3 a 15. Perder no cuesta nada. |
| **Reto** | Se empieza por lo más fácil y la escalera va apretando: primero partidas más largas y después más nivel. Cada partida ganada encadena la siguiente; la primera que pierdas se acabó. |

La puntuación premia marcarle a un nivel alto y encadenar goles sin encajar. Un
gol en contra descuenta y corta la racha. El récord de cada modo se guarda en el
navegador.

## Ponerlo en marcha

```sh
nvm use          # la versión exacta está en .nvmrc
npm install
npm run dev      # http://localhost:3000
```

Para probarlo con el visor hace falta HTTPS, porque WebXR solo arranca en un
contexto seguro:

```sh
npm run dev:https
```

## Verificación

```sh
npm run lint
npm run typecheck
npm test          # unitarios: la física, la máquina, el estado y el paquete
npm run test:e2e  # navegador, contra el build de producción
```

Los tests de navegador se sirven en el puerto de `PORT` (o `E2E_PORT`), no en el
3000.

## Cómo está montado

```
src/
  lib/          La lógica, en funciones puras y probables sin navegador:
                la física del disco, la máquina rival, la escalera del reto,
                la puntuación y el estado de la partida.
  components/
    game/       La escena de three: la mesa, el disco, los mazos y el bucle.
    ui/         El menú y el marcador de escritorio (DOM).
    xr/         Sus equivalentes dentro del visor, que son geometría.
  game/         Lo que se publica: la escena, el juego con su Canvas y el
                montador para quien no usa React.
  app/          La web que envuelve al juego. No es el juego.
```

La separación no es decorativa: **lo que se publica es una escena**, objetos de
three que se pintan dentro del Canvas de otro. Quien es dueño del Canvas es
dueño de la sesión de WebXR, y ese es el anfitrión. El contrato completo está en
[`docs/xrcade.md`](docs/xrcade.md) y cómo montarlo, en
[`docs/montar-el-juego.md`](docs/montar-el-juego.md).

Tres cosas que el juego no hace, y que no son casualidad:

- **No sale a la red.** Ni CDN, ni fuentes remotas, ni telemetría: la política de
  seguridad del salón lo bloquea y un visor sin internet, también.
- **No usa WebAssembly.** La física del disco son fórmulas, no un motor: los del
  ecosistema de R3F van en wasm y la CSP del salón los rechaza.
- **No mueve al jugador.** Coloca la mesa a su alrededor, que es lo que permite
  montarlo en un salón que ya lo ha situado.

## Licencia

MIT. Los ficheros de `public/` vienen de fuera y llevan su propia licencia: ver
[`public/CREDITS.md`](public/CREDITS.md).
