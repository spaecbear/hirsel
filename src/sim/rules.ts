/**
 * Pure rules. No state mutation, no DOM, no randomness.
 * Everything here is directly testable and is what the Vitest suite pins down.
 */
import {
  BALANCE,
  DIFFICULTY,
  BREEDS,
  FULL_MOON_PHASE,
  MOON_CYCLE,
  MOON_NAMES,
  SEASON_DAYS,
  SEASON_ORDER,
  SEASONS,
  WEATHER,
} from "./config";
import type { DogKind, GameState, Season, Sheep, WeatherId } from "./types";

/* ---------- moon ---------- */
export const moonPhase = (day: number) => (day - 1) % MOON_CYCLE;
export const moonName = (day: number) => MOON_NAMES[moonPhase(day)];
export const isFullMoon = (day: number) => moonPhase(day) === FULL_MOON_PHASE;

/**
 * How many the hill is feeding. A lamb is mostly on its mother until it is
 * grown, so it counts for `lambEats` of a beast at the grass, in the barn and
 * on the feed bill. Every head still counts for the fox and the gathering.
 */
export const mouths = (g: GameState) =>
  g.flock.reduce((n, s) => n + (s.lamb ? BALANCE.lambEats : 1), 0);

/* ---------- the year ---------- */

export interface SeasonAt extends Season {
  /** 1 on the first day of the season */
  day: number;
  /** days left in it after this one */
  left: number;
  /** 1 in the first year */
  year: number;
}

/**
 * The season is the day, and nothing else — no state, so it cannot drift, a
 * save cannot disagree with it, and the forecast can ask about a day that has
 * not come yet.
 */
export function seasonOf(day: number): SeasonAt {
  const i = Math.floor((day - 1) / SEASON_DAYS);
  const s = SEASONS[SEASON_ORDER[i % SEASON_ORDER.length]];
  const dayIn = ((day - 1) % SEASON_DAYS) + 1;
  return { ...s, day: dayIn, left: SEASON_DAYS - dayIn, year: Math.floor(i / SEASON_ORDER.length) + 1 };
}

export const season = (g: GameState) => seasonOf(g.day);
export const isWinter = (g: GameState) => season(g).id === "winter";

/** the season after the one a day falls in */
export function nextSeason(day: number): Season {
  const i = SEASON_ORDER.indexOf(seasonOf(day).id);
  return SEASONS[SEASON_ORDER[(i + 1) % SEASON_ORDER.length]];
}

/** a night of snow with the byre built: they are brought in */
export const housed = (g: GameState) => g.forecast[0] === "snow" && owns(g, "byre");

/* ---------- hay ---------- */

/** what one night's hay is for this flock, if the ground gave them nothing */
export function hayPerNight(g: GameState): number {
  const want = mouths(g) * BALANCE.grazePerSheep * (owns(g, "saltlick") ? BALANCE.saltlickGraze : 1);
  return want / BALANCE.hayGrass;
}

/** how many nights the barn would feed them outright */
export function hayNights(g: GameState): number {
  const per = hayPerNight(g);
  return per === 0 ? Infinity : Math.floor(g.hay / per);
}

/**
 * About what a winter asks of the barn for this flock. Not all of it: the
 * pastures go in with grass on them and only the snow buries it all, so three
 * quarters of the winter's feed is a fair mark to aim for.
 */
export function hayNeeded(g: GameState): number {
  const nights = isWinter(g) ? season(g).left + 1 : SEASON_DAYS;
  return Math.ceil(hayPerNight(g) * nights * 0.75);
}

/** what a lot of hay costs at the cart today */
export const hayLotCost = (g: GameState) => (isWinter(g) ? BALANCE.hayLotCostWinter : BALANCE.hayLotCost);

/* ---------- lambing ---------- */

export const lambsOf = (g: GameState) => g.flock.filter((s) => s.lamb);
export const inLambCount = (g: GameState) => g.flock.filter((s) => s.inLamb).length;
/** the lambing is on: the first days of spring */
export const lambingOn = (g: GameState) => season(g).id === "spring" && season(g).day <= BALANCE.lambingDays;

/** what a lamb fetches today: half a grown beast, and half as much again at the autumn sales */
export function lambPrice(g: GameState, s: Sheep): number {
  const autumn = season(g).id === "autumn" ? BALANCE.lambPriceAutumn : 1;
  return Math.max(1, Math.round(BREEDS[s.breed].cost * BALANCE.lambPrice * autumn));
}

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
export function priceOn(day: number, mult = 1): number {
  const base = BALANCE.marketBase + Math.sin(day * 1.7) * Math.cos(day * 0.6) * BALANCE.marketSwing;
  return Math.round(base * mult);
}

/** what a stone fetches today, on the scale this run is being played at, in this season */
export const woolPrice = (g: GameState) => priceOn(g.day, DIFFICULTY[g.difficulty].price * season(g).price);

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
  return Math.ceil(mouths(g) / BALANCE.sheepPerPound);
}

/* ---------- what the work costs ---------- */

/**
 * Shearing a big flock takes longer than shearing a small one. Blade shears
 * stretch how many you get through in a tap, and the total is capped so a
 * day can always contain one clip.
 */
export function shearCost(g: GameState): number {
  const per = owns(g, "shears") ? BALANCE.shearPerTapWithShears : BALANCE.shearPerTap;
  const need = Math.ceil(Math.max(1, g.flock.length) / per);
  return Math.max(1, Math.min(BALANCE.shearMaxTaps, need));
}

/**
 * Gathering a big flock takes two taps on your own. A dog does the running,
 * and the crook takes a tap off whatever it would otherwise cost — so with
 * both, gathering even a large flock is still free.
 */
export function gatherCost(g: GameState): number {
  const big = g.flock.length > BALANCE.bigFlock && !hasDog(g);
  return Math.max(0, (big ? 2 : 1) - (owns(g, "crook") ? 1 : 0));
}

/* ---------- night maths ---------- */
export function grazing(g: GameState) {
  const p = here(g);
  // the salt lick makes them work the ground less hard for the same fleece
  const want = mouths(g) * BALANCE.grazePerSheep * (owns(g, "saltlick") ? BALANCE.saltlickGraze : 1);
  // under snow, or in the byre, there is no grass to be had at all
  const reachable = g.forecast[0] === "snow" ? 0 : p.grass;
  const eaten = Math.min(reachable, want);
  // in winter the barn makes up what the ground cannot, a whole bale at a time
  let hayUsed = 0;
  if (isWinter(g) && eaten < want && g.hay > 0) {
    hayUsed = Math.min(g.hay, Math.ceil((want - eaten) / BALANCE.hayGrass));
  }
  const fed = want === 0 ? 1 : Math.min(1, (eaten + hayUsed * BALANCE.hayGrass) / want);
  const growth =
    fed *
    season(g).growth *
    p.quality *
    // the collie keeps them moving over the ground rather than standing
    (owns(g, "collie") ? 1 + (BALANCE.collieGraze - 1) * dogStrength(g) : 1) *
    weatherOn(g).graze *
    (buffed(g, "settled flock") ? BALANCE.settledGrowth : 1) *
    (buffed(g, "fiddled") ? BALANCE.fiddleGrowth : 1) *
    (buffed(g, "tended") ? BALANCE.tendedGrowth : 1);
  return { eaten, hayUsed, fed, growth };
}

/** whichever dog is on the hill, or none */
export const hasDog = (g: GameState) => owns(g, "dog") || owns(g, "collie");
export const workingDog = (g: GameState): DogKind | null =>
  owns(g, "dog") ? "dog" : owns(g, "collie") ? "collie" : null;

/** a year of work and she is getting on */
export const dogIsOld = (g: GameState) => hasDog(g) && g.dogDays >= BALANCE.dogOldDays;
/** how much of her worth is left in her: all of it in her prime, half once she is old */
export const dogStrength = (g: GameState) => (dogIsOld(g) ? BALANCE.oldDogStrength : 1);
/** nights of work left before she retires */
export const dogDaysLeft = (g: GameState) => (hasDog(g) ? Math.max(0, BALANCE.dogRetireDays - g.dogDays) : 0);

/** what she is worth against a fox: the sheltie is the better deterrent, and age takes some of it */
export function dogFoxBias(g: GameState): number {
  const base = owns(g, "dog") ? BALANCE.dogFoxBias : owns(g, "collie") ? BALANCE.collieFoxBias : 1;
  return 1 - (1 - base) * dogStrength(g);
}

/** what the retired dogs by the fire still do: an ear out at night */
export const retiredFoxBias = (g: GameState) =>
  Math.pow(BALANCE.retiredFoxBias, Math.min(BALANCE.retiredCounted, g.retiredDogs.length));

export function foxRisk(g: GameState): number {
  // in the byre on a night of snow: nothing gets at them
  if (housed(g)) return 0;
  if (owns(g, "pelt")) return BALANCE.peltFoxRisk;
  let risk = here(g).risk * weatherOn(g).foxBias * season(g).foxBias;
  // more beasts than one man can keep an eye on, or few enough to watch
  const scale = g.flock.length / BALANCE.foxFlockPivot;
  risk *= Math.max(BALANCE.foxFlockMin, Math.min(BALANCE.foxFlockMax, scale));
  risk *= DIFFICULTY[g.difficulty].fox;
  if (g.gatheredToday) risk *= BALANCE.gatheredFoxBias;
  risk *= dogFoxBias(g);
  risk *= retiredFoxBias(g);
  if (buffed(g, "settled flock")) risk *= BALANCE.settledFoxBias;
  return risk;
}

export function flystrikeExposed(g: GameState): Sheep | null {
  // flies want warmth: there are none in winter
  if (season(g).strike === 0) return null;
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
