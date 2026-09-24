import { describe, expect, it } from "vitest";
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, SEASON_DAYS, SEASON_ORDER, SEASONS, WEATHER, WEATHER_BAG } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import { hydrate } from "../src/sim/save";
import { seasonGlossary } from "../src/sim/glossary";
import {
  foxRisk,
  grazing,
  hayNeeded,
  hayNights,
  hayPerNight,
  isFullMoon,
  priceOn,
  seasonOf,
  woolPrice,
} from "../src/sim/rules";
import { DIFFICULTY } from "../src/sim/config";
import type { GameState, Sheep, WeatherId } from "../src/sim/types";

const sheep = (fleece = 4): Sheep => ({ id: Math.random(), fleece, breed: "blackface", age: 0 });
const flockOf = (n: number) => Array.from({ length: n }, () => sheep());

/** the first day of a season in the first year */
const dayOf = (id: string, inSeason = 1) => SEASON_ORDER.indexOf(id as never) * SEASON_DAYS + inSeason;

function harness(patch: Partial<GameState> = {}) {
  const game = new Game(Object.assign(newGame({ seed: 11 }), patch));
  game.onAnim = (_a, after) => after?.();
  return { game, g: game.state };
}

describe("the year", () => {
  it("turns every twenty-four days, spring first, and comes round again", () => {
    expect(seasonOf(1)).toMatchObject({ id: "spring", day: 1, left: 23, year: 1 });
    expect(seasonOf(24)).toMatchObject({ id: "spring", day: 24, left: 0 });
    expect(seasonOf(25)).toMatchObject({ id: "summer", day: 1 });
    expect(seasonOf(49).id).toBe("autumn");
    expect(seasonOf(73).id).toBe("winter");
    expect(seasonOf(96)).toMatchObject({ id: "winter", left: 0, year: 1 });
    expect(seasonOf(97)).toMatchObject({ id: "spring", day: 1, year: 2 });
  });

  it("gives every season the same three full moons, so the wolf's calendar is unchanged", () => {
    for (let start = 1; start <= SEASON_DAYS * 8; start += SEASON_DAYS) {
      let moons = 0;
      for (let d = start; d < start + SEASON_DAYS; d++) if (isFullMoon(d)) moons++;
      expect(moons, `season starting day ${start}`).toBe(3);
    }
  });

  it("leaves spring as the game always was, so the opening is untouched", () => {
    const s = SEASONS.spring;
    expect([s.growth, s.price, s.foxBias]).toEqual([1, 1, 1]);
    expect(s.weather).toEqual(WEATHER_BAG);
  });

  it("only ever snows in winter, and every season's weather is real weather", () => {
    for (const id of SEASON_ORDER) {
      for (const w of SEASONS[id].weather) expect(WEATHER[w], `${id}: ${w}`).toBeDefined();
      expect(SEASONS[id].weather.includes("snow")).toBe(id === "winter");
    }
  });

  it("draws each new forecast day from the season that day falls in", () => {
    const { game, g } = harness({ flock: flockOf(6), money: 10_000 });
    const seen: [number, WeatherId][] = [];
    for (let i = 0; i < SEASON_DAYS * 4 + 5; i++) {
      game.sleep();
      g.forecast.forEach((w, k) => seen.push([g.day + k, w]));
      g.flock = flockOf(6); // keep the run alive; this is about the sky
      g.over = null;
    }
    const snowy = seen.filter(([, w]) => w === "snow").map(([d]) => d);
    expect(snowy.length).toBeGreaterThan(0);
    for (const d of snowy) expect(seasonOf(d).id, `snow on day ${d}`).toBe("winter");
  });

  it("says so at dawn when a season comes in", () => {
    const { game, g } = harness({ day: dayOf("summer") - 1, flock: flockOf(6), money: 500 });
    game.sleep();
    expect(g.day).toBe(dayOf("summer"));
    expect(g.log.some((l) => l.t === SEASONS.summer.arrives)).toBe(true);
  });

  it("warns in autumn, with the barn's count, before the winter comes", () => {
    const warnDay = dayOf("winter") - BALANCE.winterWarnDays - 1;
    const { game, g } = harness({ day: warnDay - 1, flock: flockOf(6), money: 500, hay: 30 });
    game.sleep();
    expect(g.day).toBe(warnDay);
    const line = g.log.find((l) => l.t.startsWith("The nights are drawing in"));
    expect(line?.t).toContain("30 bales");
  });
});

describe("what each season does", () => {
  it("pays best for wool in the autumn, and least in the summer glut", () => {
    const autumn = harness({ day: dayOf("autumn", 5) }).g;
    const mult = DIFFICULTY[autumn.difficulty].price;
    expect(woolPrice(autumn)).toBe(priceOn(autumn.day, mult * SEASONS.autumn.price));
    expect(SEASONS.autumn.price).toBeGreaterThan(1);
    expect(SEASONS.summer.price).toBeLessThan(1);
  });

  it("makes the fox bolder in winter", () => {
    const base = { flock: flockOf(12), forecast: ["overcast", "sun", "sun"] as WeatherId[] };
    const spring = harness({ ...base, day: dayOf("spring", 3) }).g;
    const winter = harness({ ...base, day: dayOf("winter", 3) }).g;
    expect(foxRisk(winter) / foxRisk(spring)).toBeCloseTo(SEASONS.winter.foxBias);
  });

  it("grows no grass in winter", () => {
    const { game, g } = harness({ day: dayOf("winter", 2), flock: [], forecast: ["rain", "rain", "rain"], money: 50 });
    g.flock = flockOf(1);
    g.at = 1;
    const other = g.pastures[0].grass = 40;
    game.sleep();
    expect(g.pastures[0].grass).toBe(other);
  });

  it("has no flystrike in winter, however heavy the fleece", () => {
    const { game, g } = harness({ day: dayOf("winter", 2), flock: [sheep(14), sheep(14)], forecast: ["sun", "sun", "sun"] });
    game.rng = () => 0; // every roll that can land, lands
    g.pastures.forEach((p) => (p.grass = 100));
    game.sleep();
    expect(g.stats.strikeLosses).toBe(0);
  });

  it("will not let frozen ground be mucked", () => {
    const { g } = harness({ day: dayOf("winter", 2) });
    g.pastures[g.at].grass = 10;
    const muck = ACTIONS.find((a) => a.id === "muck")!;
    expect(muck.can(g)).toBe(false);
    expect(muck.desc(g, (new Game()).lex)).toContain("frozen");
  });

  it("describes itself in the glossary from the same numbers", () => {
    const entries = seasonGlossary();
    expect(entries.map((e) => e.id)).toEqual(SEASON_ORDER);
    expect(entries.find((e) => e.id === "winter")!.effect).toContain("grass regrowth none");
    expect(entries.find((e) => e.id === "spring")!.meta).toContain("days 1–24");
  });
});

describe("hay", () => {
  it("is cut in summer on a dry day, and not otherwise", () => {
    const hay = ACTIONS.find((a) => a.id === "hay")!;
    const summerSun = harness({ day: dayOf("summer", 3), forecast: ["sun", "sun", "sun"] }).g;
    const summerRain = harness({ day: dayOf("summer", 3), forecast: ["rain", "sun", "sun"] }).g;
    const spring = harness({ day: dayOf("spring", 3), forecast: ["sun", "sun", "sun"] }).g;
    expect(hay.can(summerSun)).toBe(true);
    expect(hay.can(summerRain)).toBe(false);
    expect(hay.can(spring)).toBe(false);
  });

  it("puts bales in the barn for a tap, and cutting it in the sun is remembered", () => {
    const { game, g } = harness({ day: dayOf("summer", 3), forecast: ["sun", "sun", "sun"] });
    const taps = g.taps;
    game.doAction("hay");
    expect(g.hay).toBe(BALANCE.hayCutBales);
    expect(g.taps).toBe(taps - 1);
    expect(g.stats.hayInSun).toBe(true);
    expect(g.achievements).toContain("made-hay");
  });

  it("is bought at the cart for money, dearer in winter", () => {
    const { game, g } = harness({ day: dayOf("autumn", 3), money: 20 });
    game.buyHay();
    expect(g.hay).toBe(BALANCE.hayLot);
    expect(g.money).toBe(20 - BALANCE.hayLotCost);
    g.day = dayOf("winter", 3);
    game.buyHay();
    expect(g.money).toBe(20 - BALANCE.hayLotCost - BALANCE.hayLotCostWinter);
    g.money = 1;
    game.buyHay();
    expect(g.hay).toBe(BALANCE.hayLot * 2);
  });

  it("is not sold in spring — and so cannot spend the first day's ewe money", () => {
    const { game, g } = harness({ day: 1, money: 30 });
    game.buyHay();
    expect(g.hay).toBe(0);
    expect(g.money).toBe(30);
  });

  it("is only fed out in winter, and only what the ground falls short of", () => {
    const summer = harness({ day: dayOf("summer", 3), flock: flockOf(10), hay: 50, forecast: ["sun", "sun", "sun"] }).g;
    summer.pastures[summer.at].grass = 0;
    expect(grazing(summer).hayUsed).toBe(0);

    const winter = harness({ day: dayOf("winter", 3), flock: flockOf(10), hay: 50, forecast: ["sun", "sun", "sun"] }).g;
    winter.pastures[winter.at].grass = 20; // 20 of the 40 they want
    const r = grazing(winter);
    expect(r.eaten).toBe(20);
    expect(r.hayUsed).toBe(2);
    expect(r.fed).toBe(1);

    winter.pastures[winter.at].grass = 100;
    expect(grazing(winter).hayUsed).toBe(0);
  });

  it("is all they have on a day of snow", () => {
    const { g } = harness({ day: dayOf("winter", 3), flock: flockOf(10), hay: 3, forecast: ["snow", "sun", "sun"] });
    g.pastures[g.at].grass = 100;
    const r = grazing(g);
    expect(r.eaten).toBe(0);
    expect(r.hayUsed).toBe(3);
    expect(r.fed).toBeCloseTo(30 / 40);
  });

  it("comes out of the barn at night, and says when the last of it goes", () => {
    const { game, g } = harness({ day: dayOf("winter", 3), flock: flockOf(10), hay: 4, forecast: ["snow", "sun", "sun"], money: 100 });
    game.sleep();
    expect(g.hay).toBe(0);
    expect(g.log.some((l) => l.t.includes("last of the hay"))).toBe(true);
  });

  it("knows how many nights the barn will keep them, and what a winter wants", () => {
    const g = harness({ flock: flockOf(10), hay: 40 }).g;
    expect(hayPerNight(g)).toBe(4);
    expect(hayNights(g)).toBe(10);
    expect(hayNeeded(g)).toBe(Math.ceil(4 * SEASON_DAYS * 0.75));
    g.day = dayOf("winter", 21); // four nights left, counting tonight
    expect(hayNeeded(g)).toBe(Math.ceil(4 * 4 * 0.75));
  });

  it("is back-filled as an empty barn on a save from before it existed", () => {
    const old = newGame() as Partial<GameState>;
    delete old.hay;
    expect(hydrate(old as GameState).hay).toBe(0);
  });
});

describe("snow", () => {
  it("can take a beast on a hungry night out in it", () => {
    const { game, g } = harness({ day: dayOf("winter", 3), flock: flockOf(5), hay: 0, forecast: ["snow", "sun", "sun"], money: 100 });
    // the snow's roll and which beast it takes land; everything after misses
    const rolls = [0, 0];
    game.rng = () => rolls.shift() ?? 0.99;
    game.sleep();
    expect(g.stats.snowLosses).toBe(1);
    expect(g.flock).toHaveLength(4);
  });

  it("takes nothing from a flock that was fed", () => {
    const { game, g } = harness({ day: dayOf("winter", 3), flock: flockOf(5), hay: 100, forecast: ["snow", "sun", "sun"], money: 100 });
    game.rng = () => 0;
    g.owned.pelt = true;
    game.sleep();
    expect(g.stats.snowLosses).toBe(0);
  });

  it("cannot touch them in the byre — nor can a fox", () => {
    const { game, g } = harness({
      day: dayOf("winter", 3),
      flock: flockOf(5),
      hay: 0,
      forecast: ["snow", "sun", "sun"],
      money: 100,
      owned: { byre: true },
    });
    expect(foxRisk(g)).toBe(0);
    game.rng = () => 0;
    game.sleep();
    expect(g.stats.snowLosses).toBe(0);
    expect(g.stats.foxLosses).toBe(0);
    expect(g.flock).toHaveLength(5);
    expect(g.log.some((l) => l.t.includes("into the byre"))).toBe(true);
  });
});

describe("the achievements for it", () => {
  it("are in the list and not secret", () => {
    for (const id of ["made-hay", "first-winter"]) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      expect(a, id).toBeDefined();
      expect(a!.secret).toBeFalsy();
    }
  });

  it("marks the first spring after a winter, with the flock still there", () => {
    const a = ACHIEVEMENTS.find((x) => x.id === "first-winter")!;
    expect(a.won(harness({ day: SEASON_DAYS * 4 }).g)).toBe(false);
    expect(a.won(harness({ day: SEASON_DAYS * 4 + 1 }).g)).toBe(true);
    expect(a.won(harness({ day: SEASON_DAYS * 4 + 1, flock: [] }).g)).toBe(false);
  });
});
