import type { GameState } from "./types";
import { owns } from "./rules";

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  /** hidden ones give nothing away until earned — the wolf must stay a secret */
  secret?: boolean;
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
  { id: "thirty", name: "A season on", hint: "Reach day 30.", won: (g) => g.day >= 30 },
  { id: "hundred-days", name: "Still here", hint: "Reach day 100.", won: (g) => g.day >= 100 },
  { id: "clean", name: "No fox got in", hint: "Reach day 20 without losing a sheep to a fox.", won: (g) => g.day >= 20 && g.stats.foxLosses === 0 },
  { id: "aye", name: "She said aye", hint: "Finish the croft and ask her.", won: (g) => g.over?.kind === "win" },
  { id: "pelt", name: "The last one", hint: "—", secret: true, won: (g) => owns(g, "pelt") },
  { id: "mauled", name: "Caught out late", hint: "—", secret: true, won: (g) => g.stats.wolfMaulings > 0 },
];

const KEY = "hirsel.achievements.v1";

export function loadEarned(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveEarned(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode, or storage full — achievements are not worth throwing over */
  }
}

export function clearEarned() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** returns the ones newly earned by this check */
export function checkAchievements(g: GameState): Achievement[] {
  const earned = new Set(g.achievements);
  const fresh = ACHIEVEMENTS.filter((a) => !earned.has(a.id) && a.won(g));
  if (fresh.length) {
    g.achievements = [...g.achievements, ...fresh.map((a) => a.id)];
    const all = new Set([...loadEarned(), ...g.achievements]);
    saveEarned([...all]);
  }
  return fresh;
}
