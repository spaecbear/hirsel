/**
 * The first day.
 *
 * A scripted walk through the things you can touch, with the day's taps
 * switched off so nothing here can cost a new player anything. It teaches the
 * loop, the night, and how a run ends badly.
 *
 * It deliberately teaches nothing about how a run ends *well*. No croft
 * milestones as a goal, no ring, no her, and above all nothing about the
 * sword or what walks the high ground on a full moon. A player should find
 * all of that themselves — the tutorial's job is to stop them being confused,
 * not to hand them the story.
 */
import { BREEDS } from "./config";
import { canShear, here, readyToShear } from "./rules";
import type { GameState } from "./types";
import type { HotspotId } from "../render/layout";

export interface TutorialStep {
  id: string;
  /** what is said */
  text: string;
  /** the thing to point at, if any */
  target?: HotspotId | "interior-bed";
  /** true once the player has done the thing */
  done: (g: GameState, seen: Set<string>) => boolean;
  /** steps that only make sense sometimes (shearing needs ready fleece) */
  skip?: (g: GameState) => boolean;
  /** advanced by tapping "go on" rather than by doing something */
  readOnly?: boolean;
}

/** how much extra is in the purse so the first ewe is effectively free */
export const TUTORIAL_CREDIT = BREEDS.blackface.cost;
export const TUTORIAL_START_FLOCK = 5;

export const TUTORIAL: TutorialStep[] = [
  {
    id: "welcome",
    text: "This is the hill. Five beasts on it, and enough in the purse for a sixth. Today costs you nothing — take your time.",
    readOnly: true,
    done: (_g, seen) => seen.has("welcome"),
  },
  {
    id: "buy",
    text: "Tap the cart. Buying and selling never costs you a tap — only money. Take a ewe to make it six.",
    target: "cart",
    done: (g) => g.flock.length >= 6,
  },
  {
    id: "flock",
    text: "Tap a beast to work the flock. Gather them in close — a gathered flock is far harder for a fox to get at come night.",
    target: "flock",
    done: (g) => g.gatheredToday,
  },
  {
    id: "shear",
    text:
      "Fleece grows every night they graze, and it is worth most between the fourth and ninth day of growth. " +
      "Leave it longer than that and it mats — matted wool fetches next to nothing. " +
      "You cannot shear in rain or haar either, so take it while the weather holds.",
    target: "flock",
    skip: (g) => !canShear(g) || readyToShear(g.flock) === 0,
    done: (g) => g.wool > 0,
  },
  {
    id: "market",
    text: "Wool is only money once it is sold. The cart pays by the stone, and the price moves day to day.",
    target: "cart",
    skip: (g) => g.wool === 0,
    done: (g) => g.stats.earned > 0,
  },
  {
    id: "ground",
    text: "They eat the grass down as they graze. Tap open ground to muck it and bring it back.",
    target: "ground",
    skip: (g) => here(g).grass > 85,
    done: (_g, seen) => seen.has("did-muck"),
  },
  {
    id: "hills",
    text: "Tap the hills to move them. Higher ground feeds better — and foxes are bolder up there. That is the trade.",
    target: "hills",
    done: (g) => g.at !== 0,
  },
  {
    id: "self",
    text: "Tap yourself for the comforts. A pipe, the pipes, a pint at the inn — they cost you a tap, and they are worth it.",
    target: "shepherd",
    done: (_g, seen) => seen.has("did-comfort"),
  },
  {
    id: "tools",
    text: "The cart sells tools as well as beasts. Tools buy the day back — a crook makes gathering free, boots give you another tap. Watch for them.",
    target: "cart",
    readOnly: true,
    done: (_g, seen) => seen.has("tools"),
  },
  {
    id: "croft",
    text: "That is your house. Tap it and go in — it is in a poor state, but it is yours to fix up, and what you buy for it shows up inside.",
    target: "croft",
    done: (_g, seen) => seen.has("went-inside"),
  },
  {
    id: "sleep",
    text: "The bed ends the day. Night is when it all happens: the grass grows, the fleece grows, foxes come, and the feed comes out of your purse.",
    target: "interior-bed",
    readOnly: true,
    done: (_g, seen) => seen.has("sleep-warned"),
  },
  {
    id: "loss",
    text: "Two ways it ends badly: lose every last beast, or let the purse go under. Mind both. Sleep when you are ready — from tomorrow the day is only three taps.",
    target: "interior-bed",
    done: (g) => g.day > 1,
  },
];

/**
 * The first step that still needs doing.
 *
 * A step that has been passed stays passed — `seen` holds its id. Reading the
 * live state alone was not enough: moving the flock clears `gatheredToday`,
 * so walking up the hill sent the walkthrough back to "gather them in" and it
 * looped. Conditions describe *becoming* done, and this remembers that they did.
 */
export function currentStep(g: GameState, seen: Set<string>): TutorialStep | null {
  for (const step of TUTORIAL) {
    if (seen.has(step.id)) continue;
    if (step.skip?.(g)) continue;
    if (step.done(g, seen)) continue;
    return step;
  }
  return null;
}

/**
 * Mark everything up to the current step as passed — including steps that
 * were skipped rather than done.
 *
 * Skipping alone was not enough to retire a step. Shearing skips itself once
 * there is nothing ready to shear, but fleece grows overnight, so the step
 * un-skipped after the first night and the walkthrough reappeared on day two
 * telling the player to shear. Passing a step retires it for good.
 */
export function latchDone(g: GameState, seen: Set<string>) {
  for (const step of TUTORIAL) {
    if (seen.has(step.id)) continue;
    if (step.skip?.(g) || step.done(g, seen)) {
      seen.add(step.id);
      continue;
    }
    return; // the first step still genuinely pending; everything after is ahead of it
  }
}

/** everything the tutorial wants true at the start of the first day */
export function tutorialSetup(g: GameState) {
  g.flock.length = Math.min(g.flock.length, TUTORIAL_START_FLOCK);
  g.money += TUTORIAL_CREDIT;
  // make sure there is something worth shearing, or that step can never run
  let ready = g.flock.filter((s) => s.fleece >= 4).length;
  for (const s of g.flock) {
    if (ready >= 2) break;
    if (s.fleece < 4) {
      s.fleece = 5;
      ready++;
    }
  }
  // and something worth mucking
  g.pastures[0].grass = 62;
  /*
   * A fair first day. Shearing and selling are the whole economy, and with
   * rain or haar rolled for day one the tutorial skipped both of those steps
   * entirely — a new player could finish the walkthrough never having been
   * shown where money comes from. The weather from tomorrow is as random as
   * it ever was.
   */
  g.forecast[0] = "sun";
}
