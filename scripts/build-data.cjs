// Fetches live Roblox stats + team avatars and writes ../data.json.
// Runs in GitHub Actions (clean IPs, official Roblox API — no shared-proxy rate limits).
const fs = require('fs');
const path = require('path');
const { GAMES, TEAM } = require('../config.cjs');

const HOSTS = ['roblox.com', 'roproxy.com'];
async function j(sub, pq) {
  let lastErr;
  for (const host of HOSTS) {
    try {
      const r = await fetch(`https://${sub}.${host}${pq}`, { headers: { accept: 'application/json', 'user-agent': 'AventixStatsBot' } });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

(async () => {
  // resolve any missing universe ids
  for (const g of GAMES) {
    if (!g.universeId) { try { const d = await j('apis', `/universes/v1/places/${g.placeId}/universe`); g.universeId = String(d.universeId); } catch {} }
  }
  const ids = GAMES.filter(g => g.universeId).map(g => g.universeId);
  const stats = {}, thumbs = {};
  try { const d = await j('games', `/v1/games?universeIds=${ids.join(',')}`); d.data.forEach(x => stats[x.id] = x); } catch (e) { console.log('games fetch failed', e.message); }
  try { const d = await j('thumbnails', `/v1/games/multiget/thumbnails?universeIds=${ids.join(',')}&countPerUniverse=1&defaultRowSize=1&size=768x432&format=Png&isCircular=false`); d.data.forEach(x => { if (x.thumbnails && x.thumbnails[0] && x.thumbnails[0].imageUrl) thumbs[x.universeId] = x.thumbnails[0].imageUrl; }); } catch (e) { console.log('thumbs fetch failed', e.message); }

  let tv = 0, tp = 0, res = 0;
  const games = GAMES.map(g => {
    const s = stats[g.universeId];
    if (s) { tv += s.visits || 0; tp += s.playing || 0; res++; }
    return { name: (s && s.name) || g.name, placeId: g.placeId, universeId: g.universeId || null, visits: s ? (s.visits || 0) : null, playing: s ? (s.playing || 0) : null, thumb: thumbs[g.universeId] || null, url: `https://www.roblox.com/games/${g.placeId}` };
  });
  games.sort((a, b) => (b.playing || 0) - (a.playing || 0));

  const uids = [...new Set(TEAM.map(t => t.id))];
  const heads = {};
  try { const d = await j('thumbnails', `/v1/users/avatar-headshot?userIds=${uids.join(',')}&size=420x420&format=Png&isCircular=false`); d.data.forEach(x => { if (x.state === 'Completed' && x.imageUrl) heads[x.targetId] = x.imageUrl; }); } catch (e) { console.log('avatars fetch failed', e.message); }
  const team = TEAM.map(t => ({ id: t.id, name: t.name, role: t.role, blurb: t.blurb, avatar: heads[t.id] || null, profile: t.portfolio || `https://www.roblox.com/users/${t.id}/profile` }));

  // Load previous data.json and keep any last-good value the fetch missed this run
  const outPath = path.join(__dirname, '..', 'data.json');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch {}
  const prevGames = Object.fromEntries((prev.games || []).map(g => [g.placeId, g]));
  const prevTeam = Object.fromEntries((prev.team || []).map(m => [m.id, m]));
  games.forEach(g => { const p = prevGames[g.placeId]; if (p) { if (g.visits == null) g.visits = p.visits; if (g.playing == null) g.playing = p.playing; if (!g.thumb) g.thumb = p.thumb; } });
  team.forEach(m => { const p = prevTeam[m.id]; if (p && !m.avatar) m.avatar = p.avatar; });
  // recompute totals from merged values
  tv = games.reduce((a, g) => a + (g.visits || 0), 0);
  tp = games.reduce((a, g) => a + (g.playing || 0), 0);
  res = games.filter(g => g.visits != null).length;

  const out = { updated: Date.now(), count: GAMES.length, resolved: res, totalVisits: tv, totalPlaying: tp, games, team };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`data.json written: ${res}/${GAMES.length} games, ${Object.keys(heads).length}/${uids.length} avatars this run`);
})();
