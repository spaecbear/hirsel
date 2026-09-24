/**
 * Headless balance runs.
 *
 *   npx vite-node tools/balance.ts [runs] [days]
 *   WHY=1 npx vite-node tools/balance.ts        # and say how each lost run ended
 *
 * Plays many seeded runs to the end on one fixed, competent policy and prints
 * how they went, per difficulty. The README's balance tables were measured
 * this way; this file is so the next measurement can be repeated rather than
 * rebuilt. Change the game, run it before and after, compare.
 *
 * The policy is deliberately ordinary — what a player who has understood the
 * game would do, not an optimiser. It shears at prime, sells when the price
 * is decent or the purse is thin, buys the kit in a sensible order, grows the
 * flock towards a dozen, builds the croft, does its six evenings at the inn,
 * keeps off the corrie on a full moon, and lays in hay for the winter when
 * the game has one.
 */
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, BREEDS, CROFT } from "../src/sim/config";
import * as rules from "../src/sim/rules";
import type { ActionId, Difficulty, GameState, ToolId } from "../src/sim/types";

const RUNS = Number(process.argv[2] ?? 40);
const DAYS = Number(process.argv[3] ?? 200);

/* seasons may or may not exist in the build being measured — look, don't assume */
const r = rules as Record<string, unknown>;
const seasonOf = r.seasonOf as ((day: number) => { id: string; day: number }) | undefined;
const hayNeeded = r.hayNeeded as ((g: GameState) => number) | undefined;

interface Result {
  alive: boolean;
  endDay: number;
  won: boolean;
  wonDay: number | null;
  moneyAt90: number | null;
  flockAt90: number | null;
  foxLosses: number;
  snowLosses: number;
  /** flock at the end of each of the first four seasons' worth of days */
  flockAt: number[];
  /** dogs retired to the fire by the end of the run */
  retired: number;
  lambs: number;
  /** the day each croft milestone was finished, if it was */
  built: Record<string, number>;
  hungryDays: number;
}

function play(seed: number, difficulty: Difficulty): Result {
  const game = new Game(newGame({ seed, difficulty }));
  game.onAnim = (_a, after) => after?.();
  const g = game.state;
  let moneyAt90: number | null = null;
  let flockAt90: number | null = null;
  let wonDay: number | null = null;
  const flockAt: number[] = [];
  const built: Record<string, number> = {};

  const can = (id: ActionId) => {
    const a = ACTIONS.find((x) => x.id === id);
    return !!a && a.can(g) && g.taps >= game.costOf(a);
  };
  const act = (id: ActionId) => {
    // a run can end mid-day (the ask, the last sheep sold); doAction then does nothing
    if (g.over || !can(id)) return false;
    game.doAction(id);
    return true;
  };

  const TOOL_ORDER: ToolId[] = ["crook", "dog", "boots", "tup", "shears", "cart", "lamp", "saltlick"];

  while (!g.over && g.day <= DAYS) {
    const season = seasonOf?.(g.day).id;

    /*
     * What the winter will ask of the purse: the feed bill through to spring,
     * and the hay the barn is short of. A player who has read the autumn
     * warning keeps this back; spending into it is how runs die in January.
     */
    const s = seasonOf?.(g.day);
    const nightsToSpring = !s ? 0 : s.id === "winter" ? s.left + 1 : s.id === "autumn" ? s.left + 1 + 24 : 0;
    const hayShort = hayNeeded ? Math.max(0, hayNeeded(g) - (g as GameState & { hay: number }).hay) : 0;
    const winterReserve = nightsToSpring * rules.feedCost(g) + (s && s.id !== "winter" ? Math.ceil(hayShort / 10) * 5 : 0);

    /* ---- the steading: money, never taps ---- */
    for (const t of TOOL_ORDER) {
      const cost = { crook: 18, dog: 58, boots: 26, tup: 48, shears: 32, cart: 74, lamp: 44, saltlick: 28 }[t as string] ?? 999;
      if (!rules.owns(g, t) && g.money >= cost + 25 + winterReserve) game.buyTool(t);
    }
    // grow the flock towards a dozen, but not in the teeth of winter
    const reserve = 30 + rules.feedCost(g) * 6;
    if (g.flock.length < 12 && g.money >= BREEDS.blackface.cost + reserve && season !== "winter" && g.money >= BREEDS.blackface.cost + reserve + winterReserve / 3) {
      game.buyEwe("blackface");
    }
    // lambs past what the hill wants go to the autumn sales, the rest are kept
    if (season === "autumn") {
      const lambs = g.flock.filter((x) => (x as { lamb?: boolean }).lamb);
      let over = g.flock.length - 14;
      for (const l of lambs) {
        if (over-- <= 0) break;
        game.sellEwe(l.id);
      }
    }
    // hay for the winter: in autumn, buy what the barn is short of
    if (hayNeeded && season === "autumn" && s && s.left <= 8) {
      const short = hayNeeded(g) - (g as GameState & { hay: number }).hay;
      const buy = (game as unknown as { buyHay?: () => void }).buyHay;
      for (let i = 0; i < 20 && short > 0 && buy; i++) {
        const before = (g as GameState & { hay: number }).hay;
        if (hayNeeded(g) - before <= 0 || g.money < 15 + (s!.left + 25) * rules.feedCost(g)) break;
        buy.call(game);
        if ((g as GameState & { hay: number }).hay === before) break;
      }
    }
    // the croft, once there is a cushion behind it
    if (!g.building) {
      const next = CROFT.find((m) => !rules.owns(g, m.id) && (!m.need || rules.owns(g, m.need)));
      if (next && g.money >= next.cost + 40 + winterReserve) game.buyCroft(next.id);
    }
    if (!rules.owns(g, "sword") && rules.owns(g, "hearth") && g.money >= 185 + 60 + winterReserve) game.buyTool("sword");

    /* ---- the day ---- */
    // keep off the high ground on a full moon; otherwise go where the grass is
    const moon = rules.isFullMoon(g.day);
    const score = (i: number) => {
      const p = g.pastures[i];
      if (moon && i === 2) return -1;
      return Math.min(p.grass, g.flock.length * BALANCE.grazePerSheep) * p.quality - p.risk * 40;
    };
    const best = [0, 1, 2].reduce((a, b) => (score(b) > score(a) ? b : a));
    if (best !== g.at && score(best) > score(g.at) * 1.25 + 5 && g.taps > 1) game.moveTo(best);

    act("ask");
    const prime = g.flock.filter((s) => s.fleece >= 7).length;
    const heavy = g.flock.some((s) => s.fleece >= 10);
    if (prime >= g.flock.length / 2 || heavy) act("shear");
    const price = rules.woolPrice(g);
    if (g.wool > 0 && (price >= BALANCE.marketBase || g.wool >= 40 || g.money < 15)) act("market");
    if (g.building) act("build");
    if (heavy && !rules.buffed(g, "tended")) act("tend");
    if (hayNeeded && season === "summer" && (g as GameState & { hay: number }).hay < hayNeeded(g)) act("hay" as ActionId);
    if (rules.here(g).grass < 55) act("muck");
    act("gather");
    if (g.pubs < BALANCE.pubsToAsk && g.money >= 60 + winterReserve && rules.owns(g, "roof")) act("pub");
    // whatever is left goes on the pipes: a free buff
    while (g.taps > 0 && act("music")) {
      /* */
    }
    if (g.day % 24 === 0 && g.day <= 96) flockAt.push(g.flock.length);
    if (g.day === 90) {
      moneyAt90 = g.money;
      flockAt90 = g.flock.length;
    }
    game.sleep();
    for (const m of CROFT) if (rules.owns(g, m.id) && !built[m.id]) built[m.id] = g.day;
    if (g.over?.kind === "win") wonDay = g.day;
  }
  if (process.env.WHY && g.over?.kind === "lose") {
    console.log(`${difficulty} seed ${seed}: ${g.over.title} on day ${g.day} (${seasonOf?.(g.day).id ?? ""}) flock ${g.flock.length} £${g.money} hay ${(g as GameState & { hay?: number }).hay ?? "-"} owned ${Object.keys(g.owned).join(",")}`);
  }
  return {
    alive: !g.over || g.over.kind === "win",
    endDay: g.day,
    won: g.over?.kind === "win",
    wonDay,
    moneyAt90,
    flockAt90,
    foxLosses: g.stats.foxLosses,
    flockAt,
    retired: (g as GameState & { retiredDogs?: unknown[] }).retiredDogs?.length ?? 0,
    lambs: (g.stats as { lambsBorn?: number }).lambsBorn ?? 0,
    built,
    snowLosses: (g.stats as { snowLosses?: number }).snowLosses ?? 0,
    hungryDays: g.stats.daysHungry,
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

console.log(`${RUNS} runs a scale, up to day ${DAYS}${seasonOf ? ", with seasons" : ", no seasons"}\n`);
console.log("flock at day 24/48/72/96 (median of runs still going); dogs: runs that retired one / retired two; median day each croft piece was finished");
console.log("scale    alive90  busted  won   median win day  median £ d90  median flock d90  fox/run  snow/run  hungry/run");
for (const d of ["gentle", "steady", "hard"] as Difficulty[]) {
  const rs: Result[] = [];
  for (let i = 0; i < RUNS; i++) rs.push(play(1000 + i * 7919, d));
  const alive90 = rs.filter((x) => x.endDay > 90 || x.won).length;
  const busted = rs.filter((x) => !x.alive).length;
  const won = rs.filter((x) => x.won);
  const m90 = rs.map((x) => x.moneyAt90).filter((x): x is number => x !== null);
  const f90 = rs.map((x) => x.flockAt90).filter((x): x is number => x !== null);
  const avg = (k: keyof Result) => (rs.reduce((a, x) => a + (x[k] as number), 0) / rs.length).toFixed(2);
  console.log(
    [
      d.padEnd(8),
      `${alive90}/${RUNS}`.padStart(7),
      `${busted}`.padStart(7),
      `${won.length}`.padStart(5),
      `${median(won.map((x) => x.wonDay!))}`.padStart(15),
      `£${median(m90)}`.padStart(13),
      `${median(f90)}`.padStart(17),
      avg("foxLosses").padStart(8),
      avg("snowLosses").padStart(9),
      avg("hungryDays").padStart(11),
      "   " + [0, 1, 2, 3].map((i) => median(rs.map((x) => x.flockAt[i]).filter((x) => x !== undefined))).join("/"),
      `   ${rs.filter((x) => x.retired >= 1).length}/${rs.filter((x) => x.retired >= 2).length}`,
      `   lambs ${median(rs.map((x) => x.lambs))}`,
      "   " + CROFT.map((m) => `${m.id} ${median(rs.map((x) => x.built[m.id]).filter((x) => x !== undefined))}`).join(" "),
    ].join("  "),
  );
}
