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
- [ ] Probar con el visor y decidir cómo se lleva el mazo en VR <!-- org:21be71e0-2f09-4ed1-b78c-e10038d5433a -->
- [x] Vibración del mando al golpear el disco y en el gol <!-- org:21e1e9e3-c714-4341-9165-49c6ead31d28 -->
- [x] Hay jugadas que no se acaban nunca con el mazo del jugador parado <!-- org:51dc609f-88b3-4494-b2c8-74f89a4cdff6 -->
- [x] El triángulo de «jugar» del menú del visor apunta hacia abajo <!-- org:7c94674a-818f-400d-81a4-11c76871baf6 -->
- [x] Sonido: que el golpe y el rebote suenen con la fuerza del impacto <!-- org:0cba7501-dbde-40ee-aa81-068f7ad8b954 -->
- [x] Tests e2e en sesión inmersiva con el emulador de WebXR <!-- org:97d78694-3fad-4f6d-9544-795365fa268d -->
- [x] Modo Niveles: la escalera del reto como niveles con estrellas y progreso guardado <!-- org:8540ce6e-0992-4c10-971d-24e9b988cd8c -->
- [x] Práctica sin fin: partida que no acaba hasta que sales, con récord de racha <!-- org:37e6f302-159b-46e7-9130-5bad022155ab -->
- [x] Brillo del disco y reflejo de la mesa con un mapa de entorno barato <!-- org:38455675-8fea-4c54-bd3c-cb8e09c76d11 -->

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

- [ ] [alta] El rayo del mando se sigue viendo con el mazo agarrado <!-- org:73147f52-c503-4d26-b463-a3eb108ed9f6 -->
  Apunta a algún sitio mientras se está sujetando algo, que es justo lo contrario de lo que
  pasa. En cuanto se agarra el objeto, el rayo tendría que apagarse.
- [ ] [alta] No hay tutorial <!-- org:28c0e6a6-6ad4-4fe9-af13-b5e73d346ff6 -->
  Es de los pocos que no explica su gesto, y el mazo no se entiende mirándolo.
- [ ] [alta] Las letras del menú de ajustes salen solapadas <!-- org:77653e48-ff5d-4b1c-979a-ce9f3c343030 -->
  Con el visor puesto se pisan unas a otras y no ayuda a elegir nada.
- [ ] [media] La configuración no explica nada antes de empezar <!-- org:5ec4c247-f584-4b39-a694-90169956253b -->
  Las otras cabinas tienen una línea que dice a qué se juega; esta no.

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
