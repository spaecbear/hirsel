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
import { canShear, here, priceOn, readyToShear } from "./rules";
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

export const TUTORIAL_START_FLOCK = 5;

/**
 * The first clip is rigged to pay for the sixth ewe exactly.
 *
 * Being handed the money taught nothing; earning it in the first three steps
 * teaches the whole economy — fleece becomes wool, wool becomes money, money
 * becomes another beast — before anything is asked of the player. The fleece
 * is set so the clip comes to `TUTORIAL_WOOL` stone, and day one's price is
 * fixed by `priceOn(1)`, so the sale always lands on the cost of a Blackface.
 */
export const TUTORIAL_TARGET_PAY = BREEDS.blackface.cost;

export const TUTORIAL: TutorialStep[] = [
  {
    id: "welcome",
    text: "This is the hill. Five beasts on it and forty pounds to your name. Today costs you nothing — take your time.",
    readOnly: true,
    done: (_g, seen) => seen.has("welcome"),
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
      "Now shear them. Fleece grows every night they graze and is worth most between the fourth and ninth day of growth — " +
      "leave it longer and it mats, and matted wool fetches next to nothing. You cannot shear in rain or haar either, " +
      "so take it while the weather holds.",
    target: "flock",
    // day one is forced fair, but never park a player on a step the weather
    // or an empty hill has made impossible
    skip: (g) => !canShear(g) || readyToShear(g.flock) === 0,
    done: (g) => g.wool > 0,
  },
  {
    id: "market",
    text: "Wool is only money once it is sold. Take it to the cart — the price moves day to day, so it can be worth holding on.",
    target: "cart",
    skip: (g) => g.wool === 0 && g.stats.earned === 0,
    done: (g) => g.stats.earned > 0,
  },
  {
    id: "buy",
    text: "That clip paid for a ewe. Buy one from the cart to make it six — buying and selling never costs you a tap, only money.",
    target: "cart",
    done: (g) => g.flock.length >= 6,
  },
  {
    id: "scale",
    text:
      "Mind that a bigger flock is more work, not just more wool. Past ten beasts a clip takes two taps, " +
      "and past a dozen you cannot gather them alone in one — a dog does the running, and a crook takes a tap off either way.",
    readOnly: true,
    done: (_g, seen) => seen.has("scale"),
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

/**
 * What the player may touch while a step is running.
 *
 * Without this the walkthrough could be walked straight past: prompted to
 * shear, you could tap the house instead, sleep the day away, and the lesson
 * never happened. Only the thing being taught answers.
 *
 * Two things are always allowed. The door, so nobody is ever shut inside the
 * house; and the house itself when the lesson is about the bed, so someone
 * who stepped back outside can get in again.
 */
export function allowsInteraction(step: TutorialStep | null, id: string): boolean {
  if (!step) return true;
  if (id === "door") return true;
  const target = step.target;
  if (!target) return false; // nothing to point at: read it and press Go on
  if (target === "interior-bed") return id === "bed" || id === "croft";
  // a step you advance by reading is not advanced by poking at the scene
  if (step.readOnly) return false;
  return id === target;
}

/** everything the tutorial wants true at the start of the first day */
export function tutorialSetup(g: GameState) {
  g.flock.length = Math.min(g.flock.length, TUTORIAL_START_FLOCK);

  /*
   * Work backwards from the price of a ewe to the fleece on the hill: how
   * many stone must be sold at day one's price to clear it, then spread that
   * across the flock in the "prime" band, where a fleece is worth its own
   * number. Every beast is left shearable so none of it is left behind.
   */
  const price = priceOn(g.day);
  /*
   * The smallest clip that still clears the price of a ewe. It cannot always
   * be exact: every beast has to be left shearable, the minimum shearable
   * fleece is 4, so five sheep cannot clip less than 20 stone — worth rather
   * more than a ewe at a good price. A pound or two of change is the floor,
   * not slack in the rig.
   */
  let stone = Math.max(1, Math.round((TUTORIAL_TARGET_PAY * 100) / price));
  while (Math.round((stone * price) / 100) < TUTORIAL_TARGET_PAY) stone++;
  const each = Math.floor(stone / g.flock.length);
  let left = stone - each * g.flock.length;
  for (const s of g.flock) {
    // 4 is the minimum shearable, 8 the top of the prime band
    s.fleece = Math.min(8, Math.max(4, each + (left-- > 0 ? 1 : 0)));
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
