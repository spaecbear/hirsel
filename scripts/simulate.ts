/*
 * Balance simulation: bots playing the real game code, many seeded runs on
 * each scale, to see how long a win takes and how often a run is in danger.
 *
 *   npx vite-node scripts/simulate.ts            # 300 runs per bot per scale
 *   npx vite-node scripts/simulate.ts 100        # fewer, faster
 *   BOTS=careful SCALES=hard npx vite-node scripts/simulate.ts   # a subset
 *
 * Two players:
 *
 *   careful  plays the way someone who knows the numbers does: gathers every
 *            night, keeps off the High Corrie, tends a heavy flock, lays in
 *            hay before winter, keeps money in reserve, buys the tools that
 *            pay first.
 *   newcomer plays the way a first run tends to go: forgets to gather about a
 *            third of the time, drives the flock wherever the grass is best
 *            (the corrie included, moon or no moon), buys ewes eagerly with
 *            little in reserve, buys tools in no particular order, and only
 *            thinks about hay once winter is on it. Heeds the full-moon
 *            warning seven times in ten.
 *   learner  the newcomer, but one who has met the wolf once: always heeds
 *            the moon. Everything else as loose as the newcomer, which
 *            shows what else on the hill can end a run.
 *
 * Both answer events with their free default and never use a cheat code.
 * The sim is the game's own: the bots only call the same methods a tap does.
 */
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, BREEDS, CROFT, TOOLS } from "../src/sim/config";
import {
  canShear,
  hayNeeded,
  hayLotCost,
  isFullMoon,
  isWinter,
  moveCost,
  readyToShear,
  season,
  sourAfter,
  weatherOn,
} from "../src/sim/rules";
import { makeRng } from "../src/sim/rng";
import { EVENTS_BALANCE } from "../src/sim/events";
import type { ActionId, BreedId, Difficulty, GameState, ToolId } from "../src/sim/types";

const RUNS = Number(process.argv[2] ?? 300);
// switches for finding what a change does: NO_SOUR=1 NO_HARD_EVENTS=1 NO_GLASS=1
if (process.env.NO_SOUR) Object.assign(BALANCE.sour, { after: 1e9, sickAfter: 1e9 });
if (process.env.NO_GLASS) BALANCE.forecastMissOneIn = Infinity;
if (process.env.NO_HARD_EVENTS) Object.assign(EVENTS_BALANCE, { cragfastChance: 0, footrotChance: 0, floodChance: 0 });
const MAX_DAYS = 700;

type Bot = "careful" | "newcomer" | "learner";

interface Result {
  fullLambing: number | null;
  lambsAtWin: number;
  won: boolean;
  lost: string | null;
  day: number;
  foxLosses: number;
  snowLosses: number;
  strikeLosses: number;
  wolfLosses: number;
  wormLosses: number;
  daysHungry: number;
  lowestMoney: number;
  smallestFlock: number;
  closeCall: boolean;
}

/* ------------------------------------------------------------------ */

function play(bot: Bot, difficulty: Difficulty, seed: number): Result {
  const game = new Game(newGame({ seed, difficulty }));
  game.onAnim = (_a, after) => after?.();
  if (process.env.TRACE) {
    const say = game.say.bind(game);
    game.say = (t, c) => {
      if (/has been in with them|born|slipped|grown now|Bought a|Sold/.test(t)) console.log(`  day ${game.state.day} (${game.state.flock.filter((x) => !x.lamb).length} grown): ${t}`);
      say(t, c);
    };
  }
  const g = game.state;
  const rng = makeRng(seed ^ 0x5eed);
  let lowestMoney = g.money;
  let smallestFlock = g.flock.length;
  let wolfLosses = 0;

  const can = (id: ActionId) => {
    const a = ACTIONS.find((x) => x.id === id)!;
    return a.can(g) && g.taps >= game.costOf(a);
  };
  const act = (id: ActionId) => {
    if (can(id)) {
      game.doAction(id);
      return true;
    }
    return false;
  };
  const money = () => g.money;

  // LAMBS=1: stay on after the wedding, to see when the long-game achievements come
  const keepOn = !!process.env.LAMBS;
  let fullLambing: number | null = null;
  let lambsAtWin = 0;
  let wonOn: number | null = null;
  for (let guard = 0; guard < MAX_DAYS && (!g.over || (keepOn && g.over.kind === "win")); guard++) {
    if (g.over?.kind === "win") {
      wonOn ??= g.day;
      lambsAtWin = g.stats.lambsBorn;
      game.stayOn();
    }
    if (fullLambing === null && g.stats.bestLambing >= 10) fullLambing = g.day;
    // whatever came to the door: the free default, as most players would
    if (g.event) {
      const choices = game.eventChoices();
      const fallback = choices.find((x) => x.choice.fallback);
      const hard = ["cragfast", "footrot", "flood"].includes(g.event.id);
      // the hard ones: a careful player pays to put it right if they can; a newcomer picks one at random
      const paid = choices.filter((x) => x.ok && !x.choice.fallback);
      const pickIt = hard && paid.length ? (bot === "careful" ? paid[0] : rng() < 0.5 ? paid[Math.floor(rng() * paid.length)] : fallback) : fallback;
      if (pickIt) game.answerEvent(pickIt.choice.id);
    }

    const s = season(g);
    const careful = bot === "careful";
    const heedRate = bot === "learner" ? 1 : 0.7;
    const reserve = careful ? 70 : 25;

    /* ---- the cart: tools, hay, ewes, the croft ---- */
    const toolOrder: ToolId[] = careful
      ? ["crook", "dog", "boots", "shears", "lamp", "tup", "saltlick", "oilskin", "cart"]
      : (["dog", "fiddle", "crook", "tup", "shears", "lamp", "boots", "oilskin", "cart", "saltlick"] as ToolId[]);
    for (const id of toolOrder) {
      const t = TOOLS.find((x) => x.id === id)!;
      if (g.owned[id as keyof typeof g.owned]) continue;
      if (careful && id === "tup" && s.id !== "autumn") continue; // the tup only earns its keep from autumn
      if (money() - t.cost >= reserve) {
        game.buyTool(id);
        break; // one thing a day: a player looks at the cart, buys, and gets on
      }
      if (careful) break; // saving for the next thing in order, not skipping past it
    }

    // hay: the careful player lays it in from late summer; the newcomer when the barn is empty in winter
    const need = hayNeeded(g);
    if (careful ? s.id === "autumn" && g.hay < need : isWinter(g) && g.hay < 10) {
      if (money() - hayLotCost(g) >= reserve * 0.5) game.buyHay();
    }

    // the croft, when it can be paid for with something left over
    if (!g.building) {
      const next = CROFT.find((m) => !g.owned[m.id] && (!m.need || g.owned[m.need]));
      if (next && money() - next.cost >= reserve) game.buyCroft(next.id);
    }

    // ewes: the careful player grows to a dozen; the newcomer buys whenever there is money
    const target = careful ? 12 : 20;
    if (g.flock.filter((x) => !x.lamb).length < target) {
      const breed: BreedId = careful ? "blackface" : (["blackface", "cheviot", "shetland", "hebridean"] as BreedId[])[Math.floor(rng() * 4)];
      if (money() - BREEDS[breed].cost >= reserve + (careful ? 60 : 0)) game.buyEwe(breed);
    }

    /* ---- where the flock is ---- */
    const best = g.pastures.map((p, i) => ({ i, p })).sort((a, b) => b.p.grass * b.p.quality - a.p.grass * a.p.quality)[0];
    if (careful) {
      // the low field and the slope; never the corrie, and off the slope when the grass runs short
      const options = [0, 1].filter((i) => i !== g.at);
      const here = g.pastures[g.at];
      const alt = options.map((i) => g.pastures[i]).sort((a, b) => b.grass - a.grass)[0];
      // and on before the ground goes sour under them
      const sour = (g.groundNights ?? 0) >= sourAfter(g) - 1;
      if (g.at === 2 || sour || (here.grass < 35 && alt && alt.grass > here.grass + 25)) {
        const to = g.at === 2 ? 0 : g.pastures.indexOf(alt);
        if (g.taps >= moveCost(g)) game.moveTo(to);
      }
    } else {
      /*
       * The best grass. On a full-moon day the game says, at dawn and again
       * on the corrie itself, that the high ground is no place to be caught
       * out late; a newcomer takes the hint most of the time, not always.
       */
      const heeds = isFullMoon(g.day) && rng() < heedRate;
      // the game says when the ground is going sour; they take that hint as often as the moon's
      const sourHint = (g.groundNights ?? 0) >= sourAfter(g) && rng() < heedRate;
      const fresh = [0, 1, 2].filter((i) => i !== g.at && !(heeds && i === 2)).sort((a, b) => g.pastures[b].grass - g.pastures[a].grass)[0];
      if (heeds && g.at === 2 && g.taps >= moveCost(g)) game.moveTo(0);
      else if (sourHint && fresh !== undefined && g.taps >= moveCost(g)) game.moveTo(fresh);
      else if (best.i !== g.at && g.pastures[g.at].grass < 50 && !(heeds && best.i === 2) && g.taps >= moveCost(g)) game.moveTo(best.i);
    }

    /* ---- the day's work ---- */
    const plan: ActionId[] = [];
    if (careful || rng() < 0.65) plan.push("gather");
    if (g.building) plan.push("build");
    if (canShear(g) && readyToShear(g.flock) >= (careful ? 3 : 1)) plan.push("shear");
    if (g.wool > 0) plan.push("market");
    if (careful && !g.buffs.tended && (s.id === "summer" || s.id === "spring")) plan.push("tend");
    if (!careful && rng() < 0.2) plan.push("tend");
    if (s.id === "summer" && weatherOn(g).shear && (careful ? g.hay < need + 30 : rng() < 0.3)) plan.push("hay");
    if (here(g) <= BALANCE.muckMaxGrass - 30) plan.push("muck");
    if (g.pubs < BALANCE.pubsToAsk && money() >= BALANCE.pintCost + reserve && CROFT.slice(0, 2).every((m) => g.owned[m.id] || g.building?.id === m.id)) plan.push("pub");
    plan.push("ask");
    // with taps left, the pipes: the flock settles, and a careful player is a fox-wary one
    plan.push(careful ? "music" : "pipe");
    for (const id of plan) {
      if (g.over) break;
      act(id);
    }

    const flockBefore = g.flock.length;
    game.sleep();
    if (g.stats.wolfMaulings > 0 && wolfLosses === 0) wolfLosses = Math.max(0, flockBefore - g.flock.length);
    lowestMoney = Math.min(lowestMoney, g.money);
    smallestFlock = Math.min(smallestFlock, g.flock.length);
  }

  const won = g.over?.kind === "win" || wonOn !== null;
  return {
    fullLambing,
    lambsAtWin: wonOn !== null ? lambsAtWin : g.stats.lambsBorn,
    won,
    lost: won ? null : g.over ? g.over.title : "ran out of days",
    day: wonOn ?? g.day,
    foxLosses: g.stats.foxLosses,
    snowLosses: g.stats.snowLosses,
    strikeLosses: g.stats.strikeLosses,
    wolfLosses,
    wormLosses: g.stats.wormLosses,
    daysHungry: g.stats.daysHungry,
    lowestMoney,
    smallestFlock,
    closeCall: lowestMoney < 15 || smallestFlock <= 2,
  };

  function here(st: GameState) {
    return st.pastures[st.at].grass;
  }
}

/* ------------------------------------------------------------------ */

const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const q = (xs: number[], f: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length * f)];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

console.log(`${RUNS} runs per bot per scale, up to ${MAX_DAYS} days each\n`);
// BOTS=careful,learner SCALES=hard to run a subset
const BOTS = (process.env.BOTS?.split(",") ?? ["careful", "newcomer", "learner"]) as Bot[];
const SCALES = (process.env.SCALES?.split(",") ?? ["gentle", "steady", "hard"]) as Difficulty[];
for (const bot of BOTS) {
  for (const diff of SCALES) {
    const rs: Result[] = [];
    for (let i = 0; i < RUNS; i++) rs.push(play(bot, diff, 1000 + i));
    const wins = rs.filter((r) => r.won);
    const losses = rs.filter((r) => r.lost && r.lost !== "ran out of days");
    const reasons = new Map<string, number>();
    for (const r of losses) reasons.set(r.lost!, (reasons.get(r.lost!) ?? 0) + 1);
    const days = wins.map((r) => r.day);
    console.log(`${bot.padEnd(9)} ${diff.padEnd(7)} won ${pct(wins.length, RUNS).padStart(4)}  lost ${pct(losses.length, RUNS).padStart(4)}  unfinished ${pct(RUNS - wins.length - losses.length, RUNS).padStart(4)}`);
    console.log(`   win on day: median ${median(days)}, middle half ${q(days, 0.25)}-${q(days, 0.75)}, fastest ${Math.min(...days)}`);
    console.log(
      `   per run: ${mean(rs.map((r) => r.foxLosses)).toFixed(1)} to the fox, ${mean(rs.map((r) => r.snowLosses)).toFixed(1)} to snow, ${mean(rs.map((r) => r.strikeLosses)).toFixed(1)} to flystrike, ${mean(rs.map((r) => r.wolfLosses)).toFixed(1)} to the wolf, ${mean(rs.map((r) => r.wormLosses)).toFixed(1)} to worms, ${mean(rs.map((r) => r.daysHungry)).toFixed(1)} hungry nights`,
    );
    console.log(`   met the wolf without the sword in ${pct(rs.filter((r) => r.wolfLosses > 0).length, RUNS)} of runs`);
    console.log(`   a close call (purse under £15 or flock down to 2): ${pct(rs.filter((r) => r.closeCall).length, RUNS)} of runs`);
    if (reasons.size) console.log(`   lost to: ${[...reasons].map(([k, v]) => `${k} (${v})`).join(", ")}`);
    if (process.env.LAMBS) {
      const l25 = rs.map((r) => r.fullLambing).filter((d): d is number => d !== null);
      console.log(`   lambs born by the wedding: median ${median(wins.map((r) => r.lambsAtWin))}`);
      console.log(`   a full lambing (ten in a spring) in ${pct(l25.length, RUNS)} of runs, on day: median ${median(l25)} (year ${Math.ceil(median(l25) / 96)}), middle half ${q(l25, 0.25)}-${q(l25, 0.75)}`);
    }
    console.log("");
  }
}
