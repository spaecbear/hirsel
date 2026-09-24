import type { GameState } from "./types";
import { owns } from "./rules";
import { SEASON_DAYS } from "./config";
import { platform } from "../platform";

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  /** hidden ones give nothing away until earned — the wolf must stay a secret */
  secret?: boolean;
  /**
   * Only to be had by staying on the hill after the win. Left out of what the
   * credits ask for — they roll at the moment of a win, before any of these
   * can have happened.
   */
  longGame?: boolean;
  won: (g: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-pound", name: "First silver", hint: "Sell wool at market.", won: (g) => g.stats.earned > 0 },
  { id: "crook", name: "A hand free", hint: "Buy the shepherd's crook.", won: (g) => owns(g, "crook") },
  { id: "collie", name: "Good lass", hint: "Take on the sheepdog.", won: (g) => owns(g, "dog") },
  { id: "ten-strong", name: "Ten on the hill", hint: "Keep ten sheep at once.", won: (g) => g.flock.length >= 10 },
  { id: "twenty-strong", name: "A proper hirsel", hint: "Keep twenty sheep at once.", won: (g) => g.flock.length >= 20 },
  { id: "prime", name: "Prime clip", hint: "Sell 40 stone of wool in a run.", won: (g) => g.stats.woolSold >= 40 },
  { id: "hundred", name: "A hundred pound", hint: "Earn £100 from wool in a run.", won: (g) => g.stats.earned >= 100 },
  { id: "roof", name: "Dry at last", hint: "Slate the cottage roof.", won: (g) => owns(g, "roof") },
  { id: "hearth", name: "A fire in it", hint: "Build up the hearth.", won: (g) => owns(g, "hearth") },
  { id: "byre", name: "Somewhere to put them", hint: "Raise the stone byre.", won: (g) => owns(g, "byre") },
  { id: "ring", name: "In your coat pocket", hint: "Buy the ring in Inverness.", won: (g) => owns(g, "ring") },
  { id: "local", name: "Kent face", hint: "Six evenings at the inn.", won: (g) => g.pubs >= 6 },
  { id: "thirty", name: "A month on the hill", hint: "Reach day 30.", won: (g) => g.day >= 30 },
  { id: "hundred-days", name: "Still here", hint: "Reach day 100.", won: (g) => g.day >= 100 },
  { id: "made-hay", name: "Made hay", hint: "Cut hay while the sun shone.", won: (g) => g.stats.hayInSun },
  {
    id: "first-winter",
    name: "Through the winter",
    hint: "See the flock through a winter to the spring.",
    // the first day of the second spring, with anything still on the hill
    won: (g) => g.day > SEASON_DAYS * 4 && g.flock.length > 0,
  },
  {
    id: "first-lamb",
    name: "On its feet",
    hint: "A lamb born on your own ground, and alive in the morning.",
    won: (g) => g.stats.lambsBorn > 0,
  },
  {
    id: "year-wed",
    name: "A year wed",
    hint: "Stay on the hill with her, and see a year out.",
    longGame: true,
    won: (g) => g.married !== null && g.day - g.married >= SEASON_DAYS * 4,
  },
  { id: "fifty-lambs", name: "Fifty lambs", hint: "Fifty lambs born on your own ground.", longGame: true, won: (g) => g.stats.lambsBorn >= 50 },
  { id: "rosette", name: "A red rosette", hint: "Take a prize at the Highland show, or the trial.", won: (g) => g.stats.rosettes > 0 },
  { id: "neighbour", name: "Good neighbours", hint: "Have a kindness paid back from over the burn.", won: (g) => g.stats.neighbourGifts > 0 },
  {
    id: "old-dog",
    name: "Earned the fire",
    hint: "See a dog through her working life to the fireside.",
    won: (g) => g.retiredDogs.length > 0,
  },
  { id: "clean", name: "No fox got in", hint: "Reach day 20 without losing a sheep to a fox.", won: (g) => g.day >= 20 && g.stats.foxLosses === 0 },
  { id: "aye", name: "She said aye", hint: "Finish the croft and ask her.", won: (g) => g.over?.kind === "win" },
  // hidden: the hint is only ever read by someone who has already been there
  /*
   * Two dogs I knew. Tippy was a border collie who lay in front of the fire
   * every time it was lit; Arrow was a sheltie who spun in circles whenever
   * she was pleased to see you. Both are in the game now, and both of these
   * are found the way you would find them in life — by having the dog, and
   * noticing what she does.
   */
  {
    id: "tippy",
    name: "Tippy",
    hint: "The collie found the warmest spot in the house before you did.",
    secret: true,
    won: (g) => g.stats.sawTippy,
  },
  {
    id: "arrow",
    name: "Arrow",
    hint: "Twice round by the fire, because you came back.",
    secret: true,
    won: (g) => g.stats.spunTwice,
  },
  {
    id: "pelt",
    name: "The last wolf in Scotland",
    hint: "You had the reach of him. He is on your back now.",
    secret: true,
    won: (g) => owns(g, "pelt"),
  },
  {
    id: "mauled",
    name: "Caught out late",
    hint: "The high ground was no place to be, and you were told.",
    secret: true,
    won: (g) => g.stats.wolfMaulings > 0,
  },
];

const KEY = "hirsel.achievements.v1";

export function loadEarned(): string[] {
  try {
    const raw = platform.read(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveEarned(ids: string[]) {
  try {
    platform.write(KEY, JSON.stringify(ids));
  } catch {
    /* private mode, or storage full — achievements are not worth throwing over */
  }
}

export function clearEarned() {
  try {
    platform.remove(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Returns the ones newly earned by this check.
 *
 * A run that has used a code that changes the game earns nothing — money,
 * beasts or a wolf on demand would otherwise hand over the croft and the pelt.
 * Cosmetic codes (RETRO, TOD) and pace (SKELP) never mark a run.
 */
export function checkAchievements(g: GameState): Achievement[] {
  if (g.cheated) return [];
  const earned = new Set(g.achievements);
  const fresh = ACHIEVEMENTS.filter((a) => !earned.has(a.id) && a.won(g));
  if (fresh.length) {
    g.achievements = [...g.achievements, ...fresh.map((a) => a.id)];
    const all = new Set([...loadEarned(), ...g.achievements]);
    saveEarned([...all]);
    for (const a of fresh) unlock(a.id);
  }
  return fresh;
}

function unlock(id: string) {
  try {
    platform.unlockAchievement(id);
  } catch {
    /* the storefront being unavailable is never worth interrupting play for */
  }
}

/**
 * Tell the storefront about everything already earned. Run at start-up: it
 * covers achievements won while the storefront was not running, and ones won
 * in the web build before an export was brought across.
 */
export function syncAchievements() {
  for (const id of loadEarned()) unlock(id);
}
