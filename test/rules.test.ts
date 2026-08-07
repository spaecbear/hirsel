import { describe, expect, it } from "vitest";
import {
  canShear,
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
  woolPrice,
} from "../src/sim/rules";
import { ACTIONS, newGame } from "../src/sim/game";
import { BALANCE, TOOLS } from "../src/sim/config";
import type { GameState } from "../src/sim/types";
import { INVERSE, actionName, toolWhat } from "../src/sim/lexicon";

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
  it("stays inside base ± swing and is stable within a day", () => {
    for (let d = 1; d < 400; d++) {
      const p = priceOn(d);
      expect(p).toBeGreaterThanOrEqual(BALANCE.marketBase - BALANCE.marketSwing);
      expect(p).toBeLessThanOrEqual(BALANCE.marketBase + BALANCE.marketSwing);
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
  it("costs a pound for every three sheep, rounded up", () => {
    expect(feedCost(g({ flock: [] }))).toBe(0);
    expect(feedCost(g({ flock: [f(1)] }))).toBe(1);
    expect(feedCost(g({ flock: [f(1), f(1), f(1)] }))).toBe(1);
    expect(feedCost(g({ flock: [f(1), f(1), f(1), f(1)] }))).toBe(2);
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

describe("the salt lick", () => {
  it("takes a quarter less grass for the same work", () => {
    const plain = g({ flock: [f(1), f(1), f(1), f(1)] });
    const licked = g({ flock: [f(1), f(1), f(1), f(1)], owned: { saltlick: true } });
    expect(grazing(plain).eaten).toBe(16);
    expect(grazing(licked).eaten).toBe(12);
    // and they are no worse fed for it
    expect(grazing(licked).fed).toBe(1);
    expect(grazing(licked).growth).toBeCloseTo(grazing(plain).growth);
  });

  it("keeps them fed on ground that would otherwise be thin", () => {
    const thin = { flock: Array.from({ length: 5 }, () => f(1)) };
    // five sheep want 20 without the lick and 15 with it, so ten on the
    // ground is hunger one way and enough the other
    const plain = g(thin);
    plain.pastures[0].grass = 10;
    const licked = g({ ...thin, owned: { saltlick: true } });
    licked.pastures[0].grass = 10;
    expect(grazing(plain).fed).toBeLessThan(BALANCE.hungryBelow);
    expect(grazing(licked).fed).toBeGreaterThan(BALANCE.hungryBelow);
  });
});

describe("the oilskin", () => {
  it("gets you through a haar, but rain is still rain", () => {
    const haar = (kit = {}) => g({ forecast: ["mist", "sun", "sun"], owned: kit });
    const wet = (kit = {}) => g({ forecast: ["rain", "sun", "sun"], owned: kit });
    expect(canShear(haar())).toBe(false);
    expect(canShear(haar({ oilskin: true }))).toBe(true);
    expect(canShear(wet({ oilskin: true }))).toBe(false);
  });

  it("changes nothing on a day you could already shear", () => {
    for (const wx of ["sun", "overcast"] as const) {
      expect(canShear(g({ forecast: [wx, "sun", "sun"] }))).toBe(true);
      expect(canShear(g({ forecast: [wx, "sun", "sun"], owned: { oilskin: true } }))).toBe(true);
    }
  });
});

describe("fox risk", () => {
  it("multiplies pasture, weather, flock size, gathering, dog and the settled buff", () => {
    // twelve is the pivot, so a flock of twelve carries no size factor at all
    // hard carries no scale factor of its own, so the arithmetic here is the
    // raw rule rather than the rule times a difficulty dial
    const s = g({ difficulty: "hard", at: 2, forecast: ["mist", "sun", "sun"], flock: Array.from({ length: 12 }, () => f(4)) });
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7);
    s.gatheredToday = true;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35);
    s.owned.dog = true;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35 * 0.6);
    s.buffs["settled flock"] = 2;
    expect(foxRisk(s)).toBeCloseTo(0.34 * 1.7 * 0.35 * 0.6 * 0.85);
  });

  it("scales with how many there are to watch, between a floor and a ceiling", () => {
    const at = (n: number) =>
      foxRisk(g({ difficulty: "hard", at: 2, forecast: ["mist", "sun", "sun"], flock: Array.from({ length: n }, () => f(4)) }));
    const base = 0.34 * 1.7;
    expect(at(6)).toBeCloseTo(base * 0.5); // half the pivot, half the risk
    expect(at(12)).toBeCloseTo(base);
    expect(at(18)).toBeCloseTo(base * 1.5); // the ceiling, past which it stops
    expect(at(30)).toBeCloseTo(base * 1.5);
    expect(at(2)).toBeCloseTo(base * 0.45); // the floor: a tiny flock is not free
  });

  it("is dialled by the scale the run is played at, and nothing else is", () => {
    const on = (d: "gentle" | "steady" | "hard") =>
      foxRisk(g({ difficulty: d, at: 2, forecast: ["mist", "sun", "sun"], flock: Array.from({ length: 12 }, () => f(4)) }));
    expect(on("hard")).toBeCloseTo(0.34 * 1.7);
    expect(on("steady")).toBeCloseTo(0.34 * 1.7 * 0.8);
    expect(on("gentle")).toBeCloseTo(0.34 * 1.7 * 0.6);
    // the mechanics are identical at every scale: only the two dials move
    expect(on("gentle")).toBeLessThan(on("steady"));
    expect(on("steady")).toBeLessThan(on("hard"));
  });

  it("prices wool by the scale too, so the dial has two ends", () => {
    const day = 5;
    const at = (d: "gentle" | "steady" | "hard") => woolPrice(g({ difficulty: d, day }));
    expect(at("hard")).toBe(priceOn(day));
    expect(at("gentle")).toBeGreaterThan(at("steady"));
    expect(at("steady")).toBeGreaterThan(at("hard"));
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

describe("inverse mode says nothing about sheep", () => {
  /*
   * Player report: in TOD the skulk still offered to "tend the flock", the
   * gather still cut "fox risk", the shears still talked about fleece and the
   * pipes still kept foxes away. Those were hard-coded strings that the
   * lexicon never got a look at.
   *
   * This walks every action description and every tool blurb in inverse mode
   * and fails on any sheep-side word, so the next one that gets hard-coded
   * shows up here rather than in a screenshot.
   */
  // only the sheep-side words: in TOD the beasts really are foxes and the
  // vixens really are vixens, so those are the correct nouns there
  const SHEEP_WORDS = /\b(sheep|ewes?|lambs?|flocks?|fleeces?|wool|shear\w*)\b/i;

  it("keeps sheep words out of every action description", () => {
    const state = newGame({ seed: 3 });
    state.flock.forEach((s) => (s.fleece = 12)); // trip the heavy-fleece branches
    for (const owned of [{}, { fiddle: true }, { dog: true }, { crook: true }]) {
      const g2 = { ...state, owned } as GameState;
      for (const a of ACTIONS) {
        const name = actionName(INVERSE, a.id, !!owned.fiddle) || a.name;
        expect(name, `action name ${a.id}`).not.toMatch(SHEEP_WORDS);
        expect(a.desc(g2, INVERSE), `desc of ${a.id}`).not.toMatch(SHEEP_WORDS);
      }
    }
  });

  it("keeps sheep words out of the tool blurbs", () => {
    for (const t of TOOLS) {
      expect(toolWhat(INVERSE, t.id, t.what), `tool ${t.id}`).not.toMatch(SHEEP_WORDS);
    }
  });
});
