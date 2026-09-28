// Single source of truth for games + team (used by server.cjs and scripts/build-data.cjs)
const GAMES = [
  { name: "My Nuke Farm",        placeId: "123042384638400", universeId: "10551750534" },
  { name: "1 Speed ASMR Escape", placeId: "108914645067573", universeId: "10241080118" },
  { name: "NPC Battle Arena",    placeId: "70687173496438",  universeId: "10542745581" },
  { name: "Build A Buddy",       placeId: "18808541784",     universeId: "6372942215" },
  { name: "Rain to Grow",        placeId: "138282251986725", universeId: "10458283695" },
  { name: "Where Am I",          placeId: "123243055683524", universeId: "6938969105" },
  { name: "My Gas Station",      placeId: "132942260607514", universeId: "10749062975" },
  { name: "Own a Grocery Store", placeId: "117985153726741", universeId: "10553704684" },
];

const TEAM = [
  { id: "1169941746", name: "DaFnxEl",     role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
  { id: "105519417",  name: "Syveric",     role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it.", portfolio: "https://viken.games/" },
  { id: "1117152954", name: "Bubushniki",  role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
  { id: "3382361537", name: "Being_Built", role: "Founder & Studio Lead", blurb: "Maintains Aventix Studios and the core behind it." },
];

module.exports = { GAMES, TEAM };
