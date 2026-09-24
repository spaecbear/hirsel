import { describe, expect, it } from "vitest";
import { Game, collieAtFire, newGame } from "../src/sim/game";
import { BALANCE } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import { hydrate } from "../src/sim/save";
import { workGlossary } from "../src/sim/glossary";
import { dogDaysLeft, dogFoxBias, dogIsOld, foxRisk, grazing, hasDog, retiredFoxBias } from "../src/sim/rules";
import type { GameState, Sheep, WeatherId } from "../src/sim/types";

const sheep = (): Sheep => ({ id: Math.random(), fleece: 4, breed: "blackface", age: 0 });

function harness(patch: Partial<GameState> = {}) {
  const game = new Game(
    Object.assign(newGame({ seed: 5 }), { flock: [sheep(), sheep(), sheep(), sheep(), sheep(), sheep()], money: 1000 }, patch),
  );
  game.onAnim = (_a, after) => after?.();
  return { game, g: game.state };
}

/** sleep until the dog has worked `n` nights, keeping the run alive */
function workNights(game: Game, n: number) {
  for (let i = 0; i < n; i++) {
    game.state.money = 1000;
    if (game.state.flock.length < 3) game.state.flock.push(sheep(), sheep(), sheep());
    game.state.owned.pelt = true; // no fox, no wolf: this is about the dog
    game.sleep();
  }
}

describe("a working dog grows old", () => {
  it("starts her working life the day she is bought", () => {
    const { game, g } = harness({ dogDays: 40 });
    game.buyTool("collie");
    expect(g.dogDays).toBe(0);
    workNights(game, 3);
    expect(g.dogDays).toBe(3);
  });

  it("is in her prime for a year, then worth half what she was", () => {
    const young = harness({ owned: { dog: true }, dogDays: BALANCE.dogOldDays - 1 }).g;
    const old = harness({ owned: { dog: true }, dogDays: BALANCE.dogOldDays }).g;
    expect(dogIsOld(young)).toBe(false);
    expect(dogFoxBias(young)).toBe(BALANCE.dogFoxBias);
    expect(dogIsOld(old)).toBe(true);
    expect(dogFoxBias(old)).toBeCloseTo(1 - (1 - BALANCE.dogFoxBias) * BALANCE.oldDogStrength);
  });

  it("slows the collie's grazing bonus the same way", () => {
    const base = { flock: [sheep(), sheep()], forecast: ["overcast", "sun", "sun"] as WeatherId[] };
    const none = grazing(harness(base).g).growth;
    const young = grazing(harness({ ...base, owned: { collie: true } }).g).growth;
    const old = grazing(harness({ ...base, owned: { collie: true }, dogDays: BALANCE.dogOldDays }).g).growth;
    expect(young / none).toBeCloseTo(BALANCE.collieGraze);
    expect(old / none).toBeCloseTo(1 + (BALANCE.collieGraze - 1) * BALANCE.oldDogStrength);
  });

  it("still gathers them in when she is old", () => {
    const { game, g } = harness({ owned: { dog: true }, dogDays: BALANCE.dogOldDays + 5 });
    g.owned.pelt = true;
    game.sleep();
    expect(g.log.some((l) => l.t.includes("slower about it"))).toBe(true);
  });

  it("says so at dawn when she gets old, and again when her time is nearly up", () => {
    const { game, g } = harness({ owned: { dog: true }, dogDays: BALANCE.dogOldDays - 1 });
    workNights(game, 1);
    expect(g.log.some((l) => l.t.includes("getting on"))).toBe(true);
    g.dogDays = BALANCE.dogRetireDays - BALANCE.dogRetireWarnDays - 1;
    workNights(game, 1);
    expect(g.log.some((l) => l.t.includes("not much work left"))).toBe(true);
    expect(dogDaysLeft(g)).toBe(BALANCE.dogRetireWarnDays);
  });
});

describe("retiring to the fire", () => {
  it("happens on the morning her working life is done, and frees the slot", () => {
    const { game, g } = harness({ owned: { collie: true }, dogDays: BALANCE.dogRetireDays - 1 });
    workNights(game, 1);
    expect(hasDog(g)).toBe(false);
    expect(g.owned.collie).toBeUndefined();
    expect(g.retiredDogs).toEqual(["collie"]);
    expect(g.dogDays).toBe(0);
    expect(g.log.some((l) => l.t.includes("earned her place by the fire"))).toBe(true);
  });

  it("lets another dog be bought — either kind — once she has retired", () => {
    const { game, g } = harness({ owned: { collie: true }, dogDays: BALANCE.dogRetireDays - 1 });
    game.buyTool("dog");
    expect(g.owned.dog).toBeUndefined(); // one dog on the hill at a time, still
    workNights(game, 1);
    game.buyTool("dog");
    expect(g.owned.dog).toBe(true);
    expect(g.dogDays).toBe(0);
    expect(g.log.some((l) => l.t.includes("old dog looks up from the fire"))).toBe(true);
  });

  it("does not stop a new dog of the same kind being bought", () => {
    const { game, g } = harness({ owned: { dog: true }, dogDays: BALANCE.dogRetireDays - 1 });
    workNights(game, 1);
    game.buyTool("dog");
    expect(g.owned.dog).toBe(true);
    expect(g.retiredDogs).toEqual(["dog"]);
  });

  it("keeps an ear out at night: a little off the fox, for up to two of them", () => {
    const base = { flock: [sheep(), sheep(), sheep(), sheep(), sheep(), sheep()], forecast: ["overcast", "sun", "sun"] as WeatherId[] };
    const none = foxRisk(harness(base).g);
    expect(foxRisk(harness({ ...base, retiredDogs: ["dog"] }).g) / none).toBeCloseTo(BALANCE.retiredFoxBias);
    const three = harness({ ...base, retiredDogs: ["dog", "collie", "dog"] }).g;
    expect(retiredFoxBias(three)).toBeCloseTo(BALANCE.retiredFoxBias ** BALANCE.retiredCounted);
  });

  it("counts a retired collie at a built hearth for Tippy", () => {
    const { game, g } = harness({ retiredDogs: ["collie"], owned: { hearth: true } });
    expect(collieAtFire(g)).toBe(true);
    game.markTippy();
    expect(g.stats.sawTippy).toBe(true);
    expect(collieAtFire(harness({ retiredDogs: ["dog"], owned: { hearth: true } }).g)).toBe(false);
    expect(collieAtFire(harness({ retiredDogs: ["collie"] }).g)).toBe(false);
  });

  it("earns its achievement", () => {
    const a = ACHIEVEMENTS.find((x) => x.id === "old-dog")!;
    expect(a.secret).toBeFalsy();
    const { game, g } = harness({ owned: { dog: true }, dogDays: BALANCE.dogRetireDays - 1 });
    workNights(game, 1);
    expect(g.achievements).toContain("old-dog");
  });

  it("back-fills a save from before it existed as a young dog and an empty hearthstone", () => {
    const old = newGame() as Partial<GameState>;
    delete old.dogDays;
    delete old.retiredDogs;
    const h = hydrate(old as GameState);
    expect(h.dogDays).toBe(0);
    expect(h.retiredDogs).toEqual([]);
  });

  it("is described in the glossary from the same numbers", () => {
    const e = workGlossary().find((x) => x.id === "dogs")!;
    expect(e.meta).toContain(String(BALANCE.dogOldDays));
    expect(e.meta).toContain(String(BALANCE.dogRetireDays));
  });
});
