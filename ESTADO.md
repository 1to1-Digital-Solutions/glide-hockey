# Estado de la sesión — air-hockey (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

## ⏭️ SIGUIENTE PASO (lo primero al volver)

- Probar el juego **con el visor** (`npm run dev:https`): es lo único de la
  primera versión que no ha visto nadie. Mirar sobre todo si se puede jugar
  apuntando con el rayo del mando y si el menú inmersivo se lee y se pulsa. Y la
  vibración: que el golpe (0,7 × 45 ms) se sienta como golpe, que el rebote
  (0,25 × 20 ms) no moleste en una jugada larga contra la banda y que el gol
  (0,5 × 120 ms, dos manos) se distinga. Las recetas están en `src/lib/haptics.ts`.

## Qué es air-hockey

- Air hockey contra la máquina, en 3D, para navegador y visor. Dos modos:
  **prueba** (eliges nivel y goles) y **reto** (escalera que sube sola). Cada gol
  suma puntos; cada gol encajado los resta.
- Es un juego de **xrcade**: publica una escena que el salón monta dentro de su
  propio Canvas. Su web es un anfitrión más (ver `docs/xrcade.md`).

## Decisiones firmes

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

## Hecho hasta ahora

- Primera versión completa y jugable en escritorio: menú, partida, marcador,
  resumen, récord por modo, y los dos modos.
- Lógica pura y probada: física del disco, máquina rival por niveles, escalera
  del reto, puntuación, estado de la partida.
- Contrato de xrcade cumplido: `<AirHockeyScene>` (escena), `<AirHockey>` (con su
  Canvas), `mountAirHockey`, `exports`/`peerDependencies`/`files`/`bin` en el
  `package.json`, y `npx air-hockey-assets` para los ficheros estáticos.
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
- Vibración de los mandos (`src/lib/haptics.ts` + `useGameHaptics`): los mismos
  tres sucesos que el sonido, sin obedecer al silencio. El golpe y el rebote van
  a la mano que lleva el mazo —la del último mando que lo movió, que la mesa
  apunta en cada `onPointerMove`—; el gol, a las dos. Hasta que un mando mueve
  el mazo, el golpe va a las dos manos.
- 150 tests unitarios y 11 de navegador. Lint, tipos y build en verde.

## Pendiente / próximos pasos

- Probar con visor de verdad (ver «siguiente paso»).
- No hay test que monte la escena dentro de un Canvas ajeno, como hace el salón.
  Hoy el contrato lo vigila `scripts/scene-contract.test.ts`, que lee el código.

## Caveats y notas

- **La máquina apunta al lado que el jugador no cubre**, no al centro
  (`aimPoint`). Tirando al medio, un mazo parado delante de la portería es un
  tapón perfecto y la jugada no se acaba nunca: se descubrió porque el e2e
  esperaba un gol que no llegaba.
- **Mirar dentro de la escena**: el disco y los mazos son objetos de three y
  desde el DOM no se pueden leer. La escena publica su estado en
  `window.__airHockeyScene` **solo si el test crea antes esa ranura**
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
