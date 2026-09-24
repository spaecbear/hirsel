import { describe, expect, it } from "vitest";
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, BREEDS, SEASON_DAYS, SEASON_ORDER } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import { workGlossary } from "../src/sim/glossary";
import { INVERSE } from "../src/sim/lexicon";
import { lambPrice, lambingOn } from "../src/sim/rules";
import type { GameState, Sheep, WeatherId } from "../src/sim/types";

let nextId = 1000;
const ewe = (patch: Partial<Sheep> = {}): Sheep => ({ id: nextId++, fleece: 3, breed: "blackface", age: 50, ...patch });
const dayOf = (id: string, inSeason = 1) => SEASON_ORDER.indexOf(id as never) * SEASON_DAYS + inSeason;

function harness(patch: Partial<GameState> = {}) {
  const game = new Game(Object.assign(newGame({ seed: 3 }), { money: 1000, hay: 500 }, patch));
  game.onAnim = (_a, after) => after?.();
  // no fox, no wolf: this is about the lambs
  game.state.owned.pelt = true;
  return { game, g: game.state };
}

/** every roll lands on `v`, so a test can say what the night does */
const rolls = (game: Game, v: number) => (game.rng = () => v);

describe("the tup", () => {
  it("is sold at the cart from the start", () => {
    const { game, g } = harness();
    game.buyTool("tup");
    expect(g.owned.tup).toBe(true);
  });

  it("puts the grown ewes in lamb as winter comes in, and not this year's lambs", () => {
    const { game, g } = harness({
      day: dayOf("winter") - 1,
      flock: [ewe(), ewe(), ewe({ lamb: true, age: 20 })],
      owned: { tup: true },
    });
    // under the tup rate, so both take; over the 1% the pelt leaves the fox
    rolls(game, 0.5);
    game.sleep();
    expect(g.flock.filter((s) => s.inLamb)).toHaveLength(2);
    expect(g.flock.find((s) => s.lamb)!.inLamb).toBeFalsy();
    expect(g.log.some((l) => l.t.includes("2 ewes in lamb"))).toBe(true);
  });

  it("does nothing without a tup", () => {
    const { game, g } = harness({ day: dayOf("winter") - 1, flock: [ewe(), ewe()] });
    rolls(game, 0);
    game.sleep();
    expect(g.flock.some((s) => s.inLamb)).toBe(false);
  });
});

describe("a winter carrying", () => {
  it("can cost a ewe her lamb on a hungry night", () => {
    const { game, g } = harness({
      day: dayOf("winter", 5),
      flock: [ewe({ inLamb: true }), ewe({ inLamb: true })],
      hay: 0,
      forecast: ["snow", "sun", "sun"] as WeatherId[],
    });
    const seq = [0.99, 0]; // the first ewe keeps hers, the second slips; nothing else lands
    game.rng = () => seq.shift() ?? 0.99;
    game.sleep();
    expect(g.flock.filter((s) => s.inLamb)).toHaveLength(1);
    expect(g.stats.lambsLost).toBe(1);
  });

  it("costs nothing when the barn has fed them", () => {
    const { game, g } = harness({
      day: dayOf("winter", 5),
      flock: [ewe({ inLamb: true }), ewe({ inLamb: true })],
      hay: 100,
      forecast: ["snow", "sun", "sun"] as WeatherId[],
    });
    rolls(game, 0.5);
    game.sleep();
    expect(g.flock.filter((s) => s.inLamb)).toHaveLength(2);
  });
});

describe("the lambing", () => {
  it("is on for the first days of spring", () => {
    expect(lambingOn(harness({ day: dayOf("spring", 1) }).g)).toBe(true);
    expect(lambingOn(harness({ day: dayOf("spring", BALANCE.lambingDays) }).g)).toBe(true);
    expect(lambingOn(harness({ day: dayOf("spring", BALANCE.lambingDays + 1) }).g)).toBe(false);
    expect(lambingOn(harness({ day: dayOf("summer", 1) }).g)).toBe(false);
  });

  it("brings every ewe to lamb by the last night of it", () => {
    const { game, g } = harness({
      day: dayOf("spring", 1) + SEASON_DAYS * 4,
      flock: [ewe({ inLamb: true }), ewe({ inLamb: true }), ewe({ inLamb: true })],
      owned: { byre: true, pelt: true },
    });
    // a roll of one half: each ewe waits for the last nights, no twins, and nothing else lands
    rolls(game, 0.5);
    for (let i = 0; i < BALANCE.lambingDays; i++) game.sleep();
    expect(g.flock.some((s) => s.inLamb)).toBe(false);
    expect(g.stats.lambsBorn).toBeGreaterThanOrEqual(3);
    expect(g.flock.filter((s) => s.lamb).length).toBe(g.stats.lambsBorn);
  });

  it("gives the lamb its mother's breed, and sometimes twins", () => {
    const { game, g } = harness({
      day: dayOf("spring", BALANCE.lambingDays) + SEASON_DAYS * 4, // the last night: she lambs for certain
      flock: [ewe({ inLamb: true, breed: "shetland" })],
      owned: { byre: true, pelt: true },
    });
    rolls(game, 0); // and every roll that can land, lands: twins
    game.sleep();
    const lambs = g.flock.filter((s) => s.lamb);
    expect(lambs).toHaveLength(2);
    expect(lambs.every((l) => l.breed === "shetland" && l.fleece === 0)).toBe(true);
    expect(g.achievements).toContain("first-lamb");
  });

  it("loses no lamb born in the byre, whatever the night", () => {
    const { game, g } = harness({
      day: dayOf("spring", BALANCE.lambingDays) + SEASON_DAYS * 4,
      flock: [ewe({ inLamb: true }), ewe({ inLamb: true })],
      owned: { byre: true, pelt: true },
      forecast: ["rain", "rain", "rain"] as WeatherId[],
    });
    rolls(game, 0);
    game.sleep();
    expect(g.stats.lambsLost).toBe(0);
    expect(g.log.some((l) => l.t.includes("born in the byre"))).toBe(true);
  });

  it("can lose lambs born out on a wet night, and fewer when they are tended", () => {
    const night = (tended: boolean, roll: number) => {
      const { game, g } = harness({
        day: dayOf("spring", BALANCE.lambingDays) + SEASON_DAYS * 4,
        flock: [ewe({ inLamb: true })],
        forecast: ["rain", "rain", "rain"] as WeatherId[],
        buffs: tended ? { tended: 3 } : {},
      });
      // she lambs (the last night takes her), a single, and then the loss roll
      const seq = [0, 0.99, roll];
      game.rng = () => seq.shift() ?? 0.99;
      game.sleep();
      return g.stats.lambsLost;
    };
    const between = BALANCE.lambLossBadNight * BALANCE.lambLossTended + 0.01;
    expect(night(false, between)).toBe(1); // untended, this roll loses her
    expect(night(true, between)).toBe(0); // tended, the same roll does not
  });

  it("loses nothing out on the hill on a fair night", () => {
    const { game, g } = harness({
      day: dayOf("spring", BALANCE.lambingDays) + SEASON_DAYS * 4,
      flock: [ewe({ inLamb: true })],
      forecast: ["sun", "sun", "sun"] as WeatherId[],
    });
    rolls(game, 0);
    game.sleep();
    expect(g.stats.lambsLost).toBe(0);
  });

  it("points the tend button at the lambing when there is no byre", () => {
    const g = harness({ day: dayOf("spring", 2), flock: [ewe({ inLamb: true })] }).g;
    const tend = ACTIONS.find((a) => a.id === "tend")!;
    expect(tend.desc(g, new Game().lex)).toContain("lambing");
  });
});

describe("lambs", () => {
  it("grow half a fleece, and are grown and counted as ewes after a while", () => {
    const { game, g } = harness({
      day: dayOf("summer", 5),
      flock: [ewe({ fleece: 0 }), ewe({ lamb: true, fleece: 0, age: BALANCE.lambGrowDays - 1 })],
      forecast: ["overcast", "sun", "sun"] as WeatherId[],
    });
    g.pastures.forEach((p) => (p.grass = 100));
    game.sleep();
    const [mum, lamb] = g.flock;
    expect(lamb.fleece).toBeCloseTo(mum.fleece * BALANCE.lambGrowth);
    expect(lamb.lamb).toBe(false);
    expect(g.log.some((l) => l.t.includes("grown now"))).toBe(true);
  });

  it("sell for half a ewe, and half as much again at the autumn sales", () => {
    const lamb = ewe({ lamb: true });
    const cost = BREEDS.blackface.cost;
    expect(lambPrice(harness({ day: dayOf("spring", 20) }).g, lamb)).toBe(Math.round(cost * BALANCE.lambPrice));
    expect(lambPrice(harness({ day: dayOf("autumn", 3) }).g, lamb)).toBe(
      Math.round(cost * BALANCE.lambPrice * BALANCE.lambPriceAutumn),
    );
  });

  it("are sold at the cart as lambs, at the lamb price", () => {
    const lamb = ewe({ lamb: true });
    const { game, g } = harness({ day: dayOf("autumn", 3), flock: [ewe(), lamb], money: 0 });
    game.sellEwe(lamb.id);
    expect(g.money).toBe(lambPrice(g, lamb));
    expect(g.stats.lambsSold).toBe(1);
    expect(g.stats.sheepSold).toBe(0);
    expect(g.log[0].t).toContain("lamb");
  });
});

describe("the words for it", () => {
  it("turn over in TOD: a dog fox, cubs, in cub", () => {
    expect([INVERSE.tup, INVERSE.lamb, INVERSE.lambs, INVERSE.inLamb]).toEqual(["dog fox", "cub", "cubs", "in cub"]);
    expect(INVERSE.toolNames.tup).toBe("A dog fox");
    expect(INVERSE.toolWhat.tup).not.toMatch(/ram|ewe|lamb/i);
  });

  it("are in the glossary and the achievements", () => {
    expect(workGlossary().some((e) => e.id === "lambing")).toBe(true);
    expect(ACHIEVEMENTS.find((a) => a.id === "first-lamb")!.secret).toBeFalsy();
  });
});
