---
name: interaccion-en-el-visor
description: Lo aprendido probando los juegos de xrcade con el visor puesto, y cómo enseñar el gesto sin palabras con ayudas visuales. Úsala al diseñar o cambiar la interacción de un juego en el visor — dónde se colocan la escena, los menús, los paneles o el botón de salir; cómo se coge, se lanza o se golpea algo; hápticos; idioma y textos del visor; el tutorial o las ayudas visuales (huellas, silueta del gesto, mando de verdad) — y antes de dar por bueno algo que solo se juzga con las gafas.
---

# Interacción en el visor

Lo que no se adivina desde una pantalla: salió de tandas de pruebas con las gafas puestas. Las
reglas que valen siempre están en `.claude/rules/xr.md`; las trampas de three y de los tests, en
`.claude/rules/xr-three.md`.

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
