# Aventix Studios

Website for **Aventix Studios**, a Roblox game development studio — dark, red-themed, with a pinned hero reveal and a live-stats games portfolio.

## Features

- Pinned hero: blurred game collage that sharpens and locks into a grid as you scroll
- Rotating tagline word
- Live **total visits** + **players online now**, pulled from Roblox and refreshed every 30s
- Games portfolio sorted by live CCU (concurrent players), 4-per-row grid
- Discord username copy-to-clipboard, email + X links

## Run locally

Requires Node 18+.

```bash
npm start
# or
node server.cjs
```

Then open http://localhost:3000

## How it works

- `server.cjs` — a zero-dependency Node server. Serves the static site and exposes `/api/games`, which resolves each Roblox place → universe, fetches live visits/players + thumbnails (official Roblox API, RoProxy fallback), sums the totals, and caches for 25s.
- `index.html` — the whole frontend (HTML + CSS + JS). Calls `/api/games` on load and every 30s.

## Editing

- **Games** — edit the `GAMES` array in `server.cjs` (name + Roblox place ID).
- **Contacts** — Discord username, email, and X link live in `index.html`.
- **Logo** — drop a `logo.png` in this folder (used as favicon + nav mark).

## Deploy

Needs a Node host (Render, Railway, Fly.io, a VPS, etc.) — not a static-only host, because the live stats run server-side.
