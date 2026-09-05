# Everyload

A website where every load is a full-screen piece of generative art.

Dependency-free: `index.html` + `app.js`. On each load it seeds a PRNG, picks
an art system and palette (weighted by your taste, see below), and renders
full-screen at device-pixel resolution. Many systems are alive — simulations
and shaders that keep evolving with subtle ambient motion. Colors interpolate
in OKLab space; static pieces get a film-grain finish.

## Art systems

Static / drifting:

- **flow field** — thousands of particles tracing fractal-noise currents
- **circle pack** — packed circles, filled, ringed, and concentric
- **ridgelines** — stacked noise-displaced ridges
- **watercolor** — layered translucent deformed blobs
- **mosaic** — recursive subdivision color blocks with circle accents
- **halos** — broken concentric arcs, rings slowly counter-rotating
- **truchet** — multi-scale quarter-arc tiles forming winding pipes
- **contours** — topographic map whose elevation lines slowly migrate

Living simulations:

- **physarum** — slime-mold agents growing vein networks (auto-exposed display)
- **reaction-diffusion** — Gray-Scott chemistry blooming coral/mitosis patterns
- **attractor** — De Jong strange attractor, log-density render, params vetted
  for chaos at init and slowly morphing over time
- **silk** — GPU domain-warped flowing gradients (raw WebGL fragment shader;
  skipped gracefully if WebGL is unavailable)
- **night sky** — nebula, twinkling stars, occasional meteor

## Controls

- **♥ / Y / ↑** — more like this (keeps the piece on screen)
- **✕ / N / X / ↓** — not for me (refreshes to a new piece)
- **Click / space / R** — new piece, no feedback recorded
- **S** — save the current piece as a PNG
- **`?seed=N&sys=X&pal=Y`** — recreate a specific piece (seed shows in the corner label)

Resizing re-renders the same seed at the new dimensions.

## Taste memory

Every ♥/✕ tallies a vote for the piece's art system and its palette, stored in
`localStorage` under `everyload-prefs` (per browser, never leaves your machine).
New pieces sample systems and palettes in proportion to their smoothed
acceptance rate — loved styles show up more, rejected ones fade, but nothing
drops to zero, so everything keeps a small chance to win you back.

To wipe your taste profile, run `localStorage.removeItem('everyload-prefs')`
in the browser console.

## Run / deploy

Static files — serve the folder with the dev server (sends no-cache headers so
edits always show):

```bash
python3 serve.py
```

Deploys as-is to GitHub Pages, Netlify, Cloudflare Pages, or any static host
(don't deploy `serve.py`; bump the `?v=` on the `app.js` script tag in
`index.html` when releasing changes so cached copies refresh).

Dev note: browsers pause `requestAnimationFrame` for hidden tabs, so
simulations freeze while the page isn't visible. In the console,
`__pump(n)` advances the current piece n frames manually.
