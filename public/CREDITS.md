# Créditos de los ficheros estáticos

Todo lo que hay en `public/` viene de fuera del proyecto. Aquí queda de dónde,
con qué licencia y qué obliga esa licencia, porque es lo que se copia al
`public/` de quien monte el juego (`npx glide-hockey-assets`) y viaja con él.

El resto del juego —la mesa, el disco, los mazos, la sala— es geometría
generada en código, y los golpes y los goles son osciladores: no hay modelos ni
texturas que acreditar, y el único fichero de sonido es la música de fondo.

## Música de fondo — `audio/sala.mp3`

[Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k),
de The Cynic Project, publicada en OpenGameArt bajo **CC0** (dominio público):
se puede usar y modificar sin atribución. Se acredita igualmente por cortesía.

Son pads tranquilos de dos minutos y medio, que es lo que pide el fondo de un
salón recreativo: se oye cuando no pasa nada y desaparece debajo del disco en
cuanto lo hay. Se sirve en mono a 64 kbps (1,2 MB) porque va de fondo y a poco
volumen; el original son 6 MB en estéreo a 320. Empieza y acaba casi en
silencio, así que el bucle no tiene costura.

## Perfiles de mando de WebXR — `webxr-profiles/`

[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles)
v1.0.20, del grupo Immersive Web del W3C. Son el mapa de botones de cada mando;
sin ellos, `@react-three/xr` no llega a registrar ninguno (ver
`scripts/sync-xr-profiles.mjs`). Se copian con `npm run sync:xr-profiles`.

Licencia **MIT**, que exige llevar el aviso en cada copia:

```
MIT License

Copyright (c) 2019 Amazon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice (including the next
paragraph) shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
