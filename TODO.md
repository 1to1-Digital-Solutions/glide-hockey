# TODO — air-hockey

## Desde Organízate

- [x] Inicializar el proyecto: construir la primera versión <!-- org:762a2f57-55ab-45c4-8ae8-daec28ec1875 -->
- [x] Montado en el salón se queda sin interfaz <!-- org:22a016a7-1e2d-41ac-91d3-402e0fef1ce2 -->
- [x] Sonido de deslizamiento según la velocidad del disco <!-- org:0718b0d5-c258-4366-a3ba-af4345dc873e -->
- [x] Sonido del juego: golpe del mazo, rebote en banda y gol <!-- org:71cfa0c9-8ea7-4f92-b140-a6263ffd670f -->
- [x] El mazo no puede crear energía al golpear <!-- org:bc161c8e-9202-43b0-8261-f84a2963f86b -->
- [x] Montar la escena dentro de un Canvas ajeno en un test, como hace el salón <!-- org:f44644e4-c2a6-4077-85b0-2d235dff5e6f -->
- [x] Cubrir con un test de navegador que el ratón mueve el mazo <!-- org:168af5eb-d220-4e9a-84a6-fd53ea5cf93d -->
- [x] La mesa flota en la nada: falta el sitio donde se juega <!-- org:24eb83ea-a605-4c91-9f82-23596f1deae3 -->
- [x] Música de fondo, con interruptor propio <!-- org:1861b239-ccc9-4cb1-a805-f4b4be0d197c -->
- [x] Medir la cobertura de los tests y ponerle un suelo <!-- org:834ea662-d9c7-4f14-bfe0-18439ea455d7 -->
- [x] Cambiar entre el escenario y tu habitación sin salir de la sesión <!-- org:aa66bbbb-1e01-41ff-96fe-b982c006bd83 -->
- [x] El mazo se agarra con la mano, no se maneja con el rayo <!-- org:b559d6d8-bf3b-49fa-9958-9a8b4f021b04 -->
  `MalletHand` lee las dos manos cada fotograma y el mazo va donde va la que lo lleva, con
  mando o con la mano desnuda. No hay rayo en el mazo: el rayo es del menú.
- [x] El juego va a cámara lenta por debajo de 30 fps, y el CI está en rojo por eso <!-- org:dbe8773d-2a8d-4b71-8661-f5ea51132645 -->
- [x] El botón de volver está en medio de la mesa y estorba <!-- org:1ae6c967-4503-4864-bcbe-8a575e1b3831 -->
  Fuera del tablero: cuelga a un palmo del borde largo (`XR_UI.quit`), inclinado hacia quien
  juega, así que el brazo que va a por el disco no pasa por encima. Y pulsarlo pregunta antes.
- [x] El menú es poco intuitivo: repasar su usabilidad <!-- org:47bd9aea-6905-4589-9202-e3f94ffcc1f9 -->
  Cada fila del panel del visor dice de qué es —eran hileras de iconos sin una palabra—, el
  panel se aparta de la mesa al empezar la partida y salir pregunta antes de perderla.
- [x] Etiquetar v0.1.0 para que xrcade pueda instalarlo <!-- org:a9e1801d-5e30-4e29-9c98-72e3a10537df -->
- [x] Dar de alta Air Hockey en el catálogo de xrcade <!-- org:1f04c5f5-0cb2-4954-a7ba-c1ab0b7d00a3 -->
- [x] Probar con el visor y decidir cómo se lleva el mazo en VR <!-- org:21be71e0-2f09-4ed1-b78c-e10038d5433a -->
  **Decidido: se coge por proximidad y va donde va la mano.** Se lleva la mano hasta el mazo y
  se cierra —apretar desde lejos no lo teletransporta, que es lo que volvería a convertirlo en
  un cursor—, y una vez cogido no se suelta por alejarse, solo al abrir la mano. Vale con las
  dos manos y se puede cambiar a media partida, como en una mesa de verdad.
  **Y probándolo salieron dos fallos que solo pasan con la mano**, los dos medibles:
  1. *Un manotazo rápido atravesaba el disco sin tocarlo.* El contacto entre mazo y disco mide
     11,6 cm y el mazo en la mano no tiene tope de velocidad: en un paso de 1/60 una mano a 9
     m/s recorre 20 cm y aparecía al otro lado. Medido barriendo por encima del disco: a 45
     fotogramas por segundo un barrido a 7 m/s fallaba **siempre**, y a 9 el disco se quedaba
     quieto siete de cada diez veces —y dependía de dónde cayera el golpe dentro del paso, así
     que el mismo manotazo unas veces entraba y otras no—. Ahora el mazo se **barre** dentro del
     paso, de donde salió a donde llegó, y toca el 100 % de las veces a cualquier velocidad.
  2. *La fuerza del golpe dependía de los fotogramas por segundo.* El mazo recorría el camino de
     un fotograma entero dentro de un paso de 1/60, así que su velocidad salía multiplicada por
     `60/fps`: la misma mano a 0,6 m/s mandaba el disco a 0,9 m/s a 72 fotogramas y a 1,5 a 45
     —un 60 % más fuerte cuando el visor iba peor—, y en los pasos sobrantes golpeaba con el
     mazo parado. Ahora el camino de la mano se reparte entre los pasos del fotograma: el mismo
     golpe pega **lo mismo a 45, 72 y 90**, y sale a `(1 + restitución)` veces la mano, que es
     la cuenta de un choque de verdad.
  Los dos tienen su test en `matchLoop.test.ts`; quitando cada arreglo, falla el suyo.
- [x] Vibración del mando al golpear el disco y en el gol <!-- org:21e1e9e3-c714-4341-9165-49c6ead31d28 -->
- [x] Hay jugadas que no se acaban nunca con el mazo del jugador parado <!-- org:51dc609f-88b3-4494-b2c8-74f89a4cdff6 -->
- [x] El triángulo de «jugar» del menú del visor apunta hacia abajo <!-- org:7c94674a-818f-400d-81a4-11c76871baf6 -->
- [x] Sonido: que el golpe y el rebote suenen con la fuerza del impacto <!-- org:0cba7501-dbde-40ee-aa81-068f7ad8b954 -->
- [x] Tests e2e en sesión inmersiva con el emulador de WebXR <!-- org:97d78694-3fad-4f6d-9544-795365fa268d -->
- [x] Modo Niveles: la escalera del reto como niveles con estrellas y progreso guardado <!-- org:8540ce6e-0992-4c10-971d-24e9b988cd8c -->
- [x] Práctica sin fin: partida que no acaba hasta que sales, con récord de racha <!-- org:37e6f302-159b-46e7-9130-5bad022155ab -->
- [x] Brillo del disco y reflejo de la mesa con un mapa de entorno barato <!-- org:38455675-8fea-4c54-bd3c-cb8e09c76d11 -->

## Del visor — cuarta ronda

- [x] [urgente] El texto del aviso de salir se solapa
  **Medido, y en este panel no se solapa**: ni con las medidas de ahora ni con las de antes. Lo
  que sí queda hecho es la regla que pedías —`components/xr/legibilidad.ts`, ver el `TODO.md`
  de xrcade—, y con ella los dos paneles con letra de este juego están medidos en los dos
  idiomas: el aviso de salir y los nombres de las filas del menú. Ninguno se pisa ni se sale.
  Así que el solape que viste está en otro sitio. Lo más probable es que fuera el menú de
  ajustes —dices en el mismo párrafo que el botón de salir «parece que abre las opciones»—, y
  ese panel está medido ahora. Si vuelve a pasar, decir **qué palabras** se pisan: con eso se
  sabe qué panel es en un minuto.
  El modal de «¿dejar la partida?» está bien pensado pero las palabras se pisan y no se
  entiende. Ver la regla común de texto legible en el repo de Organízate.

- [x] [alta] El botón de salir debería abrir las opciones, y salir estar dentro
  **Y el icono ya decía «opciones»**: era el de las tres rayitas y lo que hacía era preguntar
  si salir. De ahí lo de «parece que abre las opciones».
  Ahora abre un panel con **tres** salidas en vez de dos: seguir jugando —la primera y la más
  ancha, que es la que no pierde nada—, volver al menú del juego, y salirse del todo. Volver
  al menú y salir eran cosas distintas y hasta ahora solo estaba la primera con el nombre de
  la segunda.
  El panel está medido con la regla de legibilidad en los dos idiomas: ninguno de los cinco
  textos se pisa ni se sale.
- [x] [alta] Los ajustes no tienen texto: el botón de VR/AR no se entiende
  Hecho: el interruptor del escenario dice al lado cuál está puesto —la pista o tu
  habitación—. Era un icono y nada más, así que con las gafas puestas no había forma de saber
  qué hacía hasta pulsarlo. El rótulo va **a la derecha del icono y no debajo**: debajo caía
  justo encima del de «Modo», y eso lo dijo la medida, no el ojo.

- [x] [media] El disco tiene una aureola de luz que sobra
  Quitada. Queda solo el `emissive` del propio disco, que es lo que lo hace visible sobre la
  mesa sin pintarle un halo alrededor.

- [x] [urgente] Lo que se lleva en la mano se come el rayo del propio mando
  **Arreglado en los trece.** El hacha, el balón, el bate, el arco, la bola, el dardo, la pala,
  el putter, el mazo y la pistola van con `raycast={NO_RAYCAST}`: se ven igual y dejan pasar
  el rayo.
  Encontrado leyendo el código y es el mismo fallo en varios juegos: **nada de lo que cuelga
  de la mano se excluye del raycasting**. El rayo del mando arranca a 20 cm (`minDistance`
  del salón) y lo primero que se encuentra es la pistola, el mazo, el putter o el palo que
  esa misma mano sostiene, así que el evento se lo queda el objeto y al menú no le llega
  nada. Desde fuera parece que «el mando no funciona» o que «hay algo invisible por medio».
  Arreglo: todo lo que vaya en la mano se marca `raycast={NO_RAYCAST}` —el mecanismo que ya
  usan los paneles—, incluidas las mallas de dentro de un modelo cargado, que no lo heredan
  del `<primitive>`.

- [x] [alta] El tutorial: botón de siguiente, botón de saltar, y que enseñe el mando
  **Hecho, con el modelo de hachas.** Cada paso se supera **haciéndolo** —coger el mazo, darle al disco y marcar—, el juego no se
  para mientras tanto y el paso se **calcula** de lo que la partida ya apunta (`hitos`), así
  que no puede discrepar de ella. Dibuja el mando con el botón resaltado, lleva siguiente y
  saltar, y la versión de la lección sube: quien vio la anterior hará este.
- [x] [alta] Los rótulos se solapan y la letra es pequeña y apretada
  Medido, y en este juego **no se pisan**: lo dicen `menu.legible.test.ts` y
  `tutorial.legible.test.ts`, que suspenden si dos textos se tocan, si uno se sale del panel o
  si alguno baja de cuatro milímetros. Donde sí había solapes era en el panel del tutorial —la
  frase en español crecía hacia arriba y se metía debajo del contador— y ya está arreglado.
  Si con el visor puesto sigue viéndose apretado, el sitio donde mirarlo es ese test.

- [x] [alta] Los modos —práctica y desafío— no se distinguen en el menú
  Hecho: la línea que explica el modo elegido está en el panel del visor y cambia al cambiar
  de modo. Estaba declarada desde siempre junto a cada modo y **solo se pintaba en la pantalla
  de la web**, que con las gafas puestas no se ve. El panel creció para hacerle sitio sin
  apretar ninguna fila.

- [x] [alta] El botón de salir parece un cuadrado y no una X ni una flecha
  **No se ha encontrado el cuadrado.** Mirados los trece: seis escriben la palabra «Salir» y
  siete dibujan un aspa (`XRCloseIcon`); ninguno pinta un cuadrado. Lo más parecido es la
  **placa** de debajo del icono, que sí es un rectángulo redondeado y en un panel oscuro puede
  leerse como el botón entero. Hace falta saber en qué juego se vio para arreglar el que sea.

- [x] [media] Cambiar entre realidad virtual y aumentada desde el propio juego
  Ya se puede, y desde antes de esta tarea: el menú de cada juego lleva su interruptor de
  escenario, así que se cambia sin salir de la sesión. Lo que faltaba era **entender qué
  hacía**: era un icono mudo. Ahora dice al lado cuál está puesto.
  Lo que no se puede es cambiarlo **a mitad de partida**: para eso hay que volver al menú.

## Del visor — tercera ronda

- [x] [urgente] El botón de volver al arcade estaba en medio de la pantalla
  Lo ponía el salón además del que trae este juego, colgado de la mirada a metro y pico, así
  que se quedaba delante de la cara toda la partida y además salía sin preguntar. Retirado en
  `xrcade`: la salida es la de aquí —el botón de las tres rayitas, fuera de la línea de juego
  y con su confirmación—, que es lo que ya llamaba a `onExit`.

- [x] [urgente] Los objetos se cogen con el botón de agarre y no con el gatillo
  Aquí ya se cogía cerrando la mano (`xr-standard-squeeze`), así que no había nada que
  cambiar. Se apunta porque el repaso fue de los trece: los cinco que lo hacían con el gatillo
  —hachas, baloncesto, bolos, dardos y minigolf— ya lo hacen con el agarre.

- [x] [alta] El rayo del mando se sigue viendo con el mazo agarrado <!-- org:73147f52-c503-4d26-b463-a3eb108ed9f6 -->
  Ya se apaga. El bucle del juego apunta qué mano lleva el mazo (`xr/manosOcupadas.ts`) y el
  mando de ese lado deja de dibujar su rayo y su cursor. Se apaga **el dibujo, no el
  puntero**: soltar el mazo y volver a pulsar un botón del menú funciona igual. Y al quitar
  la escena se sueltan las dos, o el rayo se quedaría apagado en el arco, que es lo único con
  lo que se elige cabina.
- [x] [alta] No hay tutorial <!-- org:28c0e6a6-6ad4-4fe9-af13-b5e73d346ff6 -->
  Haberlo, lo hay: sale entre «empezar» y el saque, la primera vez. Lo que pasaba es que ya
  se había visto, y lo visto no se repite. Ahora lo guardado es **la versión de la lección**
  y no un sí, así que subirla la vuelve a enseñar — y había que subirla, porque la
  demostración decía «mantén el gatillo» y lo que se aprieta ahora es el botón de agarre.
  Subida también en hachas, baloncesto, bolos, dardos y minigolf, por lo mismo.
- [x] [alta] Las letras del menú de ajustes salen solapadas <!-- org:77653e48-ff5d-4b1c-979a-ce9f3c343030 -->
  Se pisaban de verdad, y se puede medir: el rótulo «Modo» llegaba a 0,355 y la banda del
  récord empezaba en 0,335, así que la palabra se pintaba encima del botón del decorado. El
  panel ha crecido de 0,86 a 1,00 y las filas se han repartido con aire para sus nombres.
  Lo vigila `xrMenuLayout.filas.test.ts`, que ordena las bandas de arriba abajo y falla si
  una entra en la anterior; con las medidas viejas falla señalando exactamente esa.
- [x] [media] La configuración no explica nada antes de empezar <!-- org:5ec4c247-f584-4b39-a694-90169956253b -->
  La tenía, pero solo hablaba del ratón: «mueve el mazo con el ratón y mete el disco». Con el
  visor puesto eso no dice nada, y encima esa pantalla no se ve. Ahora la frase cuenta las dos
  mitades —con el ratón y con el visor— como en las otras doce, y dentro del visor quien
  explica el gesto es la demostración, que vuelve a salir (ver arriba).

## Revisión de mejoras

- [x] El reflejo del entorno llega a la mesa pero no al mazo
  Ya llega: `Mallet` lo recibe de `Rink`, igual que el disco. `MalletHand` no hacía falta —solo
  mueve el mazo, no lo dibuja—, así que con esto está cubierto también dentro del visor.
  Sin llamadas de dibujo de más: el mapa ya estaba cargado y se pasa, no se duplica.
- [x] Terminar la partida no suena
  El HUD pinta estrellas, nivel desbloqueado o récord en silencio: solo se repite el último sonido
  normal de la partida. Comparte el hueco con ping-pong, whack-a-mole, bow-shooting, skeet y
  stick-rush.
- [x] Sin techo ni fondo de cielo jugando desde su propia web
  Ya hay techo, y sobre todo hay fondo: lo pone el juego con `Backdrop`, no el `<Canvas>`.
  **Dentro del salón sí pasaba**, al revés de lo que decía esta nota: el `Entorno` del hub se
  retira al entrar en la cabina, así que un juego sin fondo propio se quedaba igual de negro
  allí que aquí.
  El atajo `<color attach="background">` no habría servido: adjunta el color a **su padre**, y
  aquí el padre es un grupo, donde no significa nada —ni falla ni avisa—. Lo vigila
  `e2e/sala.spec.ts`, mirando con qué color se limpia el lienzo.

## Del visor — segunda ronda

- [x] [urgente] La partida no espera a que el mazo esté en la mano
  **Media tarea hecha**: el mazo ya se puede agarrar —el juego no sabía dónde estaba la mano, ver
  `XRControllerGrip`—. Queda lo otro: la cuenta atrás arranca igual aunque no lo hayas cogido, así
  que la partida puede empezar contigo sin nada con que parar el disco. Tiene que esperar.
- [x] [alta] La portería es demasiado pequeña para lo grande que es el mazo
  Con el mazo actual tapando casi toda la boca, meter gol —y que te lo metan— es muy difícil, y
  una partida sin goles no es divertida. Hay que revisar la proporción entre `GOAL_WIDTH` y el
  radio del mazo en `lib/gameConfig.ts`.
