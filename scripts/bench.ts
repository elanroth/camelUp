import { runBotGame } from '../src/model/botGame';
import { greedyEVBot, alwaysRollBot } from '../src/model/bots';
const t = Date.now();
for (let i = 0; i < 5; i++) runBotGame([greedyEVBot, alwaysRollBot], { seed: i });
console.log('5 games:', Date.now() - t, 'ms');
