/**
 * Pure rules. No state mutation, no DOM, no randomness.
 * Everything here is directly testable and is what the Vitest suite pins down.
 */
import { BALANCE, BREEDS, FULL_MOON_PHASE, MOON_CYCLE, MOON_NAMES, WEATHER } from "./config";
import type { GameState, Sheep, WeatherId } from "./types";

/* ---------- moon ---------- */
export const moonPhase = (day: number) => (day - 1) % MOON_CYCLE;
export const moonName = (day: number) => MOON_NAMES[moonPhase(day)];
export const isFullMoon = (day: number) => moonPhase(day) === FULL_MOON_PHASE;

/* ---------- wool ---------- */
export type Grade = { v: number; label: "bare" | "short" | "prime" | "heavy" | "matted" };

/** climbs to a peak around nine days of growth, then mats and rots */
export function grade(fleece: number): Grade {
  if (fleece <= 0) return { v: 0, label: "bare" };
  if (fleece < 4) return { v: fleece * 0.5, label: "short" };
  if (fleece < 9) return { v: fleece * 1.0, label: "prime" };
  if (fleece < 12) return { v: 9 - (fleece - 9) * 1.2, label: "heavy" };
  return { v: Math.max(1, 5.4 - (fleece - 12) * 1.1), label: "matted" };
}

export const breedOf = (s: Sheep) => BREEDS[s.breed] ?? BREEDS.blackface;
export const sheepValue = (s: Sheep) => grade(s.fleece).v * breedOf(s).value;
export const flockValue = (flock: Sheep[]) => flock.reduce((a, s) => a + sheepValue(s), 0);
export const readyToShear = (flock: Sheep[]) =>
  flock.filter((s) => s.fleece >= BALANCE.shearMinFleece).length;

/* ---------- market ---------- */
/** stable within a day, so holding wool is a real choice */
export function priceOn(day: number): number {
  return Math.round(BALANCE.marketBase + Math.sin(day * 1.7) * Math.cos(day * 0.6) * BALANCE.marketSwing);
}

/* ---------- state readers ---------- */
export const owns = (g: GameState, id: string) => !!g.owned[id as keyof typeof g.owned];
export const buffed = (g: GameState, id: string) => (g.buffs[id as keyof typeof g.buffs] ?? 0) > 0;
export const weatherOn = (g: GameState, offset = 0) => WEATHER[g.forecast[offset] as WeatherId];
export const here = (g: GameState) => g.pastures[g.at];

export function tapsPerDay(g: GameState): number {
  const t =
    BALANCE.baseTaps + (owns(g, "boots") ? 1 : 0) + (owns(g, "lamp") ? 1 : 0) + (buffed(g, "hale") ? 1 : 0);
  return Math.min(BALANCE.maxTaps, t);
}

export function feedCost(g: GameState): number {
  return Math.ceil(g.flock.length / 2);
}

/* ---------- night maths ---------- */
export function grazing(g: GameState) {
  const p = here(g);
  // the salt lick makes them work the ground less hard for the same fleece
  const want = g.flock.length * BALANCE.grazePerSheep * (owns(g, "saltlick") ? BALANCE.saltlickGraze : 1);
  const eaten = Math.min(p.grass, want);
  const fed = want === 0 ? 1 : eaten / want;
  const growth =
    fed *
    p.quality *
    weatherOn(g).graze *
    (buffed(g, "settled flock") ? BALANCE.settledGrowth : 1) *
    (buffed(g, "tended") ? BALANCE.tendedGrowth : 1);
  return { eaten, fed, growth };
}

export function foxRisk(g: GameState): number {
  if (owns(g, "pelt")) return BALANCE.peltFoxRisk;
  let risk = here(g).risk * weatherOn(g).foxBias;
  if (g.gatheredToday) risk *= BALANCE.gatheredFoxBias;
  if (owns(g, "dog")) risk *= BALANCE.dogFoxBias;
  if (buffed(g, "settled flock")) risk *= BALANCE.settledFoxBias;
  return risk;
}

export function flystrikeExposed(g: GameState): Sheep | null {
  if (buffed(g, "tended")) return null;
  if (g.forecast[0] === "rain") return null;
  const heavy = g.flock.filter((s) => s.fleece >= BALANCE.flystrikeFleece);
  if (!heavy.length) return null;
  return heavy.reduce((a, b) => (b.fleece > a.fleece ? b : a));
}

/** rain is rain, but an oilskin will get you through a haar */
export function canShear(g: GameState): boolean {
  const w = weatherOn(g);
  return w.shear || (w.id === "mist" && owns(g, "oilskin"));
}

/* ---------- the last wolf ---------- */
/** crook, boots, the high ground, a full moon, and a day worked dark to dark */
export function wolfSummoned(g: GameState): boolean {
  if (owns(g, "pelt")) return false;
  if (!(owns(g, "boots") && owns(g, "crook"))) return false;
  if (g.at !== 2) return false;
  if (!isFullMoon(g.day)) return false;
  if (g.actsToday < BALANCE.wolfActionsNeeded) return false;
  return g.flock.length > 0;
}

/** the second warning — one tap still in hand, so escape is possible */
export function wolfWarningDue(g: GameState): boolean {
  return (
    !owns(g, "pelt") &&
    isFullMoon(g.day) &&
    g.at === 2 &&
    g.actsToday === BALANCE.wolfWarnOnAction &&
    owns(g, "boots") &&
    owns(g, "crook")
  );
}
