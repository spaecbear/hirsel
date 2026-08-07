import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, OPEN_QUESTIONS, START_MONEY } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import { dogFoxBias, foxRisk, grazing, here, readyToShear, weatherOn } from "../src/sim/rules";
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

  it("buffs refresh rather than stack — playing twice doesn't extend or double them", () => {
    // player question: does the bagpipes' fox-risk cut get better if you
    // play twice in a day? No — every buff goes through Game.buff(), which
    // is Math.max(existing, days), always. The second use just re-confirms
    // the same clock, it never adds to it.
    const { game, state } = harness({ taps: 6 });
    game.doAction("music");
    expect(state.buffs["settled flock"]).toBe(BALANCE.cozyBuffDays);
    game.doAction("music"); // played again, same day
    expect(state.buffs["settled flock"]).toBe(BALANCE.cozyBuffDays); // not doubled, not stacked

    // and a night doesn't compound it either: one tick down, from the cap,
    // not from some higher stacked value
    game.sleep();
    expect(state.buffs["settled flock"]).toBe(BALANCE.cozyBuffDays - 1);
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

  it("does not always take the most recently bought ewe", () => {
    // player report: replace a stolen sheep and the fox takes the new one
    // next, every time. Cause: flock.pop() removes the array's last element,
    // and buyEwe always appends — so the newest purchase was always the
    // casualty. This runs the real risk roll across many seeds on the
    // highest-risk ground and checks who actually gets taken.
    const N = 300;
    let raids = 0;
    let takenNewest = 0;
    let takenOther = 0;
    for (let seed = 0; seed < N; seed++) {
      const state = Object.assign(newGame({ seed }), {
        flock: [sheep(4), sheep(4), sheep(4)],
        at: 2, // High Corrie: highest fox risk in the game
        forecast: ["mist", "mist", "mist"] as const, // highest fox weather bias
      });
      const game = new Game(state);
      game.onAnim = (_a, after) => after?.();
      const before = state.flock.map((s) => s.id);
      const newestId = before[before.length - 1];
      game.sleep();
      if (state.flock.length < before.length) {
        raids++;
        const remaining = new Set(state.flock.map((s) => s.id));
        const takenId = before.find((id) => !remaining.has(id));
        if (takenId === newestId) takenNewest++;
        else takenOther++;
      }
    }
    expect(raids, "sanity check: max-risk ground should raid often across 300 seeds").toBeGreaterThan(N * 0.4);
    // this is the bug, made concrete: it was 0 before the fix, every time
    expect(takenOther).toBeGreaterThan(0);
    // three sheep, picked by chance, should land on the newest one meaningfully
    // less than "always" — not a tight bound, just far from the old 100%
    expect(takenNewest / raids).toBeLessThan(0.6);
  });
});

describe("buying stock", () => {
  it("takes the money now but only adds the ewe once she has walked in", () => {
    const state = Object.assign(newGame({ seed: 5 }), { money: 100, flock: [sheep(4)] });
    const game = new Game(state);
    let arrive: (() => void) | undefined;
    let carried: { breed?: string } | undefined;
    game.onAnim = (anim, after, payload) => {
      if (anim === "buysheep") {
        arrive = after;
        carried = payload;
      } else after?.();
    };
    game.buyEwe("shetland");
    expect(state.money).toBe(46); // paid at once
    expect(state.flock).toHaveLength(1); // but not in the flock yet
    expect(carried?.breed).toBe("shetland"); // the animation knows what is coming
    arrive?.();
    expect(state.flock).toHaveLength(2);
    expect(state.flock[1].breed).toBe("shetland");
    expect(state.stats.sheepBought).toBe(1);
  });

  it("refuses when the purse is short, and spends nothing", () => {
    const { game, state } = harness({ money: 10 });
    game.buyEwe("shetland");
    expect(state.money).toBe(10);
    expect(state.flock).toHaveLength(BALANCE.startFlock);
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

  it("does not come while the day is still being worked — he comes at night", () => {
    const { game, played } = armed(true);
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    expect(played).not.toContain("wolf"); // five actions on the corrie, and nothing yet
    game.sleep();
    expect(played).toContain("wolf");
  });

  it("lets you walk off the corrie after the fifth action and get away with it", () => {
    const { game, state, played } = armed(false);
    state.taps = 6;
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    game.moveTo(0); // down off the high ground before lying down
    game.sleep();
    expect(played).not.toContain("wolflost");
    expect(state.flock).toHaveLength(4);
  });

  it("with the sword you take the pelt and foxes stop mattering", () => {
    const { game, state } = armed(true);
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    game.sleep();
    expect(state.owned.pelt).toBe(true);
    expect(state.flock).toHaveLength(4);
  });

  it("without the sword the flock is cut to the survivors, after the animation", () => {
    const { game, state } = armed(false);
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    game.sleep();
    expect(state.owned.pelt).toBeUndefined();
    expect(state.flock).toHaveLength(OPEN_QUESTIONS.survivorsAfterWolf);
    expect(state.stats.wolfMaulings).toBe(1);
  });

  it("no fox comes near ground he has walked over", () => {
    const { game, state, played } = armed(false);
    game.rng = () => 0; // every fox roll would otherwise hit
    for (let i = 0; i < 5; i++) game.doAction("pipe");
    game.sleep();
    expect(played).toContain("wolflost");
    expect(played).not.toContain("fox");
    expect(state.stats.foxLosses).toBe(0);
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
    game.sleep(); // the inn is once a night, so the second pint is the next one
    game.state.taps = 3;
    game.doAction("pub");
    expect(state.log.some((l) => l.t.includes("roof still lets the rain in"))).toBe(true);
  });

  it("the inn is once a night", () => {
    const { game, state } = harness({ money: 100, taps: 6 });
    game.doAction("pub");
    expect(state.pubs).toBe(1);
    const purse = state.money;

    game.doAction("pub"); // a second pint the same day
    expect(state.pubs, "no second pint").toBe(1);
    expect(state.money, "and no second £8").toBe(purse);

    game.sleep();
    state.taps = 3;
    game.doAction("pub");
    expect(state.pubs).toBe(2); // a new night, a new pint
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

describe("the pocket watch, interrupted", () => {
  /**
   * Reported: record a day, run it, then sleep before the sequence finishes.
   * Everything froze and the sequence never resumed; only a reload cleared it.
   * The step chain lives in animation callbacks, so `busy` stayed true with
   * nothing left alive to clear it.
   */
  function watchHarness() {
    const state = Object.assign(newGame({ seed: 11 }), { taps: 6, owned: { watch: true } });
    const game = new Game(state);
    const pending: (() => void)[] = [];
    // hold every animation open, the way real playback does
    game.onAnim = (_a, after) => {
      if (after) pending.push(after);
    };
    return { game, state, pending };
  }

  it("gives the day back when the night interrupts a running sequence", () => {
    const { game, state, pending } = watchHarness();
    state.routine = [{ kind: "act", act: "tend" }, { kind: "act", act: "pipe" }, { kind: "act", act: "music" }];

    game.runRoutine();
    expect(game.busy).toBe(true); // playback owns the day

    game.sleep(); // the reported interruption
    expect(game.busy, "the day must not stay frozen").toBe(false);
    expect(state.day).toBe(2);

    // the abandoned callbacks must not stagger on into the new day
    const tapsAfterSleep = state.taps;
    for (const resume of pending) resume();
    expect(game.busy).toBe(false);
    expect(state.taps).toBe(tapsAfterSleep);
  });

  it("a later run is not confused by the abandoned one", () => {
    const { game, state, pending } = watchHarness();
    state.routine = [{ kind: "act", act: "tend" }, { kind: "act", act: "pipe" }];
    game.runRoutine();
    game.cancelRoutine();
    for (const resume of pending) resume();

    state.taps = 6;
    game.runRoutine();
    expect(game.busy).toBe(true);
  });
});

describe("the dog and the instrument are slots, not a shopping list", () => {
  it("refuses a second dog, whichever you bought first", () => {
    for (const [first, second] of [["dog", "collie"], ["collie", "dog"]] as const) {
      const { game, state } = harness({ money: 500 });
      game.buyTool(first);
      expect(state.owned[first]).toBe(true);
      const purse = state.money;
      game.buyTool(second);
      expect(state.owned[second], `${second} after ${first}`).toBeUndefined();
      expect(state.money, "and it takes no money for refusing").toBe(purse);
    }
  });

  it("never lets the two deterrents compound", () => {
    // both would put fox risk at 0.6 x 0.75 = 0.45, quietly deleting the fox
    const { game, state } = harness({ money: 500, at: 2 });
    game.buyTool("dog");
    game.buyTool("collie");
    const both = state.owned.dog && state.owned.collie;
    expect(both).toBeFalsy();
    expect(dogFoxBias(state)).toBe(BALANCE.dogFoxBias);
  });

  it("the sheltie is the better deterrent, the collie the better grazier", () => {
    const sheltie = harness({ owned: { dog: true }, at: 1 });
    const collie = harness({ owned: { collie: true }, at: 1 });
    expect(foxRisk(sheltie.state)).toBeLessThan(foxRisk(collie.state));
    expect(grazing(collie.state).growth).toBeGreaterThan(grazing(sheltie.state).growth);
    // and both work the flock in overnight
    for (const h of [sheltie, collie]) {
      h.game.sleep();
      expect(h.state.log.some((l) => /had them in|brought them in/.test(l.t))).toBe(true);
    }
  });

  it("the fiddle replaces what the music action does, rather than adding to it", () => {
    const pipes = harness({ taps: 6 });
    pipes.game.doAction("music");
    expect(pipes.state.buffs["settled flock"]).toBe(BALANCE.cozyBuffDays);
    expect(pipes.state.buffs.fiddled).toBeUndefined();

    const fiddle = harness({ taps: 6, owned: { fiddle: true } });
    fiddle.game.doAction("music");
    expect(fiddle.state.buffs.fiddled).toBe(BALANCE.fiddleDays);
    expect(fiddle.state.buffs["settled flock"], "no stacking with the pipes").toBeUndefined();

    // more growth, and nothing against a fox — the trade we designed
    expect(grazing(fiddle.state).growth).toBeGreaterThan(grazing(pipes.state).growth);
    expect(foxRisk(fiddle.state)).toBeGreaterThan(foxRisk(pipes.state));
  });

  it("barks on the night she turns one, and only then", () => {
    // her whole worth is the raids that never happen, which the player could
    // never once see before
    let barks = 0;
    let raids = 0;
    for (let seed = 0; seed < 120; seed++) {
      const state = Object.assign(newGame({ seed }), {
        flock: [sheep(4), sheep(4), sheep(4)],
        at: 2,
        owned: { dog: true },
        forecast: ["mist", "sun", "sun"] as const,
      });
      const game = new Game(state);
      const played: AnimId[] = [];
      game.onAnim = (a, after) => {
        played.push(a);
        after?.();
      };
      game.sleep();
      if (played.includes("bark")) barks++;
      if (played.includes("fox")) raids++;
      // she never barks on a night one got through
      expect(played.includes("bark") && played.includes("fox")).toBe(false);
    }
    expect(barks, "she should be earning her keep some nights").toBeGreaterThan(0);
    expect(raids, "and not all of them").toBeGreaterThan(0);
  });
});

describe("what has been done today", () => {
  /**
   * Both reported: the fiddle could be played over and over because it never
   * showed as done, and mucking showed as already done on ground nobody had
   * touched. Both came of inferring "you did this" from side effects — the
   * fiddle sets a different buff from the pipes, and muck was reading "the
   * grass is high" as "you mucked it".
   */
  it("records the instrument however it is played", () => {
    const pipes = harness({ taps: 6 });
    pipes.game.doAction("music");
    expect(pipes.state.didToday.music).toBe(1);

    const fiddle = harness({ taps: 6, owned: { fiddle: true } });
    fiddle.game.doAction("music");
    expect(fiddle.state.didToday.music, "the fiddle counts as playing too").toBe(1);
    expect(fiddle.state.buffs.fiddled).toBe(BALANCE.fiddleDays);
    expect(fiddle.state.buffs["settled flock"], "and not the pipes' buff").toBeUndefined();
  });

  it("only counts ground actually mucked, per pasture", () => {
    const { game, state } = harness({ taps: 6 });
    state.pastures[0].grass = 50;
    state.pastures[1].grass = 50;
    expect(state.muckedToday).toEqual([]); // fresh ground is not "done"

    game.doAction("muck");
    expect(state.muckedToday).toEqual([0]);

    game.moveTo(1);
    expect(state.muckedToday, "moving hill does not carry it over").toEqual([0]);
    game.doAction("muck");
    expect(state.muckedToday).toEqual([0, 1]);
  });

  it("clears at the end of the night", () => {
    const { game, state } = harness({ taps: 6 });
    state.pastures[0].grass = 50;
    game.doAction("muck");
    game.doAction("pipe");
    game.sleep();
    expect(state.didToday).toEqual({});
    expect(state.muckedToday).toEqual([]);
  });
});

describe("work that scales with the flock", () => {
  const shear = ACTIONS.find((a) => a.id === "shear")!;
  const gather = ACTIONS.find((a) => a.id === "gather")!;
  const flockOf = (n: number) => Array.from({ length: n }, () => sheep(6));

  it("costs more to shear a bigger flock, up to a cap a day can hold", () => {
    expect(shear.cost(harness({ flock: flockOf(6) }).state)).toBe(1);
    expect(shear.cost(harness({ flock: flockOf(10) }).state)).toBe(1);
    expect(shear.cost(harness({ flock: flockOf(11) }).state)).toBe(2);
    expect(shear.cost(harness({ flock: flockOf(20) }).state)).toBe(2);
    expect(shear.cost(harness({ flock: flockOf(21) }).state)).toBe(3);
    // never more than a day can contain, however many there are
    expect(shear.cost(harness({ flock: flockOf(90) }).state)).toBe(BALANCE.shearMaxTaps);
    expect(BALANCE.shearMaxTaps).toBeLessThan(BALANCE.maxTaps);
  });

  it("blade shears get you through more of them in a tap", () => {
    const flock = flockOf(12);
    expect(shear.cost(harness({ flock }).state)).toBe(2);
    expect(shear.cost(harness({ flock, owned: { shears: true } }).state)).toBe(1);
  });

  it("a big flock takes two taps to gather alone, and a dog does the running", () => {
    const big = flockOf(BALANCE.bigFlock + 1);
    expect(gather.cost(harness({ flock: big }).state)).toBe(2);
    expect(gather.cost(harness({ flock: big, owned: { dog: true } }).state)).toBe(1);
    expect(gather.cost(harness({ flock: big, owned: { collie: true } }).state)).toBe(1);
    // the crook takes a tap off whatever it would otherwise be
    expect(gather.cost(harness({ flock: big, owned: { crook: true } }).state)).toBe(1);
    expect(gather.cost(harness({ flock: big, owned: { crook: true, dog: true } }).state)).toBe(0);
  });

  it("changes nothing for a starting flock", () => {
    // the early game was tight and is meant to stay exactly as it was
    const { state } = harness();
    expect(state.flock).toHaveLength(BALANCE.startFlock);
    expect(shear.cost(state)).toBe(1);
    expect(gather.cost(state)).toBe(1);
  });
});

describe("the economy", () => {
  /**
   * A modest, non-optimal policy: gather without the crook, shear and sell
   * when possible, muck thin ground, otherwise sleep. No tool purchases, no
   * pub, no pipe — a player who hasn't found the fast strategies yet.
   *
   * This test exists because of a direct player report: "a run of rain and I
   * can't get to market before I starve." Simulating this policy at the
   * spec's original 62±32p market found the report was right — median final
   * money after 30 days was £40, flat against the start, worst case £2.
   * Rain and haar together are ~43% of WEATHER_BAG, so a multi-day dead
   * streak isn't a tail case. Raised to 80±34p; this pins the fix down so a
   * future tuning pass can't silently walk it back to unplayable.
   */
  function playDay(game: Game) {
    const g = game.state;
    let guard = 0;
    while (g.taps > 0 && guard++ < 10) {
      if (!g.gatheredToday && !g.owned.crook) {
        game.doAction("gather");
        continue;
      }
      if (readyToShear(g.flock) > 0 && weatherOn(g).shear) {
        game.doAction("shear");
        continue;
      }
      if (g.wool > 0) {
        game.doAction("market");
        continue;
      }
      if (here(g).grass <= 60) {
        game.doAction("muck");
        continue;
      }
      break;
    }
    game.sleep();
  }

  function playMonth(seed: number) {
    const game = new Game(undefined, { seed });
    game.onAnim = (_a, after) => after?.();
    let minMoney = game.state.money;
    for (let d = 0; d < 30 && !game.state.over; d++) {
      playDay(game);
      minMoney = Math.min(minMoney, game.state.money);
    }
    return { bust: game.state.over?.kind === "lose", minMoney, final: game.state.money };
  }

  it("does not starve a careful-but-unoptimised player over a month, at the shipped market price", () => {
    const N = 40;
    const runs = Array.from({ length: N }, (_, i) => playMonth(5000 + i));
    const busts = runs.filter((r) => r.bust);
    const median = runs.map((r) => r.final).sort((a, b) => a - b)[Math.floor(N / 2)];

    expect(busts, `${busts.length}/${N} runs starved: ${JSON.stringify(busts)}`).toHaveLength(0);
    // a month of work should leave the player ahead, not flat against the start
    expect(median).toBeGreaterThan(START_MONEY);
    // and never within a single bad night's feed of going under
    expect(Math.min(...runs.map((r) => r.minMoney))).toBeGreaterThan(10);
  });
});
