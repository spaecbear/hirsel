/**
 * Every tuned number in the game, in one place.
 *
 * The spec's §14 open questions are NOT silently resolved — each one is a flag
 * here, set to the prototype's shipped behaviour, with a note saying what the
 * question actually is. Change the flag, don't hunt for a magic number.
 */
import type { Breed, BreedId, Weather, WeatherId } from "./types";

/**
 * Starting money. The £1000 test purse of §13 is gone — testing is done with
 * the SILLER cheat now, which keeps one code path instead of two.
 * This is open question §14.1: if the crook takes more than ~15 days to
 * reach, raise this rather than handing out taps.
 */
export const START_MONEY = 40;

export const BALANCE = {
  startFlock: 6,
  startFleeceMin: 2,
  startFleeceMax: 5,
  baseTaps: 3,
  maxTaps: 6,

  grazePerSheep: 4,
  hungryBelow: 0.6,

  muckGain: 38,
  muckMaxGrass: 85,

  pintCost: 8,
  pubsToAsk: 6,

  feedPerTwoSheep: 1,

  shearMinFleece: 4,
  shearsBonus: 1.2,
  steadyHandsBonus: 1.15,
  settledGrowth: 1.15,
  settledFoxBias: 0.85,
  tendedGrowth: 1.1,
  tendDays: 3,
  cozyBuffDays: 2,
  haleDays: 3,

  gatheredFoxBias: 0.35,
  dogFoxBias: 0.6,
  peltFoxRisk: 0.01,

  flystrikeFleece: 11,
  flystrikeChance: 0.3,

  regenRain: 2.2,
  regenSun: 1.2,

  /** salt lick: they eat less of the hill for the same growth */
  saltlickGraze: 0.75,

  marketBase: 62,
  marketSwing: 32,

  wolfActionsNeeded: 5,
  wolfWarnOnAction: 4,
} as const;

/**
 * §14 open questions. All left at prototype behaviour. Flip and playtest.
 */
export const OPEN_QUESTIONS = {
  /** (1) opening difficulty — raise starting money, never taps, if the crook takes >15 days */
  startMoney: START_MONEY,
  /** (3) one ewe after a mauling may be unrecoverable. Set to 2 to soften. */
  survivorsAfterWolf: 1,
  /** (9) cap the watch's routine at 3–4 turns if players sleep-skip whole days. 0 = uncapped */
  routineTurnCap: 0,
} as const;

export const MOON_NAMES = [
  "New",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
] as const;

export const MOON_CYCLE = 8;
export const FULL_MOON_PHASE = 4;

export const WEATHER: Record<WeatherId, Weather> = {
  sun: { id: "sun", name: "Sun", graze: 1.4, shear: true, foxBias: 0.9, sky: "#4b6b7a", light: "#c9b98a" },
  overcast: { id: "overcast", name: "Overcast", graze: 1.0, shear: true, foxBias: 1.45, sky: "#3a4046", light: "#8f9088" },
  rain: { id: "rain", name: "Rain", graze: 0.7, shear: false, foxBias: 1.0, sky: "#2b3239", light: "#6f7a80" },
  mist: { id: "mist", name: "Haar", graze: 0.9, shear: false, foxBias: 1.7, sky: "#454b4a", light: "#8a8f88" },
};

/** draw weights: sun 2, overcast 2, rain 2, haar 1 */
export const WEATHER_BAG: WeatherId[] = ["sun", "sun", "overcast", "overcast", "rain", "rain", "mist"];

export const BREEDS: Record<BreedId, Breed> = {
  blackface: {
    id: "blackface",
    name: "Scottish Blackface",
    cost: 24,
    growth: 1.0,
    value: 1.0,
    wool: "#ddd9c8",
    face: "#2b2b26",
    note: "Hardy hill sheep. Coarse fleece, but she'll thrive on ground that beats the others.",
  },
  cheviot: {
    id: "cheviot",
    name: "Cheviot",
    cost: 38,
    growth: 1.2,
    value: 1.05,
    wool: "#e7e3d2",
    face: "#cfc7ae",
    note: "Grows fleece fast. Wants decent grazing to do it.",
  },
  hebridean: {
    id: "hebridean",
    name: "Hebridean",
    cost: 34,
    growth: 0.85,
    value: 1.4,
    wool: "#4a4640",
    face: "#26241f",
    note: "Small and black. Little wool, but it fetches a price.",
  },
  shetland: {
    id: "shetland",
    name: "Shetland",
    cost: 54,
    growth: 1.05,
    value: 1.6,
    wool: "#cdbfa4",
    face: "#5b4c3a",
    note: "The finest fleece in Scotland. Worth more than she looks.",
  },
};

export const PASTURES = [
  { name: "Low Field", grass: 100, cap: 100, quality: 0.8, risk: 0.1, regen: 5 },
  { name: "Hill Slope", grass: 100, cap: 100, quality: 1.0, risk: 0.2, regen: 4 },
  { name: "High Corrie", grass: 100, cap: 100, quality: 1.35, risk: 0.34, regen: 3 },
] as const;

export const TOOLS = [
  { id: "crook", name: "Shepherd's crook", cost: 18, what: "Gathering costs no tap." },
  { id: "shears", name: "Blade shears", cost: 32, what: "Every fleece comes off a fifth heavier." },
  { id: "boots", name: "Stout boots", cost: 26, what: "One more tap every day." },
  { id: "dog", name: "Shetland sheepdog", cost: 58, what: "Works the flock in on her own each night. Foxes think twice." },
  { id: "cart", name: "Pony and cart", cost: 74, what: "Market costs no tap." },
  { id: "saltlick", name: "Salt lick", cost: 28, what: "Set it on the hill and they take a quarter less grass for the same growth." },
  { id: "oilskin", name: "Waxed oilskin", cost: 36, what: "You can shear through a haar in this. Rain is still rain." },
  { id: "lamp", name: "Storm lantern", cost: 44, what: "One more tap every day. The evening stretches." },
  // §7: gives nothing away. Do not explain it anywhere in the UI.
  { id: "sword", name: "Highland broadsword", cost: 185, what: "Hangs well above the fire. Bonny thing. Not much use for keeping foxes off, mind." },
  { id: "watch", name: "Brass pocket watch", cost: 165, what: "Set a day's work to it once and it will keep that day for you after." },
] as const;

export const CROFT = [
  { id: "roof", name: "Slate the cottage roof", cost: 240, need: null, what: "The thatch has been letting water since before you came." },
  { id: "hearth", name: "Build up the hearth", cost: 330, need: "roof", what: "A proper fire, a settle, a place that is not just shelter." },
  { id: "byre", name: "Raise a stone byre", cost: 420, need: "hearth", what: "Somewhere to bring them in out of the worst of it." },
  { id: "ring", name: "A silver ring, Inverness", cost: 520, need: "byre", what: "You have known for a while now. You just had nothing to offer." },
] as const;

export const ANIM_MS: Record<string, number> = {
  gather: 1400,
  shear: 1600,
  market: 1900,
  pipe: 2200,
  music: 2000,
  pub: 2600,
  move: 1200,
  sleep: 2400,
  tend: 1700,
  muck: 1600,
  buysheep: 1200,
  fox: 2200,
  wolf: 6000,
  wolflost: 5000,
};
