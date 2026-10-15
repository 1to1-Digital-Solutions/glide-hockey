# Credits for the static files

Everything in `public/` comes from outside the project. Here is where from,
under which licence and what that licence requires, because it is what gets
copied into the `public/` of whoever mounts the game (`npx glide-hockey-assets`)
and travels with it.

The rest of the game —the table, the puck, the mallets, the room— is geometry
generated in code, and the hits and the goals are oscillators: there are no
models or textures to credit, and the only sound file is the background music.

## Background music — `audio/sala.mp3`

[Calm Ambient 1 (Synthwave 4k)](https://opengameart.org/content/calm-ambient-1-synthwave-4k),
by The Cynic Project, published on OpenGameArt under **CC0** (public domain):
it can be used and modified without attribution. It is credited anyway as a
courtesy.

They are calm pads lasting two and a half minutes, which is what the background
of an arcade calls for: it is heard when nothing is happening and disappears
under the puck as soon as there is one. It is served in mono at 64 kbps (1.2 MB)
because it sits in the background at low volume; the original is 6 MB in stereo
at 320. It starts and ends almost in silence, so the loop has no seam.

## WebXR controller profiles — `webxr-profiles/`

[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles)
v1.0.20, by the W3C Immersive Web group. They are the button map of each
controller; without them, `@react-three/xr` never gets to register any (see
`scripts/sync-xr-profiles.mjs`). They are copied with `npm run sync:xr-profiles`.

**MIT** licence, which requires carrying the notice in every copy:

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
