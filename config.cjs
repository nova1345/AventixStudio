// Single source of truth for games + team (used by server.cjs and scripts/build-data.cjs)
const GAMES = [
  { name: "NPC Battle Arena",    placeId: "70687173496438",  universeId: "10542745581" },
  { name: "Build A Buddy",       placeId: "18808541784",     universeId: "6372942215" },
  { name: "Where Am I",          placeId: "123243055683524", universeId: "6938969105" },
  { name: "Own a Grocery Store", placeId: "117985153726741", universeId: "10553704684" },
];

const TEAM = [
  { id: "11945072554", name: "BuiltOnProfit",     role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
  { id: "105519417",  name: "Syveric",     role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it.", portfolio: "https://viken.games/" },
  { id: "1117152954", name: "Bubushniki",  role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
  { id: "3382361537", name: "Being_Built", role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
];

module.exports = { GAMES, TEAM };
