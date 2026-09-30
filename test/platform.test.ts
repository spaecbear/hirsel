import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, newGame } from "../src/sim/game";
import { CHEATS, findCheat, runCheat, type CheatContext } from "../src/sim/cheats";
import { clearEarned, loadEarned, syncAchievements } from "../src/sim/achievements";
import { hydrate, readSave, saveGame } from "../src/sim/save";
import { DEFAULT_SETTINGS } from "../src/sim/settings";
import { platform } from "../src/platform";
import type { Sheep } from "../src/sim/types";

const sheep = (fleece: number): Sheep => ({ id: Math.random(), fleece, breed: "blackface", age: 0 });

function ctx(game: Game): CheatContext {
  const noop = () => {};
  return {
    game,
    settings: { ...DEFAULT_SETTINGS },
    toggleRetro: noop,
    toggleInverse: noop,
    toggleZen: noop,
    toggleSwift: noop,
    setSpeed: noop,
    closeSettings: noop,
  };
}

function quietGame(patch: Parameters<typeof Object.assign>[1] = {}) {
  const game = new Game(Object.assign(newGame({ seed: 7 }), patch));
  game.onAnim = (_anim, after) => after?.();
  return game;
}

beforeEach(() => {
  vi.restoreAllMocks();
  clearEarned();
});

describe("the platform seam", () => {
  it("is the web platform under test, backed by localStorage", () => {
    expect(platform.kind).toBe("web");
    platform.write("hirsel.test", "aye");
    expect(localStorage.getItem("hirsel.test")).toBe("aye");
    platform.remove("hirsel.test");
    expect(platform.read("hirsel.test")).toBeNull();
  });

  it("round-trips a save through it", () => {
    const g = newGame({ seed: 3 });
    g.money = 123;
    expect(saveGame(g)).toBe(true);
    expect(readSave()?.state.money).toBe(123);
  });

  it("tells the storefront about each new achievement, once", () => {
    const spy = vi.spyOn(platform, "unlockAchievement");
    const game = quietGame({ flock: [sheep(4)], owned: { sword: true } });
    game.forceWolf();
    expect(spy).toHaveBeenCalledWith("pelt");
    const calls = spy.mock.calls.length;
    game.changed();
    game.forceWolf(); // nothing new to earn
    expect(spy.mock.calls.length).toBe(calls);
  });

  it("re-sends everything already earned on start-up", () => {
    const game = quietGame({ flock: [sheep(4)], owned: { sword: true } });
    game.forceWolf();
    expect(loadEarned()).toContain("pelt");
    const spy = vi.spyOn(platform, "unlockAchievement");
    syncAchievements();
    expect(spy).toHaveBeenCalledWith("pelt");
  });

  it("survives a storefront that throws", () => {
    vi.spyOn(platform, "unlockAchievement").mockImplementation(() => {
      throw new Error("steam is not running");
    });
    const game = quietGame({ flock: [sheep(4)], owned: { sword: true } });
    expect(() => game.forceWolf()).not.toThrow();
    expect(game.state.achievements).toContain("pelt");
  });
});

describe("a cheated run", () => {
  it("starts clean, and an old save without the field is back-filled clean", () => {
    expect(newGame().cheated).toBe(false);
    const old = newGame() as Partial<ReturnType<typeof newGame>>;
    delete old.cheated;
    expect(hydrate(old as ReturnType<typeof newGame>).cheated).toBe(false);
  });

  it("is marked by a code that changes the game, and earns nothing after", () => {
    const game = quietGame({ flock: [sheep(4)], owned: { sword: true } });
    runCheat(findCheat("1680")!, ctx(game));
    expect(game.state.cheated).toBe(true);
    expect(game.state.owned.pelt).toBe(true);
    expect(game.state.achievements).not.toContain("pelt");
    expect(loadEarned()).not.toContain("pelt");
  });

  it("is not marked by cosmetic or pace codes", () => {
    for (const code of ["RETRO", "TOD", "SKELP"]) {
      const game = quietGame();
      runCheat(findCheat(code)!, ctx(game));
      expect(game.state.cheated, code).toBe(false);
    }
  });

  it("is marked by every code that hands over money, beasts, taps, weather or the wolf", () => {
    const marking = CHEATS.filter((c) => c.changesRun).map((c) => c.code).sort();
    expect(marking).toEqual(["1680", "HAAR", "HIRSEL", "LANGDAY", "SILLER"]);
  });

  it("is marked by zen only once zen actually saves a tap", () => {
    const game = quietGame();
    game.zen = true;
    expect(game.state.cheated).toBe(false);
    game.doAction("gather");
    expect(game.state.cheated).toBe(true);
  });
});
