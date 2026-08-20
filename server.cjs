// Aventix Studios — static site + Roblox stats backend (no external deps)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// --- Portfolio (edit here) ---
const GAMES = [
  { name: "My Nuke Farm",              placeId: "123042384638400" },
  { name: "1 Speed ASMR Escape",       placeId: "108914645067573" },
  { name: "Arm Wars",                  placeId: "99768864667481" },
  { name: "Last Word",                 placeId: "117591961586835" },
  { name: "NPC Battle Arena",          placeId: "70687173496438" },
  { name: "Climb Scary Pirate Clark Tower", placeId: "92026803113103" },
  { name: "Build A Buddy",             placeId: "18808541784" },
];

// Try official host first, fall back to roproxy mirror
const HOSTS = ['roblox.com', 'roproxy.com'];

async function j(sub, pathAndQuery) {
  let lastErr;
  for (const host of HOSTS) {
    try {
      const r = await fetch(`https://${sub}.${host}${pathAndQuery}`, {
        headers: { 'accept': 'application/json', 'user-agent': 'Mozilla/5.0 AventixSite' },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const universeCache = new Map(); // placeId -> universeId (permanent)
let statsCache = { time: 0, payload: null };
const TTL = 25000; // 25s

async function resolveUniverse(placeId) {
  if (universeCache.has(placeId)) return universeCache.get(placeId);
  try {
    const d = await j('apis', `/universes/v1/places/${placeId}/universe`);
    universeCache.set(placeId, d.universeId);
    return d.universeId;
  } catch { return null; }
}

async function buildPayload() {
  // resolve universe ids (cached after first run)
  await Promise.all(GAMES.map(async g => { g.universeId = await resolveUniverse(g.placeId); }));
  const ids = GAMES.filter(g => g.universeId).map(g => g.universeId);

  const stats = {}, thumbs = {};
  if (ids.length) {
    try {
      const d = await j('games', `/v1/games?universeIds=${ids.join(',')}`);
      d.data.forEach(x => { stats[x.id] = x; });
    } catch {}
    try {
      const d = await j('thumbnails', `/v1/games/multiget/thumbnails?universeIds=${ids.join(',')}&countPerUniverse=1&defaultRowSize=1&size=768x432&format=Png&isCircular=false`);
      d.data.forEach(x => { if (x.thumbnails && x.thumbnails[0] && x.thumbnails[0].imageUrl) thumbs[x.universeId] = x.thumbnails[0].imageUrl; });
    } catch {}
  }

  let totalVisits = 0, totalPlaying = 0, live = 0;
  const games = GAMES.map(g => {
    const s = stats[g.universeId];
    if (s) { totalVisits += s.visits || 0; totalPlaying += s.playing || 0; live++; }
    return {
      name: (s && s.name) || g.name,
      placeId: g.placeId,
      universeId: g.universeId || null,
      visits: s ? (s.visits || 0) : null,
      playing: s ? (s.playing || 0) : null,
      thumb: thumbs[g.universeId] || null,
      url: `https://www.roblox.com/games/${g.placeId}`,
    };
  });

  games.sort((a, b) => (b.playing || 0) - (a.playing || 0)); // highest CCU first
  return { updated: Date.now(), count: GAMES.length, resolved: live, totalVisits, totalPlaying, games };
}

async function getStats() {
  const now = Date.now();
  if (statsCache.payload && now - statsCache.time < TTL) return statsCache.payload;
  const payload = await buildPayload();
  statsCache = { time: now, payload };
  return payload;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/games') {
    try {
      const data = await getStats();
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream', message: String(e) }));
    }
    return;
  }

  // static files
  let file = url === '/' ? '/index.html' : url;
  const full = path.join(ROOT, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`Aventix running → http://localhost:${PORT}`));
