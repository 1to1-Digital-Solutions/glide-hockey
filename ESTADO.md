# Estado de la sesión — air-hockey (handoff)

> **Cómo continuar tras reiniciar:** di a Claude «revisa `ESTADO.md` y continúa con el siguiente
> paso». Este fichero es la memoria entre sesiones: mantenlo corto, veraz y al día.

---

## ⏭️ SIGUIENTE PASO (lo primero al volver)

- Probar el juego **con el visor** (`npm run dev:https`): es lo único de la
  primera versión que no ha visto nadie. Mirar sobre todo si se puede jugar
  apuntando con el rayo del mando y si el menú inmersivo se lee y se pulsa.

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
- 105 tests unitarios y 6 de navegador. Lint, tipos y build en verde.

## Pendiente / próximos pasos

- Probar con visor de verdad (ver «siguiente paso»).
- Sonido: no hay ninguno. El golpe del mazo y el gol se piden solos.
- El e2e no cubre mover el mazo con el ratón: es la interacción principal y hoy
  solo la respaldan los unitarios de la física.
- No hay test que monte la escena dentro de un Canvas ajeno, como hace el salón.
  Hoy el contrato lo vigila `scripts/scene-contract.test.ts`, que lee el código.

## Caveats y notas

- **La máquina apunta al lado que el jugador no cubre**, no al centro
  (`aimPoint`). Tirando al medio, un mazo parado delante de la portería es un
  tapón perfecto y la jugada no se acaba nunca: se descubrió porque el e2e
  esperaba un gol que no llegaba.
- **Disco muerto**: si se queda parado cuatro segundos se saca de centro. Ningún
  mazo cruza la línea de medio campo, así que un disco quieto donde el otro no
  llega congela la partida.
- El aviso `THREE.Clock deprecated` sale de @react-three/fiber y está en la lista
  de terceros de `e2e/consola.spec.ts`. Cualquier otro aviso hace fallar el test.
- Los tests de navegador usan el puerto de `PORT`; el 3000 es de Organízate.
