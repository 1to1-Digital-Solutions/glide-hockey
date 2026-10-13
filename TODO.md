# TODO — glide-hockey

## Desde Organízate

- [x] El botón de jugar sale apagado, como sombreado <!-- org:718146fc-265d-463d-83fa-05432c56bbe7 -->
- [x] Sin coger el mazo, la cuenta atrás se queda en 1 sin decir por qué <!-- org:14f9a213-96f0-490e-8f1b-0a1a9cac7c62 -->
- [x] El menú de configuración, enfrente y arriba a la derecha <!-- org:5cdccc5d-5ee1-42a2-a54d-2876da1d4d19 -->
- [x] Un gol que entra después de acabar la partida sigue sumando puntos y reescribe el récord <!-- org:d64a1a57-ce11-439a-8de7-6dafa6f91f76 -->
- [x] Los tests de legibilidad del visor miden a 1,2 m paneles que están a ~1,5 m <!-- org:b0ef03aa-df18-417f-ac7d-2bdb0efb912e -->
- [x] Con el resumen en pantalla se pueden cambiar los goles o el modo sin fin y la partida vuelve a estar en juego <!-- org:65e227ca-becc-4417-9f60-de9f001516cc -->
- [x] La IA de Glide Hockey es determinista y se memoriza en tres partidas: es el rival de la demo de Steam <!-- org:66049801-7f1e-4ab4-bd8a-829744ad26a6 -->
- [x] Los mandos vibran todo el rato; solo deberían vibrar al golpear el disco <!-- org:d2bb6697-6885-49da-982c-64491f97640f -->
- [x] El botón de ajustes está a la izquierda y el menú se abre a la derecha <!-- org:d398cb75-3bca-4c74-a6fc-7884763150ab -->
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
- [x] Dar de alta Glide Hockey en el catálogo de xrcade <!-- org:1f04c5f5-0cb2-4954-a7ba-c1ab0b7d00a3 -->
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

## From the headset — fourth round

- [x] [urgente] The text of the exit notice overlaps
  **Measured, and in this panel it does not overlap**: neither with the current measurements nor
  with the earlier ones. What is done is the rule you asked for —`components/xr/legibility.ts`,
  see xrcade's `TODO.md`—, and with it the two panels with lettering in this game are measured in
  both languages: the exit notice and the names of the menu rows. Neither overlaps nor overflows.
  So the overlap you saw is somewhere else. Most likely it was the settings menu —you say in the
  same paragraph that the exit button "looks like it opens the options"—, and that panel is
  measured now. If it happens again, say **which words** overlap: with that, which panel it is
  can be known in a minute.
  The «¿dejar la partida?» modal is well thought out but the words overlap and it cannot be
  understood. See the shared rule on legible text in the Organízate repo.

- [x] [alta] The exit button should open the options, with exit inside
  **And the icon already said "options"**: it was the one with the three little bars and what it
  did was ask whether to exit. Hence the "looks like it opens the options".
  Now it opens a panel with **three** ways out instead of two: keep playing —the first and the
  widest, which is the one that loses nothing—, go back to the game's menu, and leave altogether.
  Going back to the menu and exiting were different things and until now there was only the
  first one under the name of the second.
  The panel is measured with the legibility rule in both languages: none of the five texts
  overlaps or overflows.
- [x] [alta] The settings have no text: the VR/AR button cannot be understood
  Done: the scenery switch says next to it which one is on —the rink or your room—. It was an
  icon and nothing else, so with the headset on there was no way to know what it did until you
  pressed it. The label goes **to the right of the icon and not below it**: below, it landed
  right on top of the «Modo» one, and that was said by the measurement, not by the eye.

- [x] [media] The puck has a halo of light that is not needed
  Removed. Only the puck's own `emissive` remains, which is what makes it visible on the table
  without painting a halo around it.

- [x] [urgente] What is carried in the hand eats the ray of its own controller
  **Fixed in all thirteen.** The axe, the ball, the bat, the bow, the bowling ball, the dart, the
  paddle, the putter, the mallet and the pistol go with `raycast={NO_RAYCAST}`: they look the
  same and let the ray through.
  Found by reading the code and it is the same bug in several games: **nothing that hangs from
  the hand is excluded from raycasting**. The controller's ray starts at 20 cm (the hall's
  `minDistance`) and the first thing it meets is the pistol, the mallet, the putter or the stick
  that same hand is holding, so the object keeps the event and nothing reaches the menu. From
  outside it looks like "the controller does not work" or "there is something invisible in the
  way".
  Fix: everything that goes in the hand is marked `raycast={NO_RAYCAST}` —the mechanism the
  panels already use—, including the meshes inside a loaded model, which do not inherit it from
  the `<primitive>`.

- [x] [alta] The tutorial: next button, skip button, and showing the controller <!-- org:28c0e6a6-6ad4-4fe9-af13-b5e73d346ff6 -->
  **Done, with the axe game's model.** Each step is passed **by doing it** —grabbing the mallet, hitting the puck and scoring—, the game does not
  stop in the meantime and the step is **computed** from what the match already records
  (`milestones`), so it cannot disagree with it. It draws the controller with the button
  highlighted, has next and skip, and the lesson's version goes up: whoever saw the previous one
  will do this one.
- [x] [alta] The labels overlap and the lettering is small and cramped
  Measured, and in this game **they do not overlap**: so say `menu.legible.test.ts` and
  `tutorial.legible.test.ts`, which fail if two texts touch, if one overflows the panel or if
  any drops below four millimetres. Where there were overlaps was in the tutorial panel —the
  Spanish phrase grew upwards and got under the counter— and that is already fixed.
  If with the headset on it still looks cramped, the place to look at it is that test.

- [x] [alta] The modes —practice and challenge— cannot be told apart in the menu
  Done: the line that explains the chosen mode is in the headset panel and changes when the mode
  changes. It had always been declared next to each mode and **was only drawn on the web
  screen**, which cannot be seen with the headset on. The panel grew to make room for it without
  squeezing any row.

- [x] [alta] The exit button looks like a square and not an X or an arrow
  **The square has not been found.** Having looked at all thirteen: six write the word «Salir»
  and seven draw a cross (`XRCloseIcon`); none draws a square. The closest thing is the
  **plate** under the icon, which is indeed a rounded rectangle and on a dark panel can be read
  as the whole button. We need to know in which game it was seen in order to fix whichever it is.

- [x] [media] Switching between virtual and augmented reality from the game itself
  It can already be done, and since before this task: each game's menu has its scenery switch,
  so it is changed without leaving the session. What was missing was **understanding what it
  did**: it was a mute icon. Now it says next to it which one is on.
  What cannot be done is changing it **mid-match**: for that you have to go back to the menu.

## From the headset — third round

- [x] [urgente] The button for going back to the arcade was in the middle of the screen
  The hall put it there in addition to the one this game brings, hanging from the gaze at a bit
  over a metre, so it stayed in front of your face the whole match and on top of that it exited
  without asking. Removed in `xrcade`: the exit is the one from here —the button with the three
  little bars, out of the line of play and with its confirmation—, which is what already called
  `onExit`.

- [x] [urgente] Objects are picked up with the grip button and not with the trigger
  Here it was already grabbed by closing the hand (`xr-standard-squeeze`), so there was nothing
  to change. It is noted because the review covered all thirteen: the five that did it with the
  trigger —axes, basketball, bowling, darts and minigolf— now do it with the grip.

- [x] [alta] The controller's ray is still visible with the mallet grabbed <!-- org:73147f52-c503-4d26-b463-a3eb108ed9f6 -->
  It now turns off. The game loop records which hand carries the mallet (`xr/busyHands.ts`) and
  the controller on that side stops drawing its ray and its cursor. What turns off is **the
  drawing, not the pointer**: releasing the mallet and pressing a menu button again works the
  same. And when the scene is removed both are released, or the ray would stay off in the arc,
  which is the only thing a cabinet is chosen with.
- [x] [alta] There is no tutorial <!-- org:28c0e6a6-6ad4-4fe9-af13-b5e73d346ff6 -->
  There is one: it comes up between «empezar» and the serve, the first time. What happened is that
  it had already been seen, and what has been seen is not repeated. Now what is stored is **the
  lesson's version** and not a yes, so raising it shows it again — and it had to be raised,
  because the demonstration said «mantén el gatillo» and what is squeezed now is the grip button.
  Raised as well in axes, basketball, bowling, darts and minigolf, for the same reason.
- [x] [alta] The letters of the settings menu come out overlapped <!-- org:77653e48-ff5d-4b1c-979a-ce9f3c343030 -->
  They really did overlap, and it can be measured: the «Modo» label reached 0.355 and the record
  band started at 0.335, so the word was drawn on top of the scenery button. The panel has grown
  from 0.86 to 1.00 and the rows have been spread out with room for their names.
  It is watched by `xrMenuLayout.rows.test.ts`, which sorts the bands from top to bottom and
  fails if one enters the previous one; with the old measurements it fails pointing at exactly
  that one.
- [x] [media] The setup explains nothing before starting <!-- org:5ec4c247-f584-4b39-a694-90169956253b -->
  It had an explanation, but it only talked about the mouse: «mueve el mazo con el ratón y mete
  el disco». With the headset on that says nothing, and on top of that that screen cannot be
  seen. Now the phrase tells both halves —with the mouse and with the headset— as in the other
  twelve, and inside the headset the one that explains the gesture is the demonstration, which
  comes up again (see above).

## Review of improvements

- [x] The environment reflection reaches the table but not the mallet
  It reaches it now: `Mallet` receives it from `Rink`, same as the puck. `MalletHand` did not
  need it —it only moves the mallet, it does not draw it—, so with this it is covered inside the
  headset as well. No extra draw calls: the map was already loaded and is passed along, not
  duplicated.
- [x] Finishing the match makes no sound
  The HUD draws stars, unlocked level or record in silence: only the last normal sound of the
  match is repeated. It shares the gap with table-tennis, hole-patrol, bow-shooting, skeet and
  stick-rush.
- [x] No ceiling and no sky background when playing from its own website
  There is a ceiling now, and above all there is a background: the game sets it with `Backdrop`,
  not the `<Canvas>`.
  **Inside the hall it did happen**, contrary to what this note said: the hub's `Entorno` is
  removed on entering the cabinet, so a game without a background of its own stayed just as
  black there as here.
  The `<color attach="background">` shortcut would not have worked: it attaches the colour to
  **its parent**, and here the parent is a group, where it means nothing —it neither fails nor
  warns—. It is watched by `e2e/room.spec.ts`, looking at which colour the canvas is cleared
  with.

## From the headset — second round

- [x] [urgente] The match does not wait for the mallet to be in the hand
  **Half the task done**: the mallet can now be grabbed —the game did not know where the hand
  was, see `XRControllerGrip`—. The other half remains: the countdown starts all the same even
  if you have not grabbed it, so the match can start with you having nothing to stop the puck
  with. It has to wait.
- [x] [alta] The goal is too small for how big the mallet is
  With the current mallet covering almost the whole mouth, scoring —and being scored on— is very
  hard, and a match without goals is no fun. The proportion between `GOAL_WIDTH` and the
  mallet's radius in `lib/gameConfig.ts` needs reviewing.
