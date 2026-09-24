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
5. **La fuente se pide en píxeles de verdad.** Pedirla en metros (`0.03px`) sobre un lienzo
   escalado a 1024 da unas métricas de letra en las que el navegador del visor no se puede fiar,
   y amontona las letras aunque las cajas no se pisen: fue la causa de la séptima tanda en los
   trece juegos a la vez. `panelFont(peso, metros)` en `canvasPanel.tsx` escala el lienzo y
   pide la fuente a su tamaño en píxeles; el lienzo que apunta rechaza cualquier texto pedido
   por debajo de `MIN_FUENTE_PX`.

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
- **Pero dentro del salón la mirada NO es la mejor pista, y el anfitrión presta la suya.** El
  arco de cabinas lleva plantado un rato, con su sitio y su rumbo, y **elegir una cabina exige
  girar la cabeza**: las de los extremos están a 75°. Anclando a esa mirada, el juego salía
  girado hacia allí —de lado respecto del cuerpo— y con el visor puesto había que girarse
  entero o recentrar la sala para poder jugar: «entro al hub, giro la cabeza para ver los de la
  izquierda, selecciono air hockey, y la mesa sale como si estuviese mirando a la izquierda».
  Así que la escena recibe un anclaje opcional (`anchor`, con `lib/hostAnchor.ts`, el mismo
  fichero en los catorce) y lo usa **en la primera colocación**; a partir de ahí manda la
  mirada, que es lo que hace falta al recentrar —el espacio de referencia se mueve entero y lo
  prestado apunta a donde ya no hay nada—. Sin anclaje prestado, todo sigue igual: es lo que
  pasa en la web propia del juego. El grupo del ancla se llama `world-anchor` para poder medir
  desde fuera dónde acabó, que es lo único que distingue el arreglo desde una pantalla.
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
- **La columna va lejos y a la izquierda, fuera de donde se juega.** Con las gafas, una
  columna a un metro y a 38° estorba: se ve de reojo durante la partida y, en una mesa, acaba
  encima del paño en cuanto uno da la vuelta. La regla común: **a 1,5 m de los ojos (entre
  1,4 y 1,6), entre 50° y 65° a la izquierda, con su centro a la altura de los ojos y de cara
  a quien juega**. Si lo que se juega ocupa ese lado —gloop-pop, con babosas hasta ±70°—, se
  va más allá, nunca más cerca. El **botón que abre la columna va del mismo lado que la
  columna**: pulsar a un lado y que se abra al otro obliga a buscarla. Y en los juegos donde
  se rodea algo (una mesa), la columna **no cuelga del origen**: se planta al abrirla, desde
  donde está la cabeza en ese momento, y un test comprueba que no proyecta sobre lo que se
  juega desde ningún sitio al que se pueda ir. A más distancia, el texto tiene que crecer:
  se vuelve a medir con `legibilidad.ts` en los dos idiomas.
- **Cada contacto se siente en la mano que toca, y nada más.** Coger, soltar, golpear, clavar
  y tensar vibran; deslizar, esperar o que algo pase cerca, no. Vibra **la mano que toca**; las
  dos, solo cuando el golpe lo recibe el cuerpo. La fuerza del pulso sale de la fuerza del
  contacto, no es fija. Las recetas están en `lib/tactos.ts` (el mismo fichero en todos): un
  impacto es un pulso fuerte y corto con una cola, una tensión es un tren de pulsos que se
  aprietan y suben mientras se tensa. Y una cosa del estándar que no se adivina:
  **`pulse()` no encola, cada llamada corta la anterior**, así que un tren se encadena con
  retardos iguales o mayores que la duración del pulso anterior; solaparlos para que «se
  sienta continuo» fue exactamente lo que dejó glide-hockey vibrando sin parar.
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

## Enseñar el gesto sin palabras: las ayudas visuales

**El tutorial es la red, no el camino.** Lo primero que hace alguien al entrar en una cabina no
es leer: es mirar alrededor. Si mirando alrededor no se ve dónde ponerse, qué coger y qué hacer
con ello, el juego empieza con una pregunta — y lo que se lee después ya llega tarde. Las
**ayudas visuales** son la respuesta dibujada; el tutorial se queda detrás por si alguna falla.

Son siempre las mismas cinco, y es a propósito: quien aprende en un juego que lo que late en
ámbar es lo que hay que hacer no vuelve a preguntárselo en el siguiente.

1. **Dónde ponerse**: una marca en el suelo, dos huellas con la postura del juego —de frente
   en una caseta de feria, de lado en un cajón de bateo—. La postura es la mitad del mensaje.
2. **El gesto**: la silueta de lo que hay que hacer, repitiéndolo.
3. **Lo que hay que coger, resaltado** hasta que se coge.
4. **Adónde va lo que se lanza o se golpea**: una raya, un arco o una marca en el objetivo.
5. **El mando de verdad con su botón encendido** (`MandoDeVerdad.tsx`), junto al objeto.

El motor vive en `lib/ayudas.ts`, el mismo fichero en los trece; el guion de cada juego —qué
ayudas tiene y qué apaga cada una— en su `lib/guionDeAyudas.ts`. Lo que se aprendió montándolo:

- **Una ayuda declara dos formas de apagarse, y le basta cualquiera**: el **hito** que la
  vuelve inútil —en cuanto el gesto se hace una vez, sobra— y un **plazo**, por si ese hito no
  llega nunca. No es un detalle: una ayuda permanente deja de ser ayuda y pasa a ser decorado
  que tapa el juego y compite por los píxeles. El guardián `problemasDelGuion` devuelve frases
  —qué ayuda, qué le pasa— y rechaza los plazos de más de veinte segundos, que es como se cuela
  un «solo mientras lo pruebo» y se queda para siempre.
- **Nada aparece ni desaparece en un fotograma.** Se cruza en medio segundo (`acercarse`). Es
  además lo único que la documentación de Meta dice de esto: avisa expresamente contra el
  realce que parpadea. De apagarlas no dice nada nadie —el realce de lo agarrable se documenta
  como un estado permanente de la interacción—, y esa es justo la parte que en un juego de un
  minuto hace falta.
- **Una ayuda se coloca donde se está mirando, no donde sería realista.** Un bate en posición
  de espera va por detrás del hombro: puesto ahí, el fantasma le queda a quien entra **a la
  espalda**; adelantado al pecho, la punta acaba a un palmo del ojo, porque en el visor la
  cabeza **es** la cámara, y lo que se ve es un manchurrón de color. Y no hay término medio: a
  un palo de pie pegado al cuerpo se le mira de punta. Acabó flotando sobre el plato, a un
  brazo y de lado, y ahí sí se lee que es un bate. Se descubrió con tres capturas seguidas del
  emulador, no razonándolo.
- **Lo que se queda mientras se juega va pintado en el suelo.** Un calco no puede tapar nada
  que vuele por encima de él, y eso no hay que volver a comprobarlo. Lo que flota a la altura
  del pecho está exactamente en la recta que va de los ojos a lo que hay que mirar, así que
  **solo vale si se apaga antes de que eso exista**: en la jaula, la máquina no lanza hasta que
  el bate va en las dos manos, y ese es el hito que quita el fantasma. Se comprueba con el
  guion, no con trayectorias.
- **Y si la ayuda va sobre el tablero, el techo lo pone el propio juego.** En la caseta la
  columna de paneles está *detrás* del tablero, así que todo lo que asoma sobre la tabla le
  come al marcador por abajo. Lo que el juego ya acepta que asome son los topos: una ayuda que
  no sube más que un topo no tapa nada que no se tapara ya. Medir eso es exacto y no depende de
  a qué altura mire nadie.
- **Todo se monta desde el principio y no se desmonta nunca**, aunque no se vea. Montar una
  malla a mitad de tanda obliga a three a compilar su material, y eso bloquea el hilo justo en
  el fotograma en que la ayuda quiere que se mire. Lo que se enciende y se apaga es `visible` y
  la opacidad; invisible tampoco cuesta una llamada de dibujo. Con eso, `Calentar` las compila
  con el resto.
- **El mando va junto al gesto, desde la primera vez.** Enseñar la bola fantasma dice qué
  coger, pero no con qué botón. El mando de verdad, con el botón latiendo en ámbar, va **al lado
  del objeto fantasma**, a un palmo y del lado de la mano que juega, y se apaga con el mismo
  hito que la ayuda del objeto. No va encima de la mano: ahí lo pone el tutorial, y dos copias
  del mismo `.glb` en la misma mano se pintan una encima de otra —ese fue el motivo de que la
  ayuda solo enseñara el mando «si el tutorial ya se había visto», que es justo cuando menos
  falta hacía—. Y se apaga **escondiendo el grupo**, no desmontándolo, que desmontarlo libera
  los materiales del modelo y volver a enseñarlo los recompila.
- **Hay ayudas que no significan nada antes de empezar.** En el menú el tablero está vacío a
  propósito: un halo alrededor de un mazo que no está es peor que ningún halo. Eso se dice con
  un hecho más en el guion —`tanda`— y no con un `if` en la escena; lo que sí se enseña desde
  que se entra en la cabina es dónde ponerse y qué botón se aprieta.
- **Lo que cuestan se mide, y la cara es el mando.** Con el mismo instrumento del decorado
  —llamadas de dibujo por fotograma, `e2e/support/escenario.ts`—: dos huellas son cuatro
  llamadas por los dos ojos, y el modelo de los dos mandos, treinta y dos. Por eso el mando es
  la ayuda que menos dura. **Y la medida se toma con la escena quieta**: con la tanda en marcha
  lo que cambia entre dos medidas no son las ayudas, son nueve topos asomando — medido así, las
  ayudas «costaban» setenta llamadas *menos* que sin ellas.
- **Para verlas en una captura hay que girar la cabeza.** El emulador entra siempre mirando al
  frente y las ayudas están donde se mira después: al suelo, a los pies, al objeto. Se añade
  `lookAt(yaw, pitch)` al emulador de cada repo, y **las dos medidas se toman mirando al mismo
  sitio**, que si no se comparan dos vistas y no dos escenas.
