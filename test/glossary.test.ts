import { beforeEach, describe, expect, it } from "vitest";
import { buffGlossary, statusGlossary } from "../src/sim/glossary";
import { saveEarned, clearEarned } from "../src/sim/achievements";
import { BALANCE } from "../src/sim/config";
import { CHEATS, REVEAL_ORDER, revealNextCheat } from "../src/sim/cheats";

/**
 * These pin the glossary's wording to the live BALANCE numbers, not to a
 * second hardcoded copy of them — the whole point of building the appendix
 * from config.ts is that a tuning pass (see the market price fix) can't
 * silently leave it describing a game that no longer exists. If a percentage
 * or day count in config.ts moves, these fail until the glossary catches up.
 */
describe("the buff glossary", () => {
  it("lists all four buffs with their live duration and effect", () => {
    const entries = buffGlossary();
    expect(entries.map((e) => e.id).sort()).toEqual(["hale", "settled flock", "steady hands", "tended"]);

    const tended = entries.find((e) => e.id === "tended")!;
    expect(tended.meta).toContain(`${BALANCE.tendDays} days`);
    expect(tended.effect).toContain("flystrike");

    const steady = entries.find((e) => e.id === "steady hands")!;
    expect(steady.meta).toContain(`${BALANCE.cozyBuffDays} days`);
    expect(steady.effect).toContain(`${Math.round((BALANCE.steadyHandsBonus - 1) * 100)}%`);

    const settled = entries.find((e) => e.id === "settled flock")!;
    expect(settled.effect).toContain(`${Math.round((BALANCE.settledGrowth - 1) * 100)}%`);
    expect(settled.effect).toContain(String(BALANCE.settledFoxBias));

    const hale = entries.find((e) => e.id === "hale")!;
    expect(hale.meta).toContain(`${BALANCE.haleDays} days`);
    expect(hale.meta).toContain(`£${BALANCE.pintCost}`);
    expect(hale.effect).toContain(String(BALANCE.maxTaps));
  });

  it("none of the four buffs are masked — they're ordinary mechanics, not the wolf", () => {
    for (const e of buffGlossary()) expect(e.secret).toBeFalsy();
  });
});

describe("the status glossary", () => {
  beforeEach(() => clearEarned());

  it("explains gathering without ever being masked", () => {
    const gathered = statusGlossary().find((e) => e.id === "gathered")!;
    expect(gathered.name).toBe("Gathered");
    expect(gathered.effect).toContain(String(BALANCE.gatheredFoxBias));
    expect(gathered.secret).toBeFalsy();
  });

  it("keeps the pelt masked until the achievement has been earned", () => {
    const pelt = statusGlossary().find((e) => e.id === "pelt")!;
    expect(pelt.name).toBe("?????");
    expect(pelt.meta).toBe("?????");
    expect(pelt.effect).not.toContain("wolf");
    expect(pelt.secret).toBe(true);
  });

  it("reveals the pelt's real effect once it has been earned, in any run", () => {
    saveEarned(["pelt"]);
    const pelt = statusGlossary().find((e) => e.id === "pelt")!;
    expect(pelt.name).not.toBe("?????");
    expect(pelt.effect).toContain(`${Math.round(BALANCE.peltFoxRisk * 100)}%`);
  });

  it("never states the summon recipe, even once the pelt is known", () => {
    // "gathered ... free with the crook" is fine — the crook's ordinary
    // effect is already public from day one. What must never appear is the
    // conditions strung together as a trigger: which tools, which ground,
    // which moon, how many actions. The revealed pelt text names the ground
    // and the moon alone, matching the existing owned-pelt shop tile
    // ("Taken on the High Corrie under a full moon") — a place and a time,
    // not instructions.
    saveEarned(["pelt"]);
    const text = statusGlossary()
      .find((e) => e.id === "pelt")!
      .effect.toLowerCase();
    expect(text).not.toContain("crook");
    expect(text).not.toContain("boots");
    expect(text).not.toContain("five action");
    expect(text).not.toContain("sword");
    expect(text).not.toContain("summon");
  });
});


describe("the reward for finishing a run", () => {
  const codes = CHEATS.map((c) => c.code);

  it("hands over a code the player does not have yet", () => {
    const prize = revealNextCheat([]);
    expect(prize).not.toBeNull();
    expect(codes).toContain(prize!.code);
  });

  it("never hands over one they already found", () => {
    let found: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      const prize = revealNextCheat(found);
      expect(prize, `run ${i + 1} should still have something to give`).not.toBeNull();
      expect(found).not.toContain(prize!.code);
      found = [...found, prize!.code];
    }
    // everything handed out, and nothing left to give
    expect(new Set(found)).toEqual(new Set(codes));
    expect(revealNextCheat(found)).toBeNull();
  });

  it("hands them over weakest first, with the game-breaking ones last", () => {
    const order: string[] = [];
    let found: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      const prize = revealNextCheat(found)!;
      order.push(prize.code);
      found = [...found, prize.code];
    }
    expect(order).toEqual(REVEAL_ORDER);
    // the three that undo the game come last
    expect(order.slice(-3)).toEqual(["TOD", "SILLER", "ZEN"]);
    // and quality of life comes early
    expect(order.indexOf("SKELP")).toBeLessThan(order.indexOf("HIRSEL"));
  });

  it("lists every code in the reveal order, so none is unreachable", () => {
    expect([...REVEAL_ORDER].sort()).toEqual([...codes].sort());
  });

  it("does not give the wolf away on an early win", () => {
    // it is the one code whose description explains him
    const order: string[] = [];
    let found: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      const prize = revealNextCheat(found)!;
      order.push(prize.code);
      found = [...found, prize.code];
    }
    // by the time 1680 arrives the player has finished five runs
    expect(REVEAL_ORDER.indexOf("1680")).toBeGreaterThanOrEqual(5);
  });
});
