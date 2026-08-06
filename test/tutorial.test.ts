import { describe, expect, it } from "vitest";
import { TUTORIAL, TUTORIAL_START_FLOCK, TUTORIAL_TARGET_PAY, currentStep, latchDone, tutorialSetup } from "../src/sim/tutorial";
import { Game, newGame } from "../src/sim/game";
import { BALANCE, BREEDS, START_MONEY } from "../src/sim/config";
import { canShear, readyToShear } from "../src/sim/rules";

describe("the first day's setup", () => {
  it("starts a beast short, at the ordinary starting purse — the ewe is earned, not given", () => {
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    expect(g.flock).toHaveLength(TUTORIAL_START_FLOCK);
    expect(TUTORIAL_START_FLOCK).toBe(BALANCE.startFlock - 1);
    expect(g.money).toBe(START_MONEY); // no handout
    expect(TUTORIAL_TARGET_PAY).toBe(BREEDS.blackface.cost);
  });

  it("rigs the first clip to pay for exactly one ewe, whatever was rolled", () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = newGame({ seed });
      tutorialSetup(g);
      expect(canShear(g), `seed ${seed}`).toBe(true);
      expect(readyToShear(g.flock)).toBe(g.flock.length); // none left behind

      // shear and sell exactly as the game would
      const game = new Game(g);
      game.onAnim = (_a, after) => after?.();
      const before = g.money;
      game.doAction("shear");
      game.doAction("market");
      const paid = g.money - before;
      // exactly enough for the ewe, with no change nobody earned
      expect(paid, `seed ${seed} paid ${paid}`).toBe(BREEDS.blackface.cost);
    }
  });

  it("leaves ground worth mucking", () => {
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    expect(g.pastures[0].grass).toBeLessThanOrEqual(BALANCE.muckMaxGrass);
  });
});

describe("the walkthrough", () => {
  it("opens on the welcome and ends after the first night", () => {
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    const seen = new Set<string>();
    expect(currentStep(g, seen)?.id).toBe("welcome");

    // walk it: each step's own condition, in order. Shearing comes before
    // buying, so the sixth ewe is paid for out of the first clip.
    seen.add("welcome");
    expect(currentStep(g, seen)?.id).toBe("flock");
    g.gatheredToday = true;
    expect(currentStep(g, seen)?.id).toBe("shear");
    g.wool = 22;
    expect(currentStep(g, seen)?.id).toBe("market");
    g.stats.earned = 24;
    expect(currentStep(g, seen)?.id).toBe("buy");
    g.flock.push({ id: 99, fleece: 3, breed: "blackface", age: 0 });
    expect(currentStep(g, seen)?.id).toBe("ground");
    seen.add("did-muck");
    expect(currentStep(g, seen)?.id).toBe("hills");
    g.at = 1;
    expect(currentStep(g, seen)?.id).toBe("self");
    seen.add("did-comfort");
    expect(currentStep(g, seen)?.id).toBe("tools");
    seen.add("tools");
    expect(currentStep(g, seen)?.id).toBe("croft");
    seen.add("went-inside");
    expect(currentStep(g, seen)?.id).toBe("sleep");
    seen.add("sleep-warned");
    expect(currentStep(g, seen)?.id).toBe("loss");

    // the night ends it, and it never comes back
    g.day = 2;
    expect(currentStep(g, seen)).toBeNull();
  });

  it("does not rewind when a condition comes undone", () => {
    // moving the flock clears gatheredToday: the walkthrough used to jump
    // back to "gather them in" and loop there for the rest of the day
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    const seen = new Set(["welcome"]);
    g.gatheredToday = true;
    latchDone(g, seen);
    expect(seen.has("flock")).toBe(true);

    g.gatheredToday = false; // as moving pasture does
    latchDone(g, seen);
    expect(currentStep(g, seen)?.id).not.toBe("flock");
  });

  it("retires a skipped step for good, so the night cannot bring it back", () => {
    // fleece grows overnight: the shear step un-skipped itself after the
    // first night and the walkthrough reappeared on day two
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    g.forecast[0] = "rain"; // nothing to be done about shearing today
    const seen = new Set(["welcome"]);
    g.gatheredToday = true;
    g.wool = 0;
    latchDone(g, seen);
    expect(seen.has("shear")).toBe(true);

    // a fine day, with heavy fleece on the hill — it must not come back
    g.forecast[0] = "sun";
    for (const sheep of g.flock) sheep.fleece = 8;
    latchDone(g, seen);
    expect(currentStep(g, seen)?.id).not.toBe("shear");
  });

  it("skips a step that cannot be done rather than stranding the player", () => {
    const g = newGame({ seed: 4 });
    tutorialSetup(g);
    g.forecast[0] = "rain"; // no shearing in this
    const seen = new Set(["welcome", "shear", "market", "buy"]);
    g.gatheredToday = true;
    // shearing is impossible today, so the walkthrough moves on rather than
    // parking the player on a step they cannot complete
    expect(currentStep(g, seen)?.id).toBe("ground");
  });

  it("teaches the fleece value curve, matting, and the weather that blocks shearing", () => {
    const shear = TUTORIAL.find((s) => s.id === "shear")!;
    expect(shear.text).toMatch(/fourth and ninth/);
    expect(shear.text).toMatch(/mats?/);
    expect(shear.text.toLowerCase()).toContain("rain");
    expect(shear.text.toLowerCase()).toContain("haar");
  });

  it("teaches how a run ends badly", () => {
    const text = TUTORIAL.map((s) => s.text).join(" ").toLowerCase();
    expect(text).toContain("purse");
    expect(text).toMatch(/lose every last beast|flock is gone/);
  });

  it("gives away no secret and no win condition", () => {
    // the tutorial is for stopping confusion, not for handing over the story
    const text = TUTORIAL.map((s) => s.text).join(" ").toLowerCase();
    const forbidden = [
      "wolf", "sword", "broadsword", "pelt", "full moon", "corrie",
      "ring", "marry", "married", "wife", "ask her", "win", "croft", "byre", "hearth",
    ];
    for (const word of forbidden) {
      // whole words only: "bring it back" is not a mention of the ring
      const re = new RegExp(`\\b${word}\\b`);
      expect(re.test(text), `tutorial must not mention "${word}"`).toBe(false);
    }
  });
});
