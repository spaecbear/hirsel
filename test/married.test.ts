import { describe, expect, it } from "vitest";
import { ACTIONS, Game, newGame } from "../src/sim/game";
import { BALANCE, SEASON_DAYS } from "../src/sim/config";
import { ACHIEVEMENTS } from "../src/sim/achievements";
import { EVENTS_BALANCE as E, eventDef } from "../src/sim/events";
import { NORMAL } from "../src/sim/lexicon";
import { hydrate } from "../src/sim/save";
import { feedCost, tapsPerDay } from "../src/sim/rules";
import type { GameState, Sheep } from "../src/sim/types";

let nextId = 7000;
const ewe = (): Sheep => ({ id: nextId++, fleece: 4, breed: "blackface", age: 40 });
const built = { roof: true, hearth: true, byre: true, ring: true } as const;

/** a run that has just been won: the croft built, six evenings in, and she has said aye */
function wonRun(patch: Partial<GameState> = {}) {
  const game = new Game(
    Object.assign(newGame({ seed: 4 }), { day: 150, money: 300, pubs: 6, owned: { ...built, pelt: true }, flock: [ewe(), ewe(), ewe(), ewe(), ewe(), ewe()] }, patch),
  );
  game.onAnim = (_a, after) => after?.();
  game.doAction("ask");
  return { game, g: game.state };
}

describe("staying on the hill", () => {
  it("carries a won run on: the ending is lifted, the day goes on, and she is at the croft", () => {
    const { game, g } = wonRun();
    expect(g.over?.kind).toBe("win");
    expect(g.achievements).toContain("aye");
    const taps = g.taps;
    game.stayOn();
    expect(g.over).toBeNull();
    expect(g.married).toBe(150);
    expect(g.taps).toBe(Math.min(BALANCE.maxTaps, taps + BALANCE.marriedTaps));
    expect(g.achievements).toContain("aye"); // won is won
  });

  it("does nothing to a run that was lost, or one not over", () => {
    const lost = new Game(newGame());
    lost.state.over = { kind: "lose", title: "x", body: "y" };
    lost.stayOn();
    expect(lost.state.over?.kind).toBe("lose");
    expect(lost.state.married).toBeNull();
    const going = new Game(newGame());
    going.stayOn();
    expect(going.state.married).toBeNull();
  });

  it("gives the day another tap, two pairs of hands, still inside the cap", () => {
    const { game, g } = wonRun();
    const before = tapsPerDay({ ...g, married: null });
    game.stayOn();
    expect(tapsPerDay(g)).toBe(Math.min(BALANCE.maxTaps, before + BALANCE.marriedTaps));
    const full = { ...g, owned: { ...g.owned, boots: true, lamp: true }, buffs: { hale: 3 } };
    expect(tapsPerDay(full)).toBe(BALANCE.maxTaps);
  });

  it("will not ask her twice", () => {
    const { game, g } = wonRun();
    game.stayOn();
    expect(ACTIONS.find((a) => a.id === "ask")!.can(g)).toBe(false);
  });

  it("says good morning, the first morning", () => {
    const { game, g } = wonRun();
    game.stayOn();
    game.sleep();
    expect(g.log.some((l) => l.t.includes("first morning with two in the house"))).toBe(true);
  });

  it("stands her a pint at the inn", () => {
    const { game, g } = wonRun();
    game.stayOn();
    const money = g.money;
    game.doAction("pub");
    expect(g.money).toBe(money);
    expect(g.log.some((l) => l.t.includes("will not take your money"))).toBe(true);
  });

  it("is kept in a save, and a save from before it is unmarried", () => {
    const old = newGame() as Partial<GameState>;
    delete old.married;
    delete old.garden;
    const h = hydrate(old as GameState);
    expect(h.married).toBeNull();
    expect(h.garden).toBe(false);
  });
});

describe("married life", () => {
  it("brings no more courting: her afternoon off and the ceilidh are for before", () => {
    const { game, g } = wonRun();
    game.stayOn();
    expect(eventDef("visit").due(g, () => 0)).toBeNull();
    expect(eventDef("ceilidh").due({ ...g, day: SEASON_DAYS * 2 + E.ceilidhDay }, () => 0)).toBeNull();
  });

  it("digs her a kale patch, and the feed bill is lighter for good", () => {
    const { game, g } = wonRun();
    game.stayOn();
    g.day = g.married! + E.gardenAfter;
    const due = eventDef("garden").due(g, () => 0);
    expect(due).not.toBeNull();
    const bill = feedCost(g);
    g.event = { id: "garden", day: g.day, data: {} };
    g.taps = 5;
    game.answerEvent("dig");
    expect(g.garden).toBe(true);
    expect(feedCost(g)).toBe(Math.max(0, bill - BALANCE.gardenFeed));
    expect(eventDef("garden").due(g, () => 0)).toBeNull(); // dug once
  });

  it("keeps the anniversary, a year on", () => {
    const { game, g } = wonRun();
    game.stayOn();
    g.day = g.married! + SEASON_DAYS * 4 - 1;
    expect(eventDef("anniversary").due(g, () => 0)).toBeNull();
    g.day += 1;
    expect(eventDef("anniversary").due(g, () => 0)).not.toBeNull();
    expect(ACHIEVEMENTS.find((a) => a.id === "year-wed")!.won(g)).toBe(true);
  });

  it("has her mother up, once, and every married event can be declined for nothing", () => {
    const { game, g } = wonRun();
    game.stayOn();
    g.day = g.married! + E.herMotherAfter;
    expect(eventDef("her-mother").due(g, () => 0)).not.toBeNull();
    for (const id of ["anniversary", "garden", "her-mother"] as const) {
      const free = eventDef(id).choices(g, {}, NORMAL).filter((c) => c.fallback);
      expect(free, id).toHaveLength(1);
      expect(free[0].taps ?? 0).toBe(0);
    }
  });

  it("keeps the long game's achievements out of what the credits ask for", () => {
    expect(ACHIEVEMENTS.filter((a) => a.longGame).map((a) => a.id).sort()).toEqual(["fifty-lambs", "year-wed"]);
  });

  it("counts fifty lambs for the long game", () => {
    const a = ACHIEVEMENTS.find((x) => x.id === "fifty-lambs")!;
    const g = newGame();
    g.stats.lambsBorn = 49;
    expect(a.won(g)).toBe(false);
    g.stats.lambsBorn = 50;
    expect(a.won(g)).toBe(true);
  });
});
