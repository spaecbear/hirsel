import { describe, expect, it } from "vitest";
import { Game, newGame } from "../src/sim/game";
import { BALANCE, SEASON_DAYS, SEASON_ORDER } from "../src/sim/config";
import { EVENT_ORDER, EVENTS, EVENTS_BALANCE as E, eventDef, showDayOfYear, showScore, trialChance } from "../src/sim/events";
import { NORMAL, INVERSE } from "../src/sim/lexicon";
import { hydrate } from "../src/sim/save";
import type { EventId, GameState, Sheep } from "../src/sim/types";

let nextId = 5000;
const ewe = (patch: Partial<Sheep> = {}): Sheep => ({ id: nextId++, fleece: 6, breed: "blackface", age: 40, ...patch });
const dayOf = (id: string, inSeason = 1) => SEASON_ORDER.indexOf(id as never) * SEASON_DAYS + inSeason;

function harness(patch: Partial<GameState> = {}) {
  const game = new Game(Object.assign(newGame({ seed: 9 }), { money: 500, hay: 500, flock: [ewe(), ewe(), ewe()] }, patch));
  game.onAnim = (_a, after) => after?.();
  game.state.owned.pelt = true; // no fox: this is about the door
  return { game, g: game.state };
}

/** sleep into the given day's dawn, with the dice set */
function dawnOn(game: Game, day: number, roll = 0.99) {
  game.state.day = day - 1;
  game.rng = () => roll;
  game.sleep();
}

const pend = (g: GameState, id: EventId, data: Record<string, string | number> = {}) => {
  g.event = { id, day: g.day, data };
  g.eventDays[id] = g.day;
};

describe("the events", () => {
  it("are all asked about, and every one offers a choice that costs nothing", () => {
    expect([...EVENT_ORDER].sort()).toEqual(EVENTS.map((e) => e.id).sort());
    const g = harness({ owned: { collie: true, pelt: true }, pubs: 3 }).g;
    for (const ev of EVENTS) {
      const data: Record<string, string | number> =
        ev.id === "dealer" ? { kind: "ewe", id: "cheviot", price: 28 } : ev.id === "neighbour-gift" ? { kind: "hay" } : {};
      const free = ev.choices(g, data, NORMAL).filter((c) => c.fallback);
      expect(free, ev.id).toHaveLength(1);
      expect(free[0].taps ?? 0, ev.id).toBe(0);
      expect(free[0].money ?? 0, ev.id).toBe(0);
    }
  });

  it("never come in the first week", () => {
    const { game, g } = harness();
    for (let d = 2; d < E.firstDay; d++) {
      dawnOn(game, d, 0);
      expect(g.event, `day ${d}`).toBeNull();
    }
  });

  it("never mention the sword, the wolf or how he is called, in either vocabulary", () => {
    const g = harness({ owned: { collie: true, pelt: true }, pubs: 3 }).g;
    for (const lex of [NORMAL, INVERSE]) {
      for (const ev of EVENTS) {
        const data = { kind: "ewe", id: "cheviot", price: 28 };
        const text = [ev.title(g, data, lex), ev.body(g, data, lex), ...ev.choices(g, data, lex).map((c) => `${c.label} ${c.detail ?? ""}`)].join(" ");
        expect(text, ev.id).not.toMatch(/\b(sword|wolf|summon|corrie)\b/i);
      }
    }
  });

  it("come one at a time, and one left unanswered takes its free choice at the next dawn", () => {
    const { game, g } = harness({ day: 20 });
    pend(g, "neighbour");
    const goodwill = g.goodwill;
    game.rng = () => 0.99;
    game.sleep();
    expect(g.goodwill).toBe(goodwill); // declined, not helped
    expect(g.log.some((l) => l.t.includes("went off down the road after them"))).toBe(true);
  });

  it("refuse a choice that cannot be afforded, rather than half doing it", () => {
    const { game, g } = harness({ day: 30, money: 5 });
    pend(g, "dealer", { kind: "ewe", id: "shetland", price: 40 });
    game.answerEvent("buy");
    expect(g.event).not.toBeNull();
    expect(g.money).toBe(5);
    expect(g.flock).toHaveLength(3);
  });

  it("take their taps out of the day, and count as the day's work", () => {
    const { game, g } = harness({ day: 30 });
    pend(g, "neighbour");
    const taps = g.taps;
    game.answerEvent("help");
    expect(g.taps).toBe(taps - 1);
    expect(g.actsToday).toBe(1);
    expect(g.goodwill).toBe(1);
    expect(g.event).toBeNull();
  });

  it("survive a save from before them", () => {
    const old = newGame() as Partial<GameState>;
    delete old.event;
    delete old.eventDays;
    delete old.goodwill;
    const h = hydrate(old as GameState);
    expect(h.event).toBeNull();
    expect(h.eventDays).toEqual({});
    expect(h.goodwill).toBe(0);
  });
});

describe("the letters", () => {
  it("come on their days, once each, whatever the dice", () => {
    const { game, g } = harness();
    dawnOn(game, 9);
    expect(g.event?.id).toBe("letter-boss");
    game.answerEvent("fire");
    dawnOn(game, 10);
    expect(g.event).toBeNull();
  });

  it("wait a day if something else was at the door, rather than being lost", () => {
    const { game, g } = harness();
    g.eventDays["letter-boss"] = 9;
    g.goodwill = E.goodwillForGift; // the gift would come today…
    dawnOn(game, 40);
    expect(g.event?.id).toBe("letter-mother"); // …but the letter is asked first
  });

  it("from your mother has ten pound in it", () => {
    const { game, g } = harness({ money: 0 });
    pend(g, "letter-mother");
    game.answerEvent("take");
    expect(g.money).toBe(E.motherMoney);
  });
});

describe("the show", () => {
  it("is on its day each summer", () => {
    const { game, g } = harness();
    g.eventDays = { "letter-boss": 1, "letter-mother": 1, "letter-friend": 1 };
    dawnOn(game, showDayOfYear(1));
    expect(g.event?.id).toBe("show");
    expect(showDayOfYear(2)).toBe(showDayOfYear(1) + SEASON_DAYS * 4);
  });

  it("judges your best grown ewe on breed and fleece, and better if tended", () => {
    const plain = harness({ flock: [ewe({ fleece: 2 }), ewe({ fleece: 7, breed: "shetland" }), ewe({ lamb: true, fleece: 8, breed: "shetland" })] }).g;
    const best = showScore(plain)!;
    expect(best.breed).toBe("shetland");
    const tended = harness({ flock: plain.flock, buffs: { tended: 3 } }).g;
    expect(showScore(tended)!.score).toBeCloseTo(best.score * 1.2);
  });

  it("pays a prize and a rosette when she places", () => {
    const { game, g } = harness({ money: 0, flock: [ewe({ fleece: 8, breed: "shetland" })] });
    pend(g, "show");
    game.rng = () => 0; // first in her class
    game.answerEvent("ewe");
    expect(g.money).toBe(E.showFirst);
    expect(g.stats.rosettes).toBe(1);
    expect(g.achievements).toContain("rosette");
  });

  it("offers the trial only with a dog, and the collie is the better trials dog", () => {
    const none = harness().g;
    expect(eventDef("show").choices(none, {}, NORMAL).some((c) => c.id === "trial")).toBe(false);
    const collie = harness({ owned: { collie: true } }).g;
    const sheltie = harness({ owned: { dog: true } }).g;
    expect(eventDef("show").choices(collie, {}, NORMAL).some((c) => c.id === "trial")).toBe(true);
    expect(trialChance(collie)).toBeGreaterThan(trialChance(sheltie));
    const oldCollie = harness({ owned: { collie: true }, dogDays: BALANCE.dogOldDays }).g;
    expect(trialChance(oldCollie)).toBeCloseTo(trialChance(collie) / 2);
  });
});

describe("her, and the ceilidh", () => {
  it("counts walking the hill with her as an evening", () => {
    const { game, g } = harness({ pubs: 3 });
    pend(g, "visit");
    game.answerEvent("walk");
    expect(g.pubs).toBe(4);
  });

  it("comes once, and only once you know her", () => {
    const { game, g } = harness({ pubs: 1, day: 30 });
    g.eventDays = { "letter-boss": 1, "letter-mother": 1 };
    dawnOn(game, 31, 0);
    expect(g.event?.id).not.toBe("visit");
    const h = harness({ pubs: 3 });
    h.g.eventDays = { "letter-boss": 1, "letter-mother": 1, visit: 20 };
    dawnOn(h.game, 31, 0);
    expect(h.g.event?.id).not.toBe("visit");
  });

  it("is a ceilidh each autumn once you know her: an evening, and hale, for £4 and a tap", () => {
    const { game, g } = harness({ pubs: 2 });
    g.eventDays = { "letter-boss": 1, "letter-mother": 1 };
    dawnOn(game, dayOf("autumn", E.ceilidhDay));
    expect(g.event?.id).toBe("ceilidh");
    const money = g.money;
    game.answerEvent("go");
    expect(g.pubs).toBe(3);
    expect(g.money).toBe(money - E.ceilidhCost);
    expect(g.buffs.hale).toBeGreaterThan(0);
  });
});

describe("Callum, and the dealer", () => {
  it("pays back two kindnesses: hay in the back end of the year, money in the front", () => {
    const { game, g } = harness({ goodwill: 2, day: dayOf("autumn", 5), hay: 0 });
    pend(g, "neighbour-gift", { kind: "hay" });
    game.answerEvent("thank");
    expect(g.hay).toBe(E.giftHay);
    expect(g.goodwill).toBe(0);
    expect(g.achievements).toContain("neighbour");
  });

  it("returning his stray is a kindness; keeping her is a ewe, and he knows", () => {
    const back = harness({ goodwill: 1 });
    pend(back.g, "stray");
    back.game.answerEvent("return");
    expect(back.g.goodwill).toBe(2);
    const kept = harness({ goodwill: 1 });
    pend(kept.g, "stray");
    kept.game.answerEvent("keep");
    expect(kept.g.flock).toHaveLength(4);
    expect(kept.g.goodwill).toBe(0);
  });

  it("the dealer sells under the cart price, a ewe or a tool you lack", () => {
    const { game, g } = harness({ money: 100 });
    pend(g, "dealer", { kind: "tool", id: "boots", name: "Stout boots", price: 21 });
    const taps = g.taps;
    game.answerEvent("buy");
    expect(g.owned.boots).toBe(true);
    expect(g.money).toBe(79);
    expect(g.taps).toBe(taps + 1); // the boots do what the cart's boots do
  });

  it("never offers a second dog while one is working, the sword, or the watch", () => {
    const offered = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { game, g } = harness({ owned: { collie: true, pelt: true }, day: 30 });
      g.eventDays = { "letter-boss": 1, "letter-mother": 1 };
      // the dealer's chance lands, then his pick walks through everything he carries
      const rolls = [0.01, 0.01, 0.01, i / 60];
      g.day = 30;
      game.rng = () => rolls.shift() ?? 0.99;
      game.sleep();
      const ev = g.event as GameState["event"];
      if (ev?.id === "dealer") offered.add(String(ev.data.id));
    }
    expect(offered.size).toBeGreaterThan(3);
    for (const bad of ["dog", "collie", "sword", "watch"]) expect(offered.has(bad), bad).toBe(false);
  });
});
