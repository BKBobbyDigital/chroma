# CHROMA

A Pipe Mania–style puzzle game set in a rain-soaked cyberpunk city. Lay pipe from the dispenser before the Chroma starts flowing, and keep it moving long enough to bring each sector back online.

Plain HTML, CSS and JavaScript, no build step. Installable as a web app on phones (add to home screen) and playable offline once opened.

## Run locally

```bash
python3 -m http.server 8642
```

Then open http://localhost:8642.

## Files

- `game.js` — the whole game: rules, levels, rendering, the city backdrop, input and sound. Tunable numbers (timings, scoring, level difficulty) are at the top.
- `style.css`, `index.html` — page layout and the overlay panels.
- `manifest.webmanifest`, `sw.js`, `icons/` — the installable app pieces. Bump `VERSION` in `sw.js` when you ship changes.
- `tools/make_icons.py` — regenerates the app icons (`python3 tools/make_icons.py icons`, needs Pillow).
- `mockups/` — early UI direction explorations.

## Deploy

Netlify serves the repo root as-is (see `netlify.toml`).
