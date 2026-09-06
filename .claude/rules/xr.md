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
