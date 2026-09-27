# Historial de glide-hockey

> Lo que se hizo, tanda a tanda, de lo más reciente a lo más antiguo. Sale del `ESTADO.md`,
> que tiene un tope de 8 KB vigilado por `src/handoff.test.ts`. Aquí no se borra nada: esto
> es la memoria larga, y el handoff es lo que hace falta para trabajar hoy. **Solo se lee si
> la pregunta es «por qué está esto así».**

Para el estado actual y el siguiente paso: **`ESTADO.md`**.

---

### Lo que había en ESTADO.md hasta el 2026-09-27

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

#### 📍 Tanda del visor del 24/09/2026 (sobre v0.22.0, sin publicar)

- **Los mandos ya no vibran todo el rato.** Fuera el roce del disco en la mano (`stepSlide`:
  pulsos solapados cada fotograma, y en las dos manos porque en VR nunca se sabía qué mano
  llevaba el mazo). Ahora `MalletHand` dice la mano (`onMove(..., lado)` → `noteHand`) y solo
  vibra **el golpe del mazo del jugador al disco**, en esa mano, con la receta común `impacto`
  de `lib/tactos.ts` y la fuerza de la velocidad del choque; el gol es una `llegada` suave y el
  final del partido un pulso largo, los dos en la mano del mazo. Banda, roce y golpes de la
  máquina: nada. Sin mano en el mazo: nada. Lógica en `lib/haptics.ts`
  (`sucesosDelFotograma`, `pulsosDelSuceso`, `reproducir`); el test de un disco suelto 20 s
  rebotando da cero pulsos. El roce **se sigue oyendo**.
- **Columna y botón, juntos a la izquierda** (regla común de `xr.md`): menú, fin de partida y
  aviso de salir a 1,5 m, 55° a la izquierda, a la altura de los ojos y girados hacia el
  jugador (`COLUMNA` en `GameWorld.tsx`), escalados ×1,4 para que la letra se lea (lo más justo,
  «The room» con ojos a 1,2 m). El botón que la abre va **en el mismo sitio** (`XR_QUIT`),
  ×2,6, azul y opaco, y se esconde mientras el aviso está abierto. Antes: panel a 1 m y 42° a la
  derecha, botón a 0,9 m y 57° a la izquierda sin girar. Aquí no se rodea la mesa (el mazo no
  pasa de medio campo), así que la columna cuelga fija; un test comprueba que no tapa mesa,
  marcador ni demostración desde 15 posiciones de cabeza delante de la portería.
- **El mando de verdad junto al mazo fantasma, desde la primera vez**: fuera `tutorialSeen()` de
  `Ayudas.tsx`; la ayuda planta el mando derecho con el agarre latiendo a un palmo a la derecha
  de donde nace el mazo, a 10 cm sobre el tablero, ×1,5 y girado con el costado del agarre de
  cara a los ojos (`mandoJuntoAlMazo` en `lib/guionDeAyudas.ts`, prop `junto` del común
  `MandoDeVerdad`). Se apaga con `grab` o a los 12 s, como el fantasma. La copia del tutorial
  sigue sobre el mando de la mano.

##### Pendiente de visor

| Qué mirar | Dónde se toca |
|---|---|
| El golpe del mazo se siente en su mano y solo en ella; flojo/fuerte se distinguen | `RECETAS.impacto` (`lib/tactos.ts`, común) |
| El gol se nota pero no se confunde con un golpe | `FUERZA_DEL_GOL` (`lib/haptics.ts`) |
| El final del partido se nota | `FINAL_PULSE` (`lib/haptics.ts`) |
| La columna se encuentra girando la cabeza y no estorba jugando | `COLUMNA` (`GameWorld.tsx`) |
| La letra de la columna se lee a 1,5 m | `ESCALA_DE_LA_COLUMNA` (`GameWorld.tsx`) |
| El botón se ve de reojo sin buscarlo, y el menú sale donde estaba | `ESCALA_DEL_BOTON`, colores en `XRQuitButton` (`XRHud.tsx`) |
| Con el menú a 55° a la izquierda, al entrar se sabe dónde mirar | `COLUMNA.azimut` |
| El mando junto al fantasma se ve y se entiende qué botón apretar | `MANDO_JUNTO_AL_MAZO`, `MANO_QUE_JUEGA` (`lib/guionDeAyudas.ts`) |
| El gol en contra como golpe recibido (viñeta, sala que tiembla, mesa a cámara lenta, oído tapado, vibración en las dos manos) no marea y se nota sin molestar; «Al recibir» Apagado/Suave/Normal en los dos menús | fuerza en `FUERZA_DEL_GOL_EN_CONTRA` (`lib/golEnContra.ts`); curvas en `GOLPE` (`lib/golpeRecibido.ts`, común) |

####  v0.7.0 (2026-09-08): música de fondo, con su propio interruptor

- **La sala suena.** Hasta ahora todo el audio eran osciladores: los golpes, los goles y el roce
  del disco. Faltaba el fondo, y sin él un salón recreativo no es un salón recreativo.
- La pista es [Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k),
  **CC0**, en `public/audio/sala.mp3`. Mono a 64 kbps: 1,2 MB por dos minutos y medio, que es lo
  que se puede pedir por HTTP en un visor conectado a la red de casa. Empieza y acaba casi en
  silencio, así que el bucle no tiene costura. Acreditada en `public/CREDITS.md`.
- **Interruptor propio**, al lado del de sonido en los dos menús (`lib/music.ts`, con el patrón
  de `muted.ts`). Son dos decisiones distintas: hay quien quiere oír el disco y no el fondo. El
  silencio manda sobre las dos.
- **Entrando con la música apagada no se descarga nada**: el elemento de audio se crea al pedirla
  por primera vez. Comprobado en el navegador —cero peticiones apagada, una al encenderla.

#### v0.6.1 (2026-09-08): la mesa deja de fabricar energía

- **`MALLET_RESTITUTION` baja de 1,15 a 0,85**, que es lo de un mazo de verdad. Por encima de 1
  significaba que un mazo **quieto** devolvía el disco más rápido de lo que llegaba: una mesa que
  juega sola.
- El contraataque no se pierde, porque nunca dependió de eso: el impulso se calcula con la
  velocidad **relativa**, así que un mazo que avanza a 3 m/s contra un disco que viene a 2 le
  devuelve casi 7. La fuerza la pone la mano, no la restitución.
- Dos guardas nuevas en `puckPhysics.test.ts`: un mazo quieto no puede devolver el disco más
  rápido de lo que llegó, y uno que avanza sí.
- **Y de paso, la sala volvía a caber en su presupuesto de dibujo.** El e2e llevaba tiempo en
  rojo sin que nadie lo mirase: la sala de recreativos (v0.5.0) subió la escena de 40 llamadas a
  **63**, con el techo en 40. Las diez máquinas eran treinta mallas, las bandas de la moqueta
  cinco y las paredes seis; instanciadas son tres, una y dos. **36 llamadas** y se ve igual.

#### v0.6.0 (2026-09-07): el escenario se cambia sin salir de la sesión

- **La sala o tu habitación, elegido por quien juega** y no por cómo se entró al visor.
  Dentro de una sesión de realidad aumentada las dos son la misma sesión pintada de dos
  formas, así que se cambia **sin salirse**: con el visor puesto, salir y volver a entrar
  para ver la habitación era justo lo que hacía que nadie lo usara.
- Se elige desde los dos menús —el de la web y el del visor—, y dentro del visor el
  interruptor se apaga cuando la sesión no es de realidad aumentada: sin passthrough no hay
  habitación que enseñar, y prometerla dejaría al jugador mirando la nada.
- Lo decide `showsPlace(modo, escenario)`: fuera de una sesión de realidad aumentada la sala
  se pinta siempre. Es una preferencia guardada.

#### 📍 v0.5.1 (2026-09-07): los tests dicen ahora cuánto código ejecutan

- **La suite mide su propia cobertura** (`npm run coverage`, y un paso más en CI). Se mide
  **el dominio** (`src/lib`), que es lo único que se puede probar sin un navegador con WebGL;
  la escena se prueba de extremo a extremo.
- **Está al 100 %, y el mínimo es 100**: lo que se añada sin probar rompe el build. Las pocas
  ramas que ningún test puede alcanzar —guardas que solo actuarían si cambiara el código de
  al lado— llevan `v8 ignore` con el motivo escrito al lado, no un número más bajo.
- Para llegar ahí se escribieron tests de lo que no probaba nadie: el almacenamiento cuando el
  navegador no deja guardar, el motor de sonido contra un `AudioContext` de mentira, el panel
  del visor y el estado de la partida con relojes falsos.
- El informe HTML queda en `coverage/`, que no se commitea.

#### ⏭️ SIGUIENTE PASO (lo primero al volver)

- Probar el juego **con el visor** (`npm run dev:https`): es lo único de la
  primera versión que no ha visto nadie. Mirar sobre todo si se puede jugar
  apuntando con el rayo del mando y si el menú inmersivo se lee y se pulsa. Y lo de la
  tabla «Pendiente de visor» de arriba.

#### Qué es glide-hockey

- Air hockey contra la máquina, en 3D, para navegador y visor. Dos modos:
  **prueba** (eliges nivel y goles) y **reto** (escalera que sube sola). Cada gol
  suma puntos; cada gol encajado los resta.
- Es un juego de **xrcade**: publica una escena que el salón monta dentro de su
  propio Canvas. Su web es un anfitrión más (ver `docs/xrcade.md`).

#### Decisiones firmes

- **Stack**: Next 16 (App Router) + React 19 + three 0.185 + @react-three/fiber,
  drei y xr. Tailwind 4. Vitest para unitarios, Playwright para navegador. Las
  versiones son las mismas que usan los juegos hermanos de la suite.
- **Sin motor de física**: la del disco son funciones puras en
  `src/lib/puckPhysics.ts`. Los motores de R3F van en WebAssembly y la política
  de seguridad del salón los bloquea.
- **Sin red y sin fuentes remotas**: los números del visor se dibujan con
  segmentos (`src/lib/xrDigits.ts`) y los perfiles de mando se auto-hospedan.
- La geometría (mesa, disco, mazos, sala) se genera en código: no hay modelos.
- Commits manuales: no commitear sin que se pida.

#### Hecho hasta ahora

- **Ya se juega en un sitio, no en el vacío.** El escenario era un suelo oscuro y poco más, así
  que con el visor puesto no había forma de calcular distancias: lo que da la escala son las
  cosas conocidas alrededor. Ahora es un salón recreativo: moqueta con dibujo, máquinas apagadas contra las paredes, neones y la luz baja de un sitio así. Todo geometría por código y colores
  planos, que es lo que deja pasar la política de seguridad del salón.

- **La interfaz de dentro de la escena ya se ve cuando lo monta el salón.** Se escondía siempre
  que no había sesión de WebXR, porque en la web propia manda el DOM y sus botones cazarían los
  clics del ratón por delante del juego. Pero el salón de xrcade **no pone DOM**: montado ahí y
  sin visor, el juego se veía entero y no había forma de empezar la partida. Ahora lo decide
  `hasDomUi` —lo pasa quien monta la escena, no lo adivina el juego—, como en los juegos nuevos.

- **Niveles y Prueba sin fin** (los modos como módulos sobre lo que había). `Niveles`
  (`src/lib/levels.ts`) es la escalera del reto una partida cada vez: cada nivel es
  `challengeRound(n)`, ganarlo da estrellas según lo encajado (una por ganar, dos si la máquina
  metió menos de la mitad que tú, tres si no metió ninguno) y una estrella desbloquea el
  siguiente; el progreso vive en el navegador (`src/lib/progress.ts`). El Reto queda como estaba
  (del tirón, a la primera derrota). La **partida sin fin** de Prueba es una partida a infinitos
  goles (`ENDLESS`): la cierra el botón «Terminar» (web y visor) y su récord es la mejor racha
  (`glide-hockey:best-streak:endless`). El nivel activo se congela al empezar la partida.
- Primera versión completa y jugable en escritorio: menú, partida, marcador,
  resumen, récord por modo, y los dos modos.
- Lógica pura y probada: física del disco, máquina rival por niveles, escalera
  del reto, puntuación, estado de la partida.
- Contrato de xrcade cumplido: `<GlideHockeyScene>` (escena), `<GlideHockey>` (con su
  Canvas), `mountGlideHockey`, `exports`/`peerDependencies`/`files`/`bin` en el
  `package.json`, y `npx glide-hockey-assets` para los ficheros estáticos.
- Interfaz inmersiva en geometría: menú, marcador, cuenta atrás y fin de partida.
- Sonido: golpe del mazo, rebote en la banda y gol, sintetizados con la Web
  Audio API (`src/lib/audioEngine.ts`), más el ajuste de silencio en los dos
  menús, guardado entre visitas (`src/lib/muted.ts`).
- El golpe y el rebote suenan y vibran con la fuerza del impacto: la mesa dice
  con qué velocidad se acercaban disco y mazo y con cuál llegó el disco a la
  banda (`Impact`, en `puckPhysics.ts`), y `impactStrength` lo pasa a 0-1 sobre la
  velocidad máxima; el volumen va entre un quinto y el entero y el tono un poco
  más grave cuanto más flojo. Es lo que apaga el disco atrapado en una esquina
  repiqueteando a volumen completo. El gol no lo mira.
- Vibración de los mandos (`src/lib/haptics.ts` + `useGameHaptics`): solo el golpe del mazo
  al disco, en la mano que lo lleva (ver la tanda del 24/09 arriba).
- 150 tests unitarios y 11 de navegador. Lint, tipos y build en verde.

- **v0.3.0 (2026-09-06): la mesa refleja, el disco brilla y roza.** Un **mapa de entorno sin
  fichero**: `RoomEnvironment` de three prefiltrado con `PMREMGenerator` una vez al montar
  (`lib/useRoomEnvironment.ts`), aplicado al tablero y al disco (`envMap`, no
  `scene.environment`: dentro del salón la escena es del anfitrión). La tarea pedía un
  cubemap/HDRI desde `assetsBase`; esto se ve igual y no pide nada por HTTP. El disco lleva
  **emisivo y un halo aditivo que crecen con la velocidad** (`lib/puckGlow.ts`, `Puck.tsx` con un
  ref de velocidad que escribe la pista). Y el **roce del disco** se oye: una voz continua de
  ruido en bucle filtrado en el mismo `AudioContext`, cuyo volumen (raíz de la velocidad, tope
  0,28) y tono (380–1900 Hz) siguen la velocidad con `setTargetAtTime` (`slideLevel`/`slidePitch`
  en `audioEngine.ts`, tests de la curva); no abre el contexto por su cuenta, obedece al silencio
  y se apaga al retirar la pista. `useGameAudio()` devuelve ahora `{ play, slide }`. **Coste
  medido** en llamadas de dibujo (`e2e/mesa.spec.ts`, techo 40): la mesa en el menú se queda en
  **27**, igual que antes; el halo es una malla más solo en partida. **Sin probar con las gafas**:
  ahí hay que mirar si el roce cansa (`SLIDE_MAX_LEVEL`) y si los reflejos cuestan fotogramas.

#### Pendiente / próximos pasos

- Probar con visor de verdad (ver «siguiente paso»).
- No hay test que monte la escena dentro de un Canvas ajeno, como hace el salón.
  Hoy el contrato lo vigila `scripts/scene-contract.test.ts`, que lee el código.

#### Caveats y notas

- **La máquina apunta al lado que el jugador no cubre**, no al centro
  (`aimPoint`). Tirando al medio, un mazo parado delante de la portería es un
  tapón perfecto y la jugada no se acaba nunca: se descubrió porque el e2e
  esperaba un gol que no llegaba.
- **Mirar dentro de la escena**: el disco y los mazos son objetos de three y
  desde el DOM no se pueden leer. La escena publica su estado en
  `window.__glideHockeyScene` **solo si el test crea antes esa ranura**
  (`src/lib/sceneProbe.ts`); en producción es una comprobación por fotograma.
- **Disco muerto**: si se queda parado cuatro segundos se saca de centro. Ningún
  mazo cruza la línea de medio campo, así que un disco quieto donde el otro no
  llega congela la partida.
- **Jugada que no se acaba**: a los veinte segundos sin gol también se saca de
  centro (`RALLY_SECONDS`, en `src/lib/puckPhysics.ts`). El disco muerto no lo
  cogía porque en esos peloteos el disco no se para: rebota igual entre el mazo
  de la máquina y una banda porque ella golpea siempre hacia el mismo sitio. Con
  el mazo del jugador parado, un 4 % de las partidas simuladas no acababa nunca;
  `matchLoop.test.ts` juega doscientas con jitter y exige que ninguna pase del
  minuto.
- El aviso `THREE.Clock deprecated` sale de @react-three/fiber y está en la lista
  de terceros de `e2e/consola.spec.ts`. Cualquier otro aviso hace fallar el test.
- **El reloj de la partida no depende de los fotogramas**: el bucle vive en
  `src/lib/matchLoop.ts` y simula los segundos que ha tardado en llegar cada
  fotograma en **pasos fijos de 1/60 s**; lo que no llega a un paso se guarda
  (`leftover`) y lo juega el fotograma siguiente. Solo se descarta lo que pase
  de un cuarto de segundo, que es una pestaña volviendo de segundo plano.
  Recortar el paso en todos los fotogramas ponía el juego a cámara lenta por
  debajo de 30 fps, y con él el CI en rojo: allí WebGL va por software.
- **El paso tiene que ser fijo, no el fotograma partido en trozos iguales.** La
  mesa es caótica: con el paso atado al ritmo de fotogramas no hay cámara lenta,
  pero cada máquina juega una partida distinta —la misma duraba 11 s a 60 fps,
  24 s a 7 y a 56 no se acababa nunca—. Los tests de `matchLoop.test.ts` miden a
  propósito ritmos que no son múltiplos de 60 (7, 23, 45, 56): con 60/30/15 el
  fallo no se ve, porque ahí el fotograma sí cae justo en pasos de 1/60.
- Los tests de navegador usan el puerto de `PORT`; el 3000 es de Organízate.
- **El contexto de audio se crea con el primer sonido, no al montar la mesa**:
  los navegadores dejan en suspenso cualquier `AudioContext` creado sin que
  nadie haya tocado nada, y la mesa se monta antes de pulsar «Jugar». Silenciar
  lo cierra en vez de bajar el volumen: uno abierto cuenta como que la página
  suena, y en el visor eso agacha la música del sistema.
- **El audio cuelga de la escena (`GameWorld`), no de la mesa (`Rink`).** La
  mesa se estrena en cada partida y en cada ronda del reto (`key={runId}`), así
  que con el reproductor dentro, ganar una ronda cerraba el contexto en el mismo
  fotograma en que sonaba el gol que la ganaba —y abría otro por ronda—. Lo
  vigila la primera prueba de `e2e/sonido.spec.ts`, que juega dos partidas y
  exige un solo contexto.
