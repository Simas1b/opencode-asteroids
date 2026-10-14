# AGENTS.md

## Project

Pure HTML5 Canvas Asteroids clone. No frameworks, no bundler, no `package.json`, no dependencies.
UI text, comments, and game messages are in Spanish — keep that convention.

## Run / verify

- No build, lint, test, or typecheck tooling exists. Do not invent commands.
- Run with `npx serve .` (then `http://localhost:3000`) or open `index.html` directly.
- Verify changes manually in a browser; there is no automated test suite.

## Layout

- `index.html` — canvas is hardcoded to `800x600`, loads `game.js` as a classic script (not a module).
- `game.js` — entire game in one file; `W`/`H` constants must stay in sync with the canvas size in `index.html`.
- `favicon.svg` — static asset.

## game.js structure

- `'use strict'`, ES6 classes: `Bullet`, `Asteroid`, `Ship`, `Particle`. No `import`/`export`.
- Game state machine on `state`: `'playing' | 'dead' | 'gameover'`.
- One shared `requestAnimationFrame` loop; `update(dt)` is delta-time based (seconds, capped at `0.05`).
- Space is toroidal: always move entities via `wrap(v, max)`, never clamp.
- Input: `keys[...]` for held keys, `pressed(code)` for one-shot edges. `pressed()` clears its flag on read, so call it exactly once per frame per action (see shooting in `update`).
- Asteroid sizing is index-based: `RADII`/`SPEEDS`/`POINTS` arrays are indexed by `size` 1–3 (index 0 unused). Splitting lowers `size` until 1.

## Stale docs warning

`README.md` claims power-ups and a "estrella fugaz" asteroid type; neither is implemented in `game.js`. Trust the code, not the README, and don't assume those features exist.
