# Juegos de xrcade (WebXR)

Lo que todos los juegos acabaron necesitando, para no volver a descubrirlo a tropezones. El
contrato de montaje —escena, no aplicación— está en `docs/xrcade.md` del repo; esto es lo demás.

- **Dentro del Canvas no hay letras.** La CSP del salón bloquea las fuentes que `<Text>` de
  drei baja de un CDN. El menú y el marcador inmersivos se dibujan con geometría: iconos por
  forma y color (nunca solo color), y los números con segmentos. Sí hay letras en la web
  del juego, que tiene DOM.
- **El anfitrión manda sobre la sesión y el origen.** Sin `<Canvas>`, sin `XRStore`, sin
  `enterVR`/`session.end`, sin `<XROrigin>`. Los estáticos se leen desde `assetsBase`; el
  perfil de mandos (`webxr-profiles`) lo sirve ya el hub.
- **Sin wasm ni red.** La CSP no compila WebAssembly ni deja conectar a otro origen: nada de
  Rapier/Jolt ni multijugador en red. La física se escribe a mano (parábolas, rozamiento,
  modelos de estabilidad) y se prueba como funciones puras.
- **La lógica es pura y va en `src/lib`.** Puntuación, reglas, trayectorias, estados y
  disposición del menú 3D son funciones sin React ni three, con tests. La escena solo pinta.
- **Un guardián del menú 3D.** Las cajas de contacto de cada botón se declaran en un módulo
  (`xrLayout`/`menuLayout`) y un test comprueba que caben en la placa y no se pisan. Es lo que
  cazó tres botones encima de «salir». No se añade un botón sin su caja.
- **Lo que se recuerda entre visitas va a `localStorage` con clave `<juego>:<qué>`**, a
  través de un módulo que aguanta almacenamiento capado (fallback en memoria) y con lectura
  de servidor para no romper la hidratación. El récord se guarda como entero en texto: el
  salón lo lee por el `record` del manifiesto y lo enseña en la cabina.
- **Mano, silencio y compartir.** La mano dominante y el silencio se eligen en los dos menús
  y se recuerdan. El sonido se sintetiza con WebAudio en UN solo `AudioContext` que se abre
  con el primer sonido; los hápticos salen de las mismas cuentas que el sonido y no obedecen
  al silencio. El resumen se puede compartir (`navigator.share` con copia al portapapeles).
- **Prueba, Reto y récord por modo.** Prueba: se elige la dificultad y fallar no cuesta;
  Reto: escalera automática con tres vidas y sin final. Récord separado por modo. Al volver
  al menú, el título recoge el foco para que el lector de pantalla lo anuncie.
- **Accesible aunque sea 3D.** El marcador se anuncia entero en una región `status` como una
  sola frase; lo dibujado sale del árbol de accesibilidad; los estados se distinguen por
  forma además de color; `prefers-reduced-motion` apaga los balanceos.
- **Tests de extremo a extremo con Playwright y el emulador IWER** (`e2e/support/`,
  empaquetado con esbuild): entrar en sesión, jugar una tanda, salir. El emulador no pulsa
  botones del menú 3D: eso se valida con el visor y se deja como `test.fixme`, no se borra.
  El puerto llega en `PORT` y el e2e lo lee de `E2E_PORT`. Un e2e «anfitrión» monta la
  escena en un Canvas ajeno con `assetsBase` con prefijo.
- **Vitest con una sola copia de three**: `resolve.dedupe: ['three']`,
  `mainFields` con `module` primero y `server.deps.inline: true`; si no, `instanceof` falla
  entre la escena y el test.
- **Lo que solo se juzga con las gafas puestas no se da por bueno desde una pantalla**:
  altura, escala, fotogramas, si un gesto se entiende. Se anota en `ESTADO.md` como pendiente
  de visor con qué mirar y dónde se ajusta.
- **Publicar es un tag** `vX.Y.Z` igual a la `version` del `package.json`; el hub lo instala
  por tag. Antes del tag: typecheck, lint, tests, e2e y el test del contrato del paquete
  (`peerDependencies`, `exports`, `files`).

## El texto del visor se mide, no se mira

**La queja que más se ha repetido en cuatro tandas de pruebas con gafas es la misma**: «el texto
se superpone», «las letras están muy pegadas», «no se entiende nada». Ha pasado en el aviso de
salir, en los menús de ajustes, en el marcador y en los tutoriales. Y siempre se ha descubierto
igual: con el visor puesto, nunca antes.

No es descuido de quien lo escribió. Un panel del visor se pinta en un lienzo que **nadie mira al
tamaño al que se lee**: en el navegador se ve una textura de 1024 píxeles por metro dentro de una
escena 3D, y que dos renglones se pisen o que una etiqueta se salga de su botón no se nota hasta
que se tiene delante de la cara.

Así que no hay regla de estilo, hay un instrumento: `components/xr/legibilidad.ts`, el mismo
fichero en los trece juegos.

- `lienzoQueApunta()` es un lienzo de mentira que **mide como uno de verdad y apunta lo que se
  escribe**: qué texto, dónde y qué caja ocupa, ya en coordenadas del panel.
- `problemasDeLegibilidad(escritos, { panel })` devuelve **frases**, no un `false`: qué palabra se
  pisa con cuál, qué se sale del panel y qué sale por debajo del tamaño mínimo. Un test que solo
  dijera «no se lee» no serviría de nada.

**La regla, entonces:**

1. Toda tarea que **añada o cambie texto** de un panel del visor deja ese panel medido. Si el
   dibujo está dentro de un componente, se saca a una función exportada —`dibujarElAviso(ctx, t)`,
   `dibujarLosNombres(ctx, t, …)`— y se le pasa el lienzo que apunta.
2. Se mide **en los dos idiomas**. El español es más largo que el inglés y es donde se sale: una
   etiqueta que cabe en «Mode» no cabe en «Modo de juego».
3. Se miden también las **variantes**: la fila que cambia de nombre con el modo, el marcador con
   dos cifras y con tres, el nombre más largo de la lista.
4. El ancho de letra que usa la regla va **tirando a ancho** a propósito. Quedándose corta daría
   por bueno lo que en el visor se pisa, que es exactamente lo que ha estado pasando.

Lo que la regla **no** cubre y sigue pidiendo gafas: si el panel está a una distancia cómoda, si
lo tapa el decorado y si el contraste aguanta la luz de la escena. Eso va a
`docs/pendiente-de-visor.md`.

## Lo que enseñó probar con el visor puesto

Nada de esto se ve desde una pantalla, y todo salió de la primera tanda de pruebas con gafas.
Un juego nuevo empieza cumpliéndolo; no es una lista de arreglos, es cómo se hace desde el
principio.

- **La escena va DELANTE de quien entra, y el decorado también.** Al abrir la sesión, lo primero que se ve tiene que
  ser aquello a lo que se juega: la mesa, la diana, la pista. Si el mundo se coloca respecto
  del origen y no respecto de hacia dónde mira quien lleva el visor, la mitad de las veces se
  entra mirando a una pared y hay que darse la vuelta para encontrar el juego. Lo mismo vale
  para el menú: se ancla a la mirada la primera vez, no a un punto fijo del mundo. **No basta
  con colocar la interfaz**: en skeet y en el arco el menú se plantaba delante y el prado y el
  claro se quedaban en el origen, así que los platos y los objetos salían por la espalda. Y hay
  una diferencia entre los dos: la interfaz sigue a la mirada mientras se juega —es un panel al
  que hay que poder volver—, pero el decorado se coloca **una sola vez, al entrar**; un mundo
  que se recoloca solo mientras apuntas es justo lo que hace imposible apuntar.
- **Anclar el decorado crea un espacio nuevo, y hay que traducir lo que lo cruza.** Lo que va en
  la mano cuelga del origen que pone el anfitrión; lo que vuela vive dentro del decorado
  girado. Mientras los dos fueron el mismo espacio no hacía falta nada, y en cuanto uno se mueve
  deja de poder faltar: una flecha que nace en uno y vuela en el otro sale girada exactamente lo
  que se giró el mundo al entrar, así que apuntar bien no sirve de nada. Se traduce con
  `worldToLocal` y el quaternion inverso —no a mano con la posición y el giro del grupo, que
  eso solo vale mientras nadie cuelgue nada por encima— y se prueba sin navegador.
- **El botón de volver, arriba a la izquierda y fuera del juego.** En medio de la escena tapa
  justo lo que hay que mirar y se pulsa sin querer. No es parte de la partida: es la salida.
- **El menú de ajustes desaparece al jugar.** Si sigue puesto durante la partida, compite con
  la pelota por la atención y por los píxeles. Se enseña antes de empezar y al terminar.
- **Un solo panel, y en el mismo sitio en todos los juegos.** Dos placas —una a cada mano—
  obligan a aprenderse cada juego por separado. Quien ya sabe usar uno tiene que saber usar el
  siguiente: mismo sitio, mismo orden, mismos gestos. En la práctica: el menú y el marcador
  **comparten columna** —el marcador a la altura de la vista, lo que se pulsa debajo— y nunca
  están los dos llenos a la vez; sin partida no hay puntos que enseñar y el panel de ajustes
  ocupa la columna entera. Para eso, **el alto del panel sale del reparto y no de una
  constante**: con altura fija, durante la partida queda un metro de placa con dos botones
  perdidos en medio. Y ese alto no puede cambiar al aparecer un botón: mueve el centro, y con
  él los demás botones — que se recoloque uno que no has tocado se lleva por delante la
  pulsación que ya ibas a hacer.
- **Lo que se coge, se coge con la mano.** Agarrar con el gatillo y sostener —como el palo de
  stick-rush— se entiende sin explicación. Mover un objeto con el rayo del mando a distancia
  se siente como manejar un cursor, no como jugar.
- **El gesto se enseña mostrando el objeto.** Al apretar el gatillo, lo que se va a lanzar
  aparece en la mano; al soltar, sale. Sin ver el dardo en la mano no hay forma de saber
  cuándo se ha cogido ni cuándo se suelta.
- **Nada se separa a milímetros: se separa con `polygonOffset`.** Las líneas de una pista, los
  anillos de una diana, los tablones de un suelo —todo lo pintado sobre otra cosa— se ponían uno
  o dos milímetros por delante, y en el navegador basta. Con el visor puesto no: WebXR sirve
  menos bits de profundidad y, a la distancia a la que se juega, un milímetro cae por debajo de
  lo que el búfer distingue. Las dos superficies se pelean fotograma a fotograma y la escena
  **reverbera**, que se lee como «hay algo en medio». `polygonOffset` sesga la profundidad al
  rasterizar, así que no depende de la distancia ni de los bits; y si hay varias capas, cada una
  lleva el suyo. Esto se comprobó en los seis juegos que lo tenían.
- **La iluminación se prueba dentro.** Una escena que en el navegador se ve bien puede
  parpadear con el visor puesto: luces que el decorado recalcula cada fotograma, sombras que
  se recomponen, materiales emisivos peleándose con el tono. Si al entrar la pantalla
  parpadea o no se puede seleccionar nada, es esto —o un error que la escena se está
  tragando— y no se despacha como «cosa del visor».
- **Avisar del sitio real antes de entrar.** Se juega de pie y con los brazos: el hub avisa de
  que se mire alrededor antes de ponerse las gafas. Un juego cuyos gestos barren mucho espacio
  lo dice también en su menú. El visor pinta su propio guardián, pero eso pasa **después** de
  ponérselo, y para entonces ya te has levantado. Se pregunta **una sola vez** —quien juega a
  diario no necesita que le recuerden su salón cada tarde— y después queda una línea junto al
  botón, porque el sitio que había ayer puede estar hoy ocupado por una silla.
- **Idioma y sonido NO se preguntan en el juego.** Se eligen una sola vez en xrcade y viajan
  por `localStorage` y por una cookie (`lib/ajustes.ts`, el mismo fichero en los trece repos).
  El menú del juego es para lo suyo: nivel, dificultad, modo, escenario. Los efectos y el
  ambiente son dos canales con volumen propio, y a cero ni se abre el `AudioContext`. Un
  volumen que solo enciende y apaga **no está cableado**: si el deslizador de ambiente no
  baja la música ni el de efectos llega al nodo maestro, la mitad del ajuste no existe. Y
  cambiarlo no puede rehacer el audio —cerrar el `AudioContext` y abrir otro a cada paso del
  deslizador es un corte de sonido por empujón—: se le dice al nodo maestro y ya.
- **Traducir es del juego entero, no solo del DOM.** La mitad de lo que se lee con el visor
  puesto se pinta dentro del Canvas: en unos juegos es geometría —y entonces no hay nada que
  traducir— y en otros es un lienzo con letras, que sí. Traducir solo la web deja el juego a
  medias justo donde se juega.
- **El texto que sale de `lib/` no se traduce desde fuera.** Un marcador dice «Clavada · 4» o
  «Gana el jugador 1 · 148 a 132»: son plantillas, y traducirlas por trozos obliga al español
  a fingir la sintaxis inglesa. La función que arma la frase recibe el traductor y la compone
  entera, con sus huecos por nombre (`{points}`, nunca por orden). Entra como parámetro **con
  valor por defecto —el inglés—**, y así sus tests siguen leyéndose como lo que comprueban: el
  texto que se canta, no una lista de claves.
- **El código va en inglés hasta donde se lee fuera del repo.** Los comentarios y las
  descripciones de los tests se quedan en el idioma en que se mantiene el repo —se leen donde
  están—, pero **los errores lanzados van en inglés**: salen por la consola, se pegan en un
  informe y acaban leyéndolos otros. Y no se traducen nunca las claves de almacenamiento:
  traducirlas borra los récords de quien juega.
- **La clave del diccionario es el propio texto en inglés.** `t('Back to the menu')` se lee en
  el punto de uso, y TypeScript vigila lo que una librería de i18n no vigila: cambiar la frase
  y olvidarse del diccionario **no compila**. El inglés no se guarda dos veces —si el idioma es
  inglés, se devuelve la clave—. Para el texto que llega como **dato** (una etiqueta de una
  tabla, un «501») hace falta un traductor suave que devuelva tal cual lo que no conozca: ahí
  la clave es un `string` y no se puede comprobar en compilación.
- **Y un guardián más, en el hub: el puente.** Los ajustes viajan por el navegador y no por
  una API —el arcade escribe una cookie y los juegos la leen del mismo origen—, así que no hay
  contrato que compile. Si un juego cambiara el nombre de la cookie, o si el hub lo cambiara y
  un juego se quedara con el anterior, **no fallaría nada**: el juego no se enteraría y
  seguiría en inglés con el volumen entero. Se comprueba sobre los paquetes **instalados**, no
  sobre el repo de al lado, para que un juego atrasado en una versión vieja también caiga.
- **Tres guardianes por juego, porque los tres fallos son silenciosos.** Que las etiquetas de
  las tablas estén todas traducidas —se añade una dificultad y nadie se acuerda—; que no sobre
  ninguna frase —se cambia el texto del componente y la vieja se queda traducida para siempre—;
  y un e2e con la cookie puesta, porque la cadena (cookie, servidor, hidratación) puede estar
  bien a trozos y no llegar. El resto de los tests corren **sin** cookie, que es como se sirve
  el juego por defecto: en inglés, y así traducir no obliga a tocarlos.
- **Lo que se copia entre repos se prueba en cada repo.** `lib/ajustes.ts` y sus dos vecinos
  están duplicados a propósito en xrcade y en los doce juegos, porque son repositorios
  sueltos que se despliegan por su cuenta. Lo que hay que probar entonces no es la lógica
  —esa ya está probada al lado— sino **el puente**: las claves y los valores de partida
  escritos a mano en las expectativas. Comparándolos contra su propia constante, el test pasa
  siempre y una clave que se aparte de la del arcade rompe el ajuste en silencio.
- **Cada juego enseña su gesto la primera vez, y solo la primera.** Unos segundos entre
  «empezar» y el primer lanzamiento, con botón de saltar y sin volver a salir (una marca en
  `localStorage` con el prefijo del juego). Lo que enseña es **lo que no se adivina**: que el
  mazo se coge llevando la mano, que no hay ningún botón que devuelva la pelota, que al plato
  hay que adelantarse, que el palo sale despacio. Y lo enseña **con movimiento**, no con
  letras: `<Text>` de drei baja las fuentes de un CDN que la CSP del salón bloquea, así que
  o es geometría o es un lienzo 2D con las fuentes del documento.
- **El guion del tutorial vive fuera de la escena.** Qué se enseña, cuánto dura cada tramo y
  si ya se ha visto van en `lib/tutorial.ts`, sin three ni React, con su test. Así se puede
  comprobar sin navegador que dura lo justo —hay un mínimo y un máximo, y alargar un paso
  obliga a acortar otro— y que un almacenamiento capado lo vuelve a enseñar en vez de
  romperse.
- **No atar lo que dura una demostración a lo que dura la cuenta atrás.** Son dos relojes
  distintos: la cuenta dura tres segundos y la demostración seis y pico, así que atarla al
  estado `countdown` la corta a la mitad —y la mitad que se pierde es siempre el final, que
  es lo que de verdad no se adivina. Se mantiene también durante los primeros lanzamientos y
  se retira sola al acabar su guion.

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
- **El espacio del puño tiene el `+Y` saliendo del puño.** Lo que se empuña como una vara
  —un bate, un mazo, una raqueta— crece hacia `+Y`; lo que cuelga —un palo de golf— va hacia
  `-Y`. Y el espacio del **rayo** no es ese: está girado unos 45° respecto del puño, así que
  colgar de él lo que debería quedar a plomo lo deja inclinado. Un objeto se cuelga del rayo
  solo si lo que importa es hacia dónde apunta (un arco, una pistola); si lo que importa es
  cómo se sostiene, del puño.
- **Lo que va en la mano no puede colgar del anclaje del decorado.** WebXR da las manos en el
  espacio del origen que pone el anfitrión; dentro del grupo anclado se le suma el giro del
  mundo y aparece en otro sitio. Se monta fuera **o** se le deshace la matriz de sus padres
  —`matrix = padre.matrixWorld⁻¹ · matrizDelEspacio`—, que es lo que deja colocar algo en la
  mano sin importar de dónde cuelgue en el árbol.
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
- **La salida se dibuja igual en los trece.** Llegó a haber cinco: un cuadrado, una X, la
  palabra «Exit», «Leave» y un icono propio. Con el visor puesto, la pregunta «¿cuál era el
  de salir?» se repite en cada cabina. Es una flecha de volver, la misma forma
  (`FLECHA_DE_SALIR` en `canvasPanel.tsx`), en el panel dibujado y en la geometría.

## Lo que aprendieron los tests

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
