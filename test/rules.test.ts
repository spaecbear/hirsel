import { describe, expect, it } from "vitest";
import {
  feedCost,
  flystrikeExposed,
  foxRisk,
  grade,
  grazing,
  isFullMoon,
  moonName,
  moonPhase,
  priceOn,
  readyToShear,
  tapsPerDay,
  wolfSummoned,
  wolfWarningDue,
} from "../src/sim/rules";
import { newGame } from "../src/sim/game";
import { BALANCE } from "../src/sim/config";
import type { GameState } from "../src/sim/types";

const g = (patch: Partial<GameState> = {}): GameState => Object.assign(newGame({ seed: 1 }), patch);

describe("fleece value curve", () => {
  it("grades the four bands from the spec", () => {
    expect(grade(0).label).toBe("bare");
    expect(grade(2)).toEqual({ v: 1, label: "short" });
    expect(grade(6)).toEqual({ v: 6, label: "prime" });
    expect(grade(10).label).toBe("heavy");
    expect(grade(10).v).toBeCloseTo(9 - 1.2);
    expect(grade(13).label).toBe("matted");
    expect(grade(13).v).toBeCloseTo(5.4 - 1.1);
  });

  it("peaks just under nine and never falls below one", () => {
    const peak = grade(8.99).v;
    expect(peak).toBeGreaterThan(grade(4).v);
    expect(peak).toBeGreaterThan(grade(11).v);
    expect(grade(40).v).toBe(1);
  });

  it("only counts sheep at four or more as ready", () => {
    const s = g({ flock: [f(3.9), f(4), f(12)] });
    expect(readyToShear(s.flock)).toBe(2);
  });
});

describe("moon", () => {
  it("runs an eight day cycle full on days 5, 13, 21", () => {
    expect(moonPhase(1)).toBe(0);
    expect(moonName(1)).toBe("New");
    for (const d of [5, 13, 21, 29]) expect(isFullMoon(d)).toBe(true);
    for (const d of [4, 6, 12, 20]) expect(isFullMoon(d)).toBe(false);
  });
});

describe("market", () => {
  it("stays inside roughly 30–95p and is stable within a day", () => {
    for (let d = 1; d < 400; d++) {
      const p = priceOn(d);
      expect(p).toBeGreaterThanOrEqual(30);
      expect(p).toBeLessThanOrEqual(95);
      expect(priceOn(d)).toBe(p);
    }
  });
});

describe("taps", () => {
  it("is three base, one each for boots and lantern, one for hale, capped at six", () => {
    expect(tapsPerDay(g())).toBe(3);
    expect(tapsPerDay(g({ owned: { boots: true } }))).toBe(4);
    expect(tapsPerDay(g({ owned: { boots: true, lamp: true } }))).toBe(5);
    expect(tapsPerDay(g({ owned: { boots: true, lamp: true }, buffs: { hale: 2 } }))).toBe(6);
    expect(tapsPerDay(g({ owned: { boots: true, lamp: true }, buffs: { hale: 2 } }))).toBeLessThanOrEqual(BALANCE.maxTaps);
  });
});

describe("feed", () => {
  it("costs a pound for every two sheep, rounded up", () => {
    expect(feedCost(g({ flock: [] }))).toBe(0);
    expect(feedCost(g({ flock: [f(1)] }))).toBe(1);
    expect(feedCost(g({ flock: [f(1), f(1), f(1)] }))).toBe(2);
  });
});

describe("grazing", () => {
  it("eats four per sheep and reports how well they fed", () => {
    const s = g({ flock: [f(1), f(1)] });
    s.pastures[0].grass = 100;
    const r = grazing(s);
    expect(r.eaten).toBe(8);
    expect(r.fed).toBe(1);
  });

  it("goes hungry when the grass runs short", () => {
    const s = g({ flock: Array.from({ length: 10 }, () => f(1)) });
    s.pastures[0].grass = 10;
    const r = grazing(s);
    expect(r.eaten).toBe(10);
    expect(r.fed).toBeLessThan(BALANCE.hungryBelow);
  });
});

describe("fox risk", () => {
  it("multiplies pasture, weather, gathering, dog and the settled buff", () => {
    const s = g({ at: 2, forecast: ["mist", "sun", "sun"] });
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7);
    s.gatheredToday = true;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35);
    s.owned.dog = true;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35 * 0.6);
    s.buffs["settled flock"] = 2;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35 * 0.6 * 0.85);
  });

  it("is a flat one percent with the pelt, whatever else is true", () => {
    const s = g({ at: 2, forecast: ["mist", "sun", "sun"], owned: { pelt: true } });
    expect(foxRisk(s)).toBe(0.01);
  });
});

describe("flystrike", () => {
  it("targets the heaviest fleece over eleven", () => {
    const s = g({ flock: [f(11.5), f(13), f(2)], forecast: ["sun", "sun", "sun"] });
    expect(flystrikeExposed(s)?.fleece).toBe(13);
  });

  it("is prevented by tending and by rain", () => {
    expect(flystrikeExposed(g({ flock: [f(13)], buffs: { tended: 1 }, forecast: ["sun", "sun", "sun"] }))).toBeNull();
    expect(flystrikeExposed(g({ flock: [f(13)], forecast: ["rain", "sun", "sun"] }))).toBeNull();
    expect(flystrikeExposed(g({ flock: [f(10.9)], forecast: ["sun", "sun", "sun"] }))).toBeNull();
  });
});

describe("the last wolf", () => {
  const summonable = () =>
    g({ at: 2, day: 5, actsToday: 5, owned: { boots: true, crook: true }, flock: [f(4)] });

  it("needs crook, boots, the corrie, a full moon and five actions", () => {
    expect(wolfSummoned(summonable())).toBe(true);
    expect(wolfSummoned({ ...summonable(), at: 1 })).toBe(false);
    expect(wolfSummoned({ ...summonable(), day: 4 })).toBe(false);
    expect(wolfSummoned({ ...summonable(), actsToday: 4 })).toBe(false);
    expect(wolfSummoned({ ...summonable(), owned: { boots: true } })).toBe(false);
    expect(wolfSummoned({ ...summonable(), flock: [] })).toBe(false);
  });

  it("does not need the sword to be summoned", () => {
    const s = summonable();
    expect(wolfSummoned(s)).toBe(true);
    s.owned.sword = true;
    expect(wolfSummoned(s)).toBe(true);
  });

  it("never comes again once the pelt is taken", () => {
    expect(wolfSummoned({ ...summonable(), owned: { boots: true, crook: true, pelt: true } })).toBe(false);
  });

  it("warns on the fourth action, with a tap still in hand", () => {
    expect(wolfWarningDue({ ...summonable(), actsToday: 4 })).toBe(true);
    expect(wolfWarningDue({ ...summonable(), actsToday: 3 })).toBe(false);
    expect(wolfWarningDue({ ...summonable(), actsToday: 4, at: 0 })).toBe(false);
  });
});

let id = 100;
function f(fleece: number) {
  return { id: id++, fleece, breed: "blackface" as const, age: 0 };
}
