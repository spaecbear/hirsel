import { describe, expect, it } from "vitest";
import { Game, newGame } from "../src/sim/game";
import { BALANCE, BREEDS, CROFT, START_MONEY } from "../src/sim/config";
import { canShear, readyToShear } from "../src/sim/rules";
import {
  TUTORIAL,
  TUTORIAL_START_FLOCK,
  TUTORIAL_TARGET_PAY,
  allowsInteraction,
  currentStep,
  latchDone,
  tutorialSetup,
} from "../src/sim/tutorial";
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
      /*
       * Enough for the ewe, and not a windfall. It cannot be exact at every
       * price: five sheep all left shearable clip at least 20 stone, which is
       * worth more than a ewe when wool is dear, so a few pounds of change is
       * the floor rather than slack.
       */
      expect(paid, `seed ${seed} paid ${paid}`).toBeGreaterThanOrEqual(BREEDS.blackface.cost);
      expect(paid, `seed ${seed} paid ${paid}`).toBeLessThan(BREEDS.blackface.cost + 6);
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
    seen.add("scale");
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
    // entering the house used to go straight to the bed, so a player was shown
    // how to end the day before ever being told what the house is for
    expect(currentStep(g, seen)?.id).toBe("croft-work");
    seen.add("croft-work");
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
    const seen = new Set(["welcome", "shear", "market", "buy", "scale"]);
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

  it("explains that a bigger flock is more work", () => {
    const step = TUTORIAL.find((s) => s.id === "scale")!;
    expect(step.text).toMatch(/two taps/);
    expect(step.text.toLowerCase()).toContain("dog");
    expect(step.text.toLowerCase()).toContain("crook");
  });

  it("teaches how a run ends badly", () => {
    const text = TUTORIAL.map((s) => s.text).join(" ").toLowerCase();
    expect(text).toContain("purse");
    expect(text).toMatch(/lose every last beast|flock is gone/);
  });

  it("gives away no secret and no win condition", () => {
    /*
     * The tutorial is for stopping confusion, not for handing over the story.
     *
     * The croft used to be on this list with everything else, on the grounds
     * that it leads to the ending. That went too far: a player who is never
     * told what the house is for has no goal at all, and entering it jumped
     * straight to "here is how you end the day". Naming the roof, the hearth
     * and the byre is telling someone what their work is for. The ending
     * those pieces add up to — the ring, and who it is for — is the secret,
     * and that stays out.
     */
    const text = TUTORIAL.map((s) => s.text).join(" ").toLowerCase();
    const forbidden = [
      "wolf", "sword", "broadsword", "pelt", "full moon", "corrie",
      "ring", "marry", "married", "wife", "ask her", "win",
    ];
    for (const word of forbidden) {
      // whole words only: "bring it back" is not a mention of the ring
      const re = new RegExp(`\\b${word}\\b`);
      expect(re.test(text), `tutorial must not mention "${word}"`).toBe(false);
    }
  });
});


describe("locking the walkthrough to its lesson", () => {
  const step = (id: string) => TUTORIAL.find((s) => s.id === id)!;

  it("only the thing being taught answers", () => {
    const shear = step("shear");
    expect(allowsInteraction(shear, "flock")).toBe(true);
    // the reported flaw: prompted to shear, you could tap the house and
    // sleep the day away instead, and the lesson never happened
    expect(allowsInteraction(shear, "croft")).toBe(false);
    expect(allowsInteraction(shear, "cart")).toBe(false);
    expect(allowsInteraction(shear, "hills")).toBe(false);
    expect(allowsInteraction(shear, "ground")).toBe(false);
  });

  it("a step you advance by reading is not advanced by poking at the scene", () => {
    const tools = step("tools");
    expect(tools.readOnly).toBe(true);
    expect(allowsInteraction(tools, "cart")).toBe(false);
    const welcome = step("welcome");
    for (const id of ["cart", "flock", "croft", "hills", "ground", "shepherd"]) {
      expect(allowsInteraction(welcome, id), id).toBe(false);
    }
  });

  it("never shuts anybody inside the house", () => {
    for (const s of TUTORIAL) expect(allowsInteraction(s, "door")).toBe(true);
  });

  it("lets someone who stepped back outside get in again for the bed", () => {
    const loss = step("loss");
    expect(loss.target).toBe("interior-bed");
    expect(allowsInteraction(loss, "bed")).toBe(true);
    expect(allowsInteraction(loss, "croft")).toBe(true); // back in through the door
    expect(allowsInteraction(loss, "cart")).toBe(false);
  });

  it("locks nothing once the walkthrough is over", () => {
    for (const id of ["cart", "flock", "croft", "hills", "ground", "shepherd", "sky"]) {
      expect(allowsInteraction(null, id), id).toBe(true);
    }
  });
});

describe("the walkthrough teaches the croft", () => {
  /*
   * It pointed at the house, called it "yours to fix up", and stopped there —
   * so a new player had no idea the croft was what the run is for, nor that
   * paying for a piece of it buys the materials and nothing else. Buy the
   * roof, watch £240 leave the purse and no roof appear, and the only
   * explanation was buried in the cart's own text.
   */
  const step = TUTORIAL.find((s) => s.id === "croft-work")!;

  it("has a step about the work, pointing at the hearth", () => {
    expect(step).toBeDefined();
    expect(step.target).toBe("hearth");
  });

  it("says the money is only the materials, and the work comes after", () => {
    expect(step.text).toMatch(/materials/i);
    expect(step.text).toMatch(/work/i);
  });

  it("is read, not done — the first piece costs six times a first day's purse", () => {
    // £240 for the roof against £40 to your name: there is nothing here a
    // player could be asked to try on day one
    expect(step.readOnly).toBe(true);
    expect(CROFT[0].cost).toBeGreaterThan(START_MONEY * 4);
  });

  it("comes after going inside and before being told to sleep", () => {
    const ids = TUTORIAL.map((s) => s.id);
    expect(ids.indexOf("croft-work")).toBeGreaterThan(ids.indexOf("croft"));
    expect(ids.indexOf("croft-work")).toBeLessThan(ids.indexOf("sleep"));
  });

  it("leaves no step in the walkthrough unreachable", () => {
    /*
     * Walk the whole thing the way a player would and check every step
     * actually surfaces. A step can be defined and never shown — its `done`
     * already true when the walkthrough arrives at it — and nothing else
     * would catch that.
     */
    const g = newGame({ seed: 3 });
    tutorialSetup(g);
    const game = new Game(g);
    game.onAnim = (_a, after) => after?.();
    const seen = new Set<string>();
    const shown: string[] = [];

    for (let i = 0; i < 40; i++) {
      latchDone(g, seen);
      const s = currentStep(g, seen);
      if (!s) break;
      shown.push(s.id);
      // satisfy it however the player would, then retire it
      if (s.id === "flock") game.doAction("gather");
      else if (s.id === "shear") game.doAction("shear");
      else if (s.id === "market") game.doAction("market");
      else if (s.id === "buy") game.buyEwe("blackface");
      else if (s.id === "hills") game.moveTo(1);
      else if (s.id === "loss") game.sleep();
      seen.add(s.id);
    }
    for (const s of TUTORIAL) expect(shown, `step "${s.id}" is never shown`).toContain(s.id);
  });
});
