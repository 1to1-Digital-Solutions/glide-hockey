# Credits of the Godot package

What travels in Glide Hockey's `.pck` and comes from outside the project. It is the same the web
serves from `public/` (its `public/CREDITS.md`), copied into the package: the table, the puck, the
mallets and the room are geometry generated in code, and the effects are rendered from the web's
`audioEngine.ts`.

## Background music — `music/sala.mp3`

[Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k), by
The Cynic Project, published on OpenGameArt under **CC0** (public domain). It is credited as a
courtesy. It is the one in `public/audio/sala.mp3`, byte for byte (`npm run godot:sfx` copies it).

## Controllers — `mandos/`

The models and the profiles of the Quest controllers from
[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), by the W3C's
Immersive Web group: the ones the tutorial shows in the hand and the hint shows beside the ghost
mallet, with the button in question lit. `npm run godot:controllers` copies them from
`public/webxr-profiles/`.

**MIT** licence, which requires carrying the notice in every copy. It goes whole in
`mandos/LICENSE.md`, and here:

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
