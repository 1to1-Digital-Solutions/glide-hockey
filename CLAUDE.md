# CLAUDE.md — air-hockey

**Qué es:** Juego de air hockey para poder jugar contra la maquina. Elegir dificultad en el menu de inicio y a cuantos goles se juega. Es el juego de mesa que sale aire, y hay un disco de hockey en la mesa. Los jugadores, uno en frente de otro, tiene una cosa en la mano para empujar el disco.
Al igual que otros juegos de xrcade, dos modos: modo practica y modo reto. En el modo reto, se va subiendo la dificultad y el numero de goles.
Tambien hay que meter puntuacion por cada gol que se mete (y se resta por cada gol que te meten).

Este proyecto es un juego de **xrcade**: se monta DENTRO del salón inmersivo del hub, no se enlaza. Publica una **escena** (objetos de three), nunca una aplicación: sin `<Canvas>`, sin `XRStore` y sin abrir ni cerrar la sesión de WebXR, que es del anfitrión. Su propia web es un anfitrión más, para poder probar `air-hockey` con el visor sin levantar xrcade. El contrato completo, con lo que exige el `package.json`, está en `docs/xrcade.md`: cúmplelo desde el primer commit.

**Cómo se construye:** sigue las reglas de `.claude/rules/` (arquitectura, seguridad, diseño,
git) en cada cambio. Lee primero el contexto del repo, haz el cambio mínimo y enfocado, reutiliza
antes de crear y verifica (typecheck/lint/build/tests) antes de dar nada por terminado.

**Estado y siguiente paso:** ver **`ESTADO.md`** — ese fichero es el handoff entre sesiones e
indica qué toca hacer ahora.

**Decisiones firmes:**
- (Documenta aquí las decisiones de stack y producto que no se renegocian: lenguaje, framework,
  base de datos, despliegue, etc.)
- Commits manuales: no commitear sin que se pida.

> Base instalada con la suite de Organízate. Las reglas comunes viven en `.claude/rules/` y los
> agentes reutilizables en `.claude/agents/`. La provenance de lo instalado está en
> `.organizate/install-state.json`.
