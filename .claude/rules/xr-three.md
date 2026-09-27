---
paths:
  - "src/components/**"
  - "src/game/**"
  - "src/lib/**"
  - "src/shaders/**"
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "e2e/**"
  - "scripts/**/*.test.ts"
---

# Juegos de xrcade: three, WebXR y sus tests

Se carga al tocar código de escena o tests. Lo que vale siempre está en `.claude/rules/xr.md`.

## Trampas de three y de WebXR que ya costaron una tanda

Todas se descubrieron con el visor puesto y **ninguna se ve desde una pantalla quieta**. Un
juego nuevo no tiene por qué volver a encontrárselas.

- **Un material transparente escribe profundidad.** `transparent` en three no implica
  `depthWrite={false}`: un plano transparente del tamaño del panel —el lienzo con el texto
  encima de las placas— **borra todo lo que queda detrás**, y lo que se ve es un botón sin
  color, como apagado. Reportado como «el botón de play no se ve en azul, está como
  sombreado», y estuvo en los trece a la vez. Todo overlay transparente lleva
  `depthWrite={false}`; el diagnóstico rápido es meter una placa de color a distintos `z` y
  ver entre cuáles desaparece.
- **Y en un panel, el orden en que se pintan sus capas NO se puede deducir: se declara.** Es
  la segunda mitad de lo anterior y costó otra tanda. three pinta lo transparente de lejos a
  cerca ordenando por la profundidad **del origen de cada objeto**, no de cada píxel. Un panel
  es un montón de planos a milímetros unos de otros, así que esa ordenación la decide **hacia
  dónde se mira**: de frente al centro del panel, un realce 5 mm por delante sale más cerca y
  se pinta el último, que es lo correcto; pero **apuntar un botón es mirarlo**, la cabeza se
  inclina hacia él, y un botón a medio metro del centro pasa a estar *más lejos por el eje de
  la vista* que el centro de la placa. El orden se da la vuelta, el realce se pinta primero y
  —escribiendo profundidad— borra la placa entera dentro de su rectángulo: la cara del botón,
  su color y su letra, que van todas en el lienzo. Queda un agujero con forma de botón por el
  que se ve la escena. Reportado con el visor puesto: «al poner el cursor encima de un botón
  es como que el botón desaparece, mostrando lo que hay por debajo». Que dependa de la mirada
  es lo que lo hacía parecer caprichoso —«y a veces también al pulsarlo»—. Hacen falta **las
  dos cosas**: `depthWrite={false}` para que ninguna capa borre a otra, y `renderOrder` para
  fijar el orden (fondo → realce de detrás → placa → realce de delante). Quitar solo el
  `depthWrite` tapa el agujero y deja el otro medio fallo: mirando al botón, la placa se pinta
  encima del realce y apuntar deja de notarse. La escalera va en `PANEL_ORDER`
  (`components/xr/buttonHighlight.tsx`, el mismo fichero en los trece), y el test que lo caza
  no mira el DOM —React no pinta los booleanos de una etiqueta que no conoce, así que ahí
  `depthWrite` no aparece y el fallo pasaría por bueno— sino el árbol que recibe R3F.
- **Un botón que contesta se hunde; no basta con que se encienda.** Apuntado crece y se
  enciende; **pulsado encoge por debajo de su tamaño de reposo y cambia de color**, que a un
  metro se lee como que se mete hacia dentro. Y el estado de pulsado se limpia también al
  salirse del botón, no solo al soltar: apuntando a pulso el rayo se va del botón sin soltarlo,
  y un botón que se quedara hundido para siempre es peor que uno que no se hunde.
- **Dos superficies que acaban en el mismo plano parpadean, y solo con el visor.** No es el
  caso de los calcos —para eso está `polygonOffset`—, es el empate exacto: un cilindro que
  acaba en `z = 0` y un círculo en `z = 0`. En una pantalla quieta el empate se resuelve
  siempre igual y no se nota; con el visor **cada ojo y cada fotograma lo resuelven de otra
  manera** y la superficie hierve. Medio milímetro deshace el empate sin que se note de lado.
- **`lookAt` recibe un punto del MUNDO y orienta el `+Z`.** Pasarle coordenadas locales
  funciona mientras el objeto cuelgue de la raíz y deja de funcionar en cuanto alguien lo
  mete en un grupo girado —que es justo lo que hace anclar el decorado—. Y orienta el `+Z`,
  no el eje del modelo: una flecha modelada a lo largo del `-Z`, o un trazo a lo largo del
  `Y`, quedan cruzados. Para apuntar un modelo por su propio eje,
  `setFromUnitVectors(ejeDelModelo, rumbo)`, y el rumbo sale de restar dos puntos **del mismo
  espacio**.
- **En el espacio del puño lo empuñado va por el `−Z`, hacia el pulgar.** Lo dice la
  especificación de WebXR (`gripSpace`), lo confirman las matrices de Quest 3 del emulador y el
  `.glb` del mando (su eje largo es Z, con la palanca y los botones hacia `−Z`); el `+Y` sale
  hacia la cara de quien juega. **Todo lo que se empuña sale hacia `−Z`**, como sale de un puño
  de verdad por el lado del pulgar; lo que cambia es adónde se apunta el mando: un bate o una
  raqueta, hacia arriba; un putter, hacia el suelo, como su empuñadura. La regla decía `+Y`
  para lo empuñado y `−Y` para lo que cuelga: un bate girado así se dibujaba atravesado respecto
  de las manos («se coge por la parte inferior») y un putter colgado del `−Y` quedaba
  perpendicular al mango, de modo que un giro de muñeca barría la cabeza de lado y la bola salía
  torcida. Lo miden con datos del emulador `batting-cage/src/lib/agarreDelBate.test.ts` y, con
  el `.glb` del mando, `minigolf/src/lib/palo.test.ts`. Y el espacio del **rayo** no es ese:
  está girado unos 45° respecto del puño, así que colgar de él lo que debería quedar a plomo lo
  deja inclinado. **Lo que se sostiene cuelga del puño, aunque lo que importe sea hacia dónde
  apunta**: el arco colgaba del rayo, «porque lo que importa es apuntar», y salía picado 45°
  hacia atrás con la flecha mirando al cielo. Del rayo cuelga el rayo. Y esto **no se ve con el
  emulador**, que entrega los mandos sin girar: sin girarlos, el rayo y la vertical coinciden y
  el test pasa. Hay que medirlo con las matrices de un Quest de verdad (`iwer`), como
  `bow-shooting/src/lib/agarreDelArco.test.ts`.
- **La mano que sostiene no se espeja sola.** La especificación invierte el criterio del eje X
  según la mano —el dorso de la derecha va a `+X` y el de la izquierda a `−X`—, así que dos
  posturas en espejo dan el mismo giro de puño. Lo que va en la mano se espeja a mano y se mide
  para las dos: en el arco faltaba, y la flecha quedaba del lado equivocado del asta.
- **Lo que se dibuja en la mano lo monta la escena, no el store.** Un mando o un guante que se
  engancha en el `controller` del `XRStore` propio del juego solo existe en su web: dentro del
  salón el store es del salón y ese componente no se monta nunca. Se coloca desde la escena
  con `useXRInputSourceState` y el `gripSpace`, deshaciendo la matriz del padre, como
  `MandoDeVerdad.tsx`. Y sus ficheros van **fuera de `webxr-profiles/`**: el salón borra esa
  carpeta de cada juego al instalarlo, porque los perfiles de mando los sirve él.
- **Lo que va en la mano no puede colgar del anclaje del decorado.** WebXR da las manos en el
  espacio del origen que pone el anfitrión; dentro del grupo anclado se le suma el giro del
  mundo y aparece en otro sitio. Se monta fuera **o** se le deshace la matriz de sus padres
  —`matrix = padre.matrixWorld⁻¹ · matrizDelEspacio`—, que es lo que deja colocar algo en la
  mano sin importar de dónde cuelgue en el árbol. **Vale igual para `XRWorldHeight`**, que baja
  el mundo entero a la altura de juego: sacar algo del anclaje pero dejarlo dentro de ese grupo
  lo pinta, sentado, 40 cm por debajo del mando (le pasó a la pistola de skeet y al arco). Y lo
  que copia la cámara —un cielo que la sigue, una cinta que mira al ojo— toma
  `camera.getWorldPosition()` y la pasa al espacio de su padre (`parent.worldToLocal`), nunca
  `camera.position` a pelo: el cielo de skeet quedaba a metro y medio de la cabeza.
- **El mando de verdad se puede enseñar, y es la mejor forma de decir qué botón se aprieta.**
  El paquete de perfiles trae el `.glb` de cada mando; copiando solo los de Quest son 1,7 MB.
  Puesto en el espacio del puño queda exactamente encima del que se tiene en la mano. Dos
  cosas que no se adivinan: el nodo que nombra el perfil (`visualResponses[].valueNodeName`)
  es el **pivote** sobre el que gira el botón y en los mandos de Quest está a dos centímetros
  y medio de él —lo que hay que marcar es la **caja de lo que cuelga de ese nodo**—, y la
  textura viaja dentro del `.glb`, así que hace falta `connect-src blob:` en la CSP o el
  mando sale en negro. Un mando sin modelo copiado no puede romper nada: no se monta y queda
  el dibujo.
- **Una cuenta atrás que espera algo tiene que decir qué espera.** Un número que se queda
  clavado en el 1 porque falta coger el mazo se lee, desde dentro, como que el juego se ha
  colgado. Lo mismo vale para cualquier espera: se dice con una frase **y** se enciende el
  botón que la resuelve.
- **Una forma invisible que atrapa los disparos se come el rayo.** El salón pone en cada mano,
  además del rayo, un puntero de agarre esférico. En `@pmndrs/pointer-events` una esfera que
  queda **dentro** de la caja de un objeto con manejadores cuenta como tocada a distancia cero,
  y gana el puntero más cercano: una esfera gigante alrededor del jugador para recoger los
  disparos al aire deja el rayo sin nada que señalar, y no hay forma de abrir los ajustes ni de
  salir. Así se rompió skeet entero. Todo lo que envuelve al jugador y solo espera el rayo
  lleva `pointerEventsType={{ deny: ['grab', 'touch'] }}`, y un test con la librería de verdad
  comprueba que el rayo sigue llegando al menú.
- **La salida se dibuja igual en los trece, y va en el mismo sitio.** Llegó a haber cinco
  dibujos: un cuadrado, una X, la palabra «Exit», «Leave» y un icono propio. Con el visor
  puesto, la pregunta «¿cuál era el de salir?» se repite en cada cabina. Es una flecha de
  volver, la misma forma (`FLECHA_DE_SALIR` en `canvasPanel.tsx`), en el panel dibujado y en
  la geometría.
  **Unificar el dibujo no bastó**: seguía cambiando de sitio de un juego a otro —nueve la
  tenían al final de la fila de abajo, tres en la punta izquierda de esa fila y uno a media
  altura, en una columna lateral—, y con las gafas puestas eso se nota igual: «el botón para
  salir debería estar siempre en el mismo sitio en el menú de config». Va en la **esquina de
  abajo a la derecha** del panel de ajustes: al final de la fila de las acciones, la misma que
  lleva empezar. Por dos razones, y ninguna es estética: es donde ya estaba en nueve de los
  trece —mover cuatro deja intacto lo que ya se sabe de memoria—, y es la fila que se está
  mirando al acabar de elegir, así que salir no obliga a recorrer el panel con el rayo. Fuera
  de esa fila se cruza con lo que se está eligiendo y se pulsa sin querer.
  La regla la escribe `lib/exitCorner.ts` —el mismo fichero en los trece— y, como el
  instrumento que mide la legibilidad, **devuelve frases y no un `false`**: qué botón de su
  fila le queda más a la derecha, qué botón tiene por debajo, por qué borde se sale. Cada juego
  le pasa el reparto de su panel desde su propio test de disposición. Mover la salida a esa
  esquina puede pedir **reflejar la fila entera** en vez de cambiar un botón de sitio: así las
  distancias entre sus botones —que es lo que evita pulsar uno por otro apuntando a pulso— se
  quedan como estaban.

## Lo que aprendieron los tests

- **Una jugada sin desenlace es un juego colgado.** Todo camino de la simulación tiene que
  terminar, y un plazo de seguridad no es un desenlace: en table-tennis la pelota posada en la
  mesa devolvía el 82 % en cada bote, así que botaba para siempre —1.723 botes en 30 s de
  reloj medidos— y la jugada solo se cerraba al agotarse el plazo de treinta segundos, que
  desde dentro se lee como que el juego se ha colgado. El test que lo caza recorre cada final
  posible —posada, rodando, en la red, fuera de la mesa, soltada y no golpeada— y exige que
  **todos** acaben en un par de segundos, no que acaben alguna vez.
- **El tamaño mínimo de una letra es un ángulo, no un milímetro.** La misma letra a 1,1 m y a
  2,4 m no se lee igual, así que el mínimo se fija en grados de ángulo visual
  (`MIN_ANGULO`) y el instrumento lo traduce a metros con la distancia a la que se planta ese
  panel. Un panel que se aleja tiene que crecer, y así se ve en el test en vez de en la cara.
- **Encoger para que quepa es una avería silenciosa.** `maxWidth` en un lienzo no parte la
  frase: la **aplasta**, y una etiqueta que se queda en letra de dos centímetros pasa todos
  los tests. El reparto del menú calcula el ancho que pide cada etiqueta (`loQuePide`) y los
  botones de una fila **no miden todos lo mismo**: el ancho se reparte según lo que cada uno
  necesita, y si no cabe, es el reparto el que falla, no el texto el que se encoge.
- **Un e2e no copia a mano un texto de la interfaz.** Renombrar un modo para que cupiera en un
  botón dejó cuatro e2e buscando un botón que ya no existía, y el fallo no fue un error claro
  sino cuatro timeouts de minuto y medio. La etiqueta se importa del código
  (`MODE_LABELS.clock`), y entonces el renombrado se ve al compilar.
- **Lo que se copia entre repos entra en `comunes.py`.** Cualquier fichero nuevo que se
  reparta a mano por los trece —el instrumento que mide, el mando del tutorial, las reglas—
  se añade a su lista en cuanto se reparte, no después: es la única red que avisa de que una
  copia se quedó atrás.

