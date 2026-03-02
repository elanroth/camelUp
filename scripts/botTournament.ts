// Quick tournament: run every bot against every other bot for 200 games.
import { runBotMatch } from '../src/model/botGame';
import {
  alwaysRollBot,
  greedyEVBot,
  thresholdBot,
  raceBetBot,
  conservativeBot,
  randomBot,
  named,
} from '../src/model/bots';
import { makePrng } from '../src/model/simulator';

const rng = makePrng(42);

const roster = [
  named('alwaysRoll',    alwaysRollBot),
  named('greedyEV',      greedyEVBot),
  named('threshold2',    thresholdBot(2)),
  named('conservative',  conservativeBot),
  named('raceBet50',     raceBetBot({ winnerThreshold: 0.5, loserThreshold: 0.5, takeLegBets: false })),
  named('raceBet+legs',  raceBetBot({ winnerThreshold: 0.45, loserThreshold: 0.45, takeLegBets: true })),
  named('random',        randomBot(rng)),
];

const GAMES = 10;

console.log(`\n=== Camel Up Bot Tournament (${GAMES} games each match) ===\n`);

// 1. Head-to-head matrix: every pair
const wins: Record<string, Record<string, number>> = {};
for (const a of roster) wins[a.name] = {};

for (let i = 0; i < roster.length; i++) {
  for (let j = i + 1; j < roster.length; j++) {
    const a = roster[i];
    const b = roster[j];
    const match = runBotMatch(
      [a.strategy, b.strategy],
      GAMES,
      { baseSeed: 1337 }
    );
    const wa = match.wins[0];
    const wb = match.wins[1];
    wins[a.name][b.name] = wa;
    wins[b.name][a.name] = wb;
  }
}

// 2. Free-for-all: top 4 bots (by index) in one game
const ffaRoster = roster.slice(0, 4);
const ffa = runBotMatch(
  ffaRoster.map(r => r.strategy),
  GAMES,
  { baseSeed: 9999 }
);

// 3. Print head-to-head table
const names = roster.map(r => r.name);
const colW = 14;
const pad = (s: string, w = colW) => s.padEnd(w).slice(0, w);

console.log('HEAD-TO-HEAD (wins out of ' + GAMES + ')');
console.log(pad('') + names.map(n => pad(n)).join(''));
for (const a of names) {
  const row = names.map(b =>
    a === b ? pad('—') : pad(String(wins[a][b] ?? 0))
  ).join('');
  console.log(pad(a) + row);
}

// 4. Win totals from head-to-head
const totals = names.map(a => ({
  name: a,
  total: names.filter(b => b !== a).reduce((s, b) => s + (wins[a][b] ?? 0), 0),
})).sort((x, y) => y.total - x.total);

console.log('\nHEAD-TO-HEAD STANDINGS');
console.log(pad('Bot', 16) + pad('Wins'));
for (const { name, total } of totals) {
  console.log(pad(name, 16) + total);
}

// 5. Free-for-all standings
console.log(`\nFREE-FOR-ALL top-4 (${ffaRoster.length} bots, ${GAMES} games)`);
console.log(pad('Bot', 16) + pad('Wins') + pad('Avg Coins'));
for (let i = 0; i < ffaRoster.length; i++) {
  const name = ffaRoster[i].name;
  const w = ffa.wins[i];
  const coins = ffa.avgCoins[i].toFixed(1);
  console.log(pad(name, 16) + pad(String(w)) + coins);
}

console.log('\nDone.');
