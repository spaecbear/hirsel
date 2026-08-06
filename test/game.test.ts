import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, OPEN_QUESTIONS } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import type { AnimId, GameState, Sheep } from "../src/sim/types";

/** run the game with animations resolved instantly, in order */
function harness(patch: Partial<GameState> = {}) {
  const state = Object.assign(newGame({ seed: 7 }), patch);
  const game = new Game(state);
  const played: AnimId[] = [];
  game.onAnim = (anim, after) => {
    played.push(anim);
    after?.();
  };
  return { game, state: game.state, played };
}

const sheep = (fleece: number, breed: Sheep["breed"] = "blackface"): Sheep => ({ id: Math.random(), fleece, breed, age: 0 });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("the day", () => {
  it("starts with six blackface, three taps, and forty pounds", () => {
    const { state } = harness();
    expect(state.flock).toHaveLength(BALANCE.startFlock);
    expect(state.flock.every((s) => s.breed === "blackface")).toBe(true);
    expect(state.taps).toBe(3);
    expect(state.money).toBe(40);
  });

  it("spends a tap per action, and none for gathering with the crook", () => {
    const { game, state } = harness();
    game.doAction("tend");
    expect(state.taps).toBe(2);
    state.owned.crook = true;
    game.doAction("gather");
    expect(state.taps).toBe(2);
    expect(state.gatheredToday).toBe(true);
  });

  it("refuses an action there are no taps for", () => {
    const { game, state } = harness({ taps: 0 });
    game.doAction("tend");
    expect(state.buffs.tended).toBeUndefined();
  });

  it("moving resets the day's gathering", () => {
    const { game, state } = harness();
    game.doAction("gather");
    expect(state.gatheredToday).toBe(true);
    game.moveTo(1);
    expect(state.gatheredToday).toBe(false);
    expect(state.at).toBe(1);
  });
});

describe("shearing", () => {
  it("takes every fleece over four and leaves the rest", () => {
    const { game, state } = harness({ flock: [sheep(6), sheep(2), sheep(5)] });
    game.doAction("shear");
    expect(state.flock.map((s) => s.fleece)).toEqual([0, 2, 0]);
    expect(state.wool).toBe(11);
  });

  it("is blocked in rain and in haar", () => {
    for (const wx of ["rain", "mist"] as const) {
      const { game, state } = harness({ flock: [sheep(6)], forecast: [wx, "sun", "sun"] });
      game.doAction("shear");
      expect(state.wool).toBe(0);
      expect(state.flock[0].fleece).toBe(6);
    }
  });

  it("blade shears and steady hands multiply the clip", () => {
    const base = harness({ flock: [sheep(8)] });
    base.game.doAction("shear");

    const buffed = harness({ flock: [sheep(8)], owned: { shears: true }, buffs: { "steady hands": 2 } });
    buffed.game.doAction("shear");
    expect(buffed.state.wool).toBe(Math.round(8 * 1.15 * 1.2));
    expect(buffed.state.wool).toBeGreaterThan(base.state.wool);
  });
});

describe("the night", () => {
  it("resolves grazing, feed, regrowth, weather and the new day in order", () => {
    const { game, state } = harness({ flock: [sheep(5), sheep(5)], money: 100 });
    const before = state.pastures[0].grass;
    game.sleep();
    expect(state.day).toBe(2);
    expect(state.taps).toBe(3);
    expect(state.money).toBe(99); // ceil(2/2)
    expect(state.forecast).toHaveLength(3);
    expect(state.pastures[0].grass).toBeLessThanOrEqual(before);
    expect(state.flock.every((s) => s.fleece > 5)).toBe(true);
    expect(state.flock.every((s) => s.age === 1)).toBe(true);
  });

  it("decrements buffs and drops them at zero", () => {
    const { game, state } = harness({ buffs: { tended: 1, hale: 3 } });
    game.sleep();
    expect(state.buffs.tended).toBeUndefined();
    expect(state.buffs.hale).toBe(2);
  });

  it("the dog gathers if you did not", () => {
    const { game, state } = harness({ owned: { dog: true } });
    game.sleep();
    expect(state.log.some((l) => l.t.includes("brought them in herself"))).toBe(true);
  });

  it("takes a sheep only after the raid animation has finished", () => {
    const state = Object.assign(newGame({ seed: 3 }), { flock: [sheep(4), sheep(4)] });
    const game = new Game(state);
    game.rng = () => 0; // every roll hits
    let pending: (() => void) | undefined;
    game.onAnim = (anim, after) => {
      if (anim === "fox") pending = after;
      else after?.();
    };
    game.sleep();
    expect(pending).toBeTypeOf("function");
    expect(game.state.flock).toHaveLength(2); // still two while the fox is on screen
    pending?.();
    expect(game.state.flock).toHaveLength(1);
    expect(game.state.stats.foxLosses).toBe(1);
  });

  it("ends the run when the last sheep goes", () => {
    const state = Object.assign(newGame({ seed: 3 }), { flock: [sheep(4)] });
    const game = new Game(state);
    game.rng = () => 0;
    game.onAnim = (_a, after) => after?.();
    game.sleep();
    expect(game.state.flock).toHaveLength(0);
    expect(game.state.over?.kind).toBe("lose");
  });

  it("ends the run when the purse goes below zero", () => {
    const { game, state } = harness({ money: 0, flock: [sheep(4), sheep(4)] });
    game.rng = () => 1; // no fox, no strike
    game.sleep();
    expect(state.money).toBeLessThan(0);
    expect(state.over?.kind).toBe("lose");
  });
});

describe("the last wolf", () => {
  const armed = (sword: boolean) =>
    harness({
      at: 2,
      day: 5,
      taps: 6,
      owned: { boots: true, crook: true, ...(sword ? { sword: true } : {}) },
      flock: [sheep(4), sheep(4), sheep(4), sheep(4)],
    });

  it("fires the instant the fifth action is spent, with no prompt", () => {
    const { game, played } = armed(true);
    for (let i = 0; i < 4; i++) game.doAction("pipe");
    expect(played).not.toContain("wolf");
    game.doAction("pipe");
    expect(played).toContain("wolf");
  });

  it("with the sword you take the pelt and foxes stop mattering", () => {
    const { game, state } = armed(true);
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    expect(state.owned.pelt).toBe(true);
    expect(state.flock).toHaveLength(4);
  });

  it("without the sword the flock is cut to the survivors, after the animation", () => {
    const { game, state } = armed(false);
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    expect(state.owned.pelt).toBeUndefined();
    expect(state.flock).toHaveLength(OPEN_QUESTIONS.survivorsAfterWolf);
    expect(state.stats.wolfMaulings).toBe(1);
  });

  it("can be forced by the 1680 code with none of the conditions met", () => {
    // day 1, the low field, no boots, no crook, no actions spent
    const { game, state, played } = harness({ flock: [sheep(4), sheep(4), sheep(4)], owned: { sword: true } });
    expect(game.forceWolf()).toBe("pelt");
    expect(played).toContain("wolf");
    expect(state.owned.pelt).toBe(true);
  });

  it("earns the hidden achievement for taking the pelt, and only then", () => {
    const { game, state } = harness({ flock: [sheep(4)], owned: { sword: true } });
    expect(state.achievements).not.toContain("pelt");
    game.forceWolf();
    expect(state.achievements).toContain("pelt");
    // and it stays hidden until it is earned
    const ach = ACHIEVEMENTS.find((a) => a.id === "pelt")!;
    expect(ach.secret).toBe(true);
    expect(ACHIEVEMENTS.find((a) => a.id === "mauled")!.secret).toBe(true);
  });

  it("forced without the sword still costs the flock", () => {
    const { game, state } = harness({ flock: [sheep(4), sheep(4), sheep(4)] });
    expect(game.forceWolf()).toBe("mauled");
    expect(state.flock).toHaveLength(OPEN_QUESTIONS.survivorsAfterWolf);
  });

  it("will not come a second time once the pelt is taken", () => {
    const { game, played } = harness({ flock: [sheep(4)], owned: { pelt: true } });
    expect(game.forceWolf()).toBe("none");
    expect(played).not.toContain("wolf");
    expect(played).not.toContain("wolflost");
  });

  it("warns twice, and neither warning says wolf", () => {
    const { game, state } = armed(false);
    for (let i = 0; i < 4; i++) game.doAction("pipe");
    const warned = state.log.find((l) => l.t.includes("Something is watching"));
    expect(warned).toBeTruthy();
    expect(state.log.some((l) => /wolf/i.test(l.t))).toBe(false);
  });
});

describe("the croft and the ask", () => {
  it("is strictly sequential", () => {
    const { game, state } = harness({ money: 2000 });
    game.buyCroft("hearth");
    expect(state.owned.hearth).toBeUndefined();
    game.buyCroft("roof");
    game.buyCroft("hearth");
    expect(state.owned.hearth).toBe(true);
  });

  it("needs all four milestones and six pints", () => {
    const ask = ACTIONS.find((a) => a.id === "ask")!;
    const { game, state } = harness({ money: 3000 });
    expect(ask.can(state)).toBe(false);
    for (const id of ["roof", "hearth", "byre", "ring"] as const) game.buyCroft(id);
    expect(ask.can(state)).toBe(false);
    state.pubs = BALANCE.pubsToAsk;
    expect(ask.can(state)).toBe(true);
    expect(ask.desc(state)).toContain("Go on");
  });

  it("names the next missing piece, so the player is never guessing", () => {
    const ask = ACTIONS.find((a) => a.id === "ask")!;
    const { state } = harness();
    expect(ask.desc(state)).toContain("slate the cottage roof");
  });

  it("the pint surfaces what is still missing from the second one on", () => {
    const { game, state } = harness({ money: 100 });
    game.doAction("pub");
    game.state.taps = 3;
    game.doAction("pub");
    expect(state.log.some((l) => l.t.includes("roof still lets the rain in"))).toBe(true);
  });
});

describe("the pocket watch", () => {
  it("records a day and replays it, skipping what cannot be done", () => {
    const { game, state } = harness({ taps: 6, owned: { watch: true } });
    game.startRecording();
    game.doAction("tend");
    game.moveTo(1);
    game.stopRecording();
    expect(state.routine).toHaveLength(2);

    state.taps = 6;
    state.at = 0;
    state.buffs = {};
    game.runRoutine();
    expect(state.buffs.tended).toBe(BALANCE.tendDays);
    expect(state.at).toBe(1);
  });
});
