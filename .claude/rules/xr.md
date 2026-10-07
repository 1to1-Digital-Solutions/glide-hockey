# Juegos de xrcade (WebXR)

Lo que todos los juegos acabaron necesitando, para no volver a descubrirlo a tropezones. El
contrato de montaje —escena, no aplicación— está en `docs/xrcade.md` del repo; esto es lo demás.

Esta regla se carga siempre y por eso es corta. Lo demás se carga cuando toca:
`.claude/rules/xr-three.md` (trampas de three y de WebXR, y lo que aprendieron los tests) al
tocar código de escena o tests, y la skill `interaccion-en-el-visor` (lo que enseñó probar con
el visor y las ayudas visuales) al diseñar o cambiar interacción, menús, tutoriales o ayudas.

- **Dentro del Canvas no hay `<Text>` de drei.** La CSP del salón bloquea las fuentes que
  `<Text>` baja de un CDN. Las letras del visor se dibujan en un lienzo 2D que se pega como
  textura (`canvasPanel.tsx`, con la fuente pedida por `panelFont`) y se miden (abajo). Los
  iconos, por forma y color (nunca solo color). Fuera del Canvas, la web del juego tiene DOM.
- **El anfitrión manda sobre la sesión y el origen.** Sin `<Canvas>`, sin `XRStore`, sin
  `enterVR`/`session.end`, sin `<XROrigin>`. Los estáticos se leen desde `assetsBase`; el
  perfil de mandos (`webxr-profiles`) lo sirve ya el hub.
- **Sin wasm ni red.** La CSP no compila WebAssembly ni deja conectar a otro origen: nada de
  Rapier/Jolt ni multijugador en red. La física se escribe a mano (parábolas, rozamiento,
  modelos de estabilidad) y se prueba como funciones puras.
- **Modelos: primero geometría en código, luego el kit.** Low-poly de colores planos, sin
  texturas grandes: el salón son diecisiete juegos y cada textura se paga en cada uno. Un
  modelo de fuera tiene que ser de una fuente que valga para Steam, ir sin Draco, KTX2 ni
  cuantización (el navegador no los decodifica sin wasm y Godot no lee la cuantización) y
  constar en `public/CREDITS.md`. Si lo va a usar más de un juego, entra en el kit de
  `xrcade/kit/` y se reparte con `comunes.py --repartir`. Todo en `xrcade/docs/assets.md`.
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
- **La misión se entiende en tres segundos.** El menú abre en el modo que da medalla, que se
  llama «Reto» («Challenge»), y dice de cada modo si cuenta. El objetivo se lee de frente con
  `CartelDeObjetivo`, sin tapar blanco ni trayectoria; la frase de misión cabe en una línea a
  ≥1° (una larga encoge por debajo de lo legible) y lo que dice el cartel se quita del
  marcador. Récord separado por modo; al volver al menú, el título recoge el foco.
- **Se nace donde se juega.** Lo que se coge, al alcance sin dar un paso; ninguna línea de
  falta bajo los pies; si el juego desplaza al jugador, se ve en el suelo dónde ponerse. El
  salón planta el juego bajo la cabeza del instante de entrar y con el rumbo del arco de
  cabinas, no el de la mirada.
- **Un objeto a dos manos lo manda el puño de la mano buena** y la segunda corrige, con
  puertas (separación y ángulo) y rampa, como `batting-cage/src/lib/agarreDelBate.ts`: cerrar
  la segunda mano nunca mueve la punta de golpe.
- **Nada que ocupe buena parte del campo de visión cambia de brillo en un fotograma**, y el
  instante del golpe no compila programas ni sube más de un lienzo: se precalienta antes.
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

**La queja más repetida con las gafas puestas** es «el texto se superpone», «no se entiende
nada»: en el aviso de salir, los ajustes, el marcador y los tutoriales. Un panel se pinta en un
lienzo que **nadie mira al tamaño al que se lee**, y que dos renglones se pisen no se nota hasta
tenerlo delante de la cara.

Así que no hay regla de estilo, hay un instrumento: `components/xr/legibilidad.ts`, el mismo
fichero en todos los juegos.

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
5. **La fuente se pide en píxeles de verdad.** Pedida en metros (`0.03px`) sobre un lienzo
   escalado, el navegador del visor amontona las letras aunque las cajas no se pisen.
   `panelFont(peso, metros)` en `canvasPanel.tsx` escala el lienzo y pide la fuente en píxeles;
   el lienzo que apunta rechaza cualquier texto pedido por debajo de `MIN_FUENTE_PX`.

Lo que la regla **no** cubre y sigue pidiendo gafas: si el panel está a una distancia cómoda, si
lo tapa el decorado y si el contraste aguanta la luz de la escena. Eso va a
`docs/pendiente-de-visor.md`.
