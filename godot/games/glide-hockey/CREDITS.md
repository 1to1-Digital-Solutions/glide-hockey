# Créditos del paquete de Godot

Lo que viaja en el `.pck` de Glide Hockey y viene de fuera del proyecto. Es lo mismo que la web sirve
desde `public/` (su `public/CREDITS.md`), copiado al paquete: la mesa, el disco, los mazos y el salón
son geometría generada en código, y los efectos se renderizan del `audioEngine.ts` de la web.

## Música de fondo — `music/sala.mp3`

[Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k), de
The Cynic Project, publicada en OpenGameArt bajo **CC0** (dominio público). Se acredita por
cortesía. Es la de `public/audio/sala.mp3`, byte a byte (la copia `npm run godot:sfx`).

## Mandos — `mandos/`

Los modelos y los perfiles de los mandos de Quest de
[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), del grupo
Immersive Web del W3C: los que enseña el tutorial en la mano y la ayuda junto al mazo fantasma, con
el botón que toca encendido. Los copia `npm run godot:mandos` desde `public/webxr-profiles/`.

Licencia **MIT**, que exige llevar el aviso en cada copia. Va entero en `mandos/LICENSE.md`, y
aquí:

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
