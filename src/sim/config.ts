/**
 * Every tuned number in the game, in one place.
 *
 * The spec's §14 open questions are NOT silently resolved — each one is a flag
 * here, set to the prototype's shipped behaviour, with a note saying what the
 * question actually is. Change the flag, don't hunt for a magic number.
 */
import type { Breed, BreedId, Difficulty, Weather, WeatherId } from "./types";

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

  /**
   * The nightly feed bill is `ceil(flock / sheepPerPound)`. It was hard-coded
   * to 2 in rules.ts while this number sat unused, which made the single most
   * important figure in the economy invisible to tuning.
   */
  sheepPerPound: 3,

  /*
   * Work scales with the flock.
   *
   * Measured across 25 seeded runs, only about one tap a day had genuinely
   * productive work in it — 64% spare on day one with no tools at all, and
   * 89% spare once the kit was in. The day is gated by fleece growth, not by
   * taps, so four days in five held nothing but gathering and the spare taps
   * went to the same filler every time.
   *
   * Scaling the work turns flock growth from pure upside into a real
   * decision, and it is the game's own fiction: a hirsel is the ground one
   * shepherd and one dog can work.
   */
  shearPerTap: 10,
  shearPerTapWithShears: 14,
  /** never so many that a day cannot contain one clip */
  shearMaxTaps: 3,
  /** past this, a flock needs two taps to gather — unless a dog does the running */
  bigFlock: 12,

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
  /*
   * A fox takes one sheep a night whatever the size of the flock, so the
   * risk was flat while its cost was not: losing one of six is ruinous and
   * losing one of twenty is a Tuesday. Measured, a six-sheep flock bled
   * value faster than it earned it — about £180 of losses against £114 of
   * wool over ninety days — so a run could never climb out of its start,
   * and every measured run decayed to two or three beasts.
   *
   * Risk now scales with how many there are to watch, pivoting on the size
   * the hirsel is meant to settle at. A small flock is defensible while you
   * build it up; a large one strains what one shepherd and one dog can see,
   * which puts the ceiling in the same place the work does.
   */
  foxFlockPivot: 12,
  foxFlockMin: 0.45,
  foxFlockMax: 1.5,
  /*
   * The two dogs, and the two instruments, are sidegrades at one price —
   * different shapes, not different amounts. The sheltie is the safe pick and
   * the collie the productive one; the pipes settle the flock and the fiddle
   * grows it. Each is a slot: one dog, one instrument, never both, or the
   * choice collapses into a shopping list and the bonuses compound.
   */
  dogFoxBias: 0.6,
  /*
   * Measured, not guessed. Across 60 seeded 30-day runs on one policy:
   *   sheltie  median £66, 0.73 sheep lost per run
   *   collie   median £71, 0.93 sheep lost per run
   * A sheep is worth £24 and up, so the collie's extra £5 is roughly paid
   * for by the extra animal she does not save — the choice is flock safety
   * against income, not a better and a worse option. 0.75 left the collie
   * quietly ahead on both counts; 0.9 made her not worth having.
   */
  collieFoxBias: 0.85,
  collieGraze: 1.05,
  fiddleGrowth: 1.25,
  fiddleDays: 3,
  peltFoxRisk: 0.01,

  flystrikeFleece: 11,
  flystrikeChance: 0.3,

  regenRain: 2.2,
  regenSun: 1.2,

  /**
   * What the cart pays for a beast, as a fraction of what she cost new.
   * A loss on purpose: selling stock is a way out of a bad week, not a way
   * to make money by churning it.
   */
  sellbackRate: 0.6,

  /** salt lick: they eat less of the hill for the same growth */
  saltlickGraze: 0.75,

  /**
   * Wool price, and the feed bill above it, are the two numbers that decide
   * whether a flock compounds or bleeds. They were set so it bled.
   *
   * Measured across 25 seeded 90-day runs on one competent policy — shear at
   * prime rather than at the legal minimum, work the better ground, buy the
   * dog first — a six-sheep flock at 80p and £1-per-2 feed took about £180 of
   * fox losses against £114 of wool. Every run decayed towards two or three
   * beasts and 22 of 25 died with an empty purse. A player could not climb
   * out of the flock they started with, so the whole middle of the game was
   * unreachable.
   *
   * Swept together, holding the target at "a flock of twelve should be a
   * comfortable place to live":
   *
   *   feed   price   alive 90d   reached 12   median flock   purse
   *   1/2     80p       5/25        0/25            3          £21
   *   1/2    110p       5/25        2/25            7          £32
   *   1/3     95p      15/25        8/25           10          £35
   *   1/3    105p      16/25       12/25           12         £164
   *   1/3    110p      18/25       17/25           12         £230
   *
   * 1/3 and 105p is the chosen point: the median run settles at exactly the
   * intended twelve, and £164 by day ninety against £1,510 of croft is a long
   * way from generous. Feed is the stronger lever of the two — at £1 per 2 no
   * wool price rescued the run, because the bill scaled with the flock as
   * fast as the fleece did.
   */
  marketBase: 105,
  marketSwing: 34,

  wolfActionsNeeded: 5,
  wolfWarnOnAction: 4,
} as const;

/**
 * §14 open questions. All left at prototype behaviour. Flip and playtest.
 */
/**
 * The scale you choose to play on.
 *
 * The mechanics are identical at every setting — the same actions, the same
 * fox, the same croft — so a player who learns the game on Gentle has learned
 * the game. Only two numbers move: how often a fox comes, and what wool
 * fetches. Those are the two the simulation showed decide whether a flock
 * compounds or bleeds, so they are the honest place to put the dial.
 *
 * Hard is the tuning the balance work landed on: measured at roughly a 64%
 * survival rate over ninety days on a competent policy. That is a fine
 * summit and a poor lobby, which is why it is no longer the only option —
 * and why it is the one that pays out.
 */
export const DIFFICULTY: Record<
  Difficulty,
  { name: string; blurb: string; fox: number; price: number }
> = {
  gentle: {
    name: "Gentle",
    blurb: "A kinder glen. Foxes come seldom and wool sells well.",
    fox: 0.6,
    price: 1.2,
  },
  steady: {
    name: "Steady",
    blurb: "The hill as it is. Room to make a mistake and still eat.",
    fox: 0.8,
    price: 1.1,
  },
  hard: {
    name: "Hard",
    blurb: "A thin living. Beat it and the glen gives up a secret.",
    fox: 1,
    price: 1,
  },
};

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
  { id: "crook", name: "Shepherd's crook", cost: 18, what: "Takes a tap off gathering — and off a big flock, which costs two." },
  { id: "shears", name: "Blade shears", cost: 32, what: "Every fleece comes off a fifth heavier, and you get through more of them in a day." },
  { id: "boots", name: "Stout boots", cost: 26, what: "One more tap every day." },
  { id: "dog", name: "Shetland sheepdog", cost: 58, what: "Works the flock in on her own each night, and foxes think twice about her." },
  { id: "collie", name: "Border collie", cost: 58, what: "Works them in on her own and keeps them grazing steadily — less of a deterrent to a fox, but they do better under her." },
  { id: "fiddle", name: "A fiddle", cost: 34, what: "Play it instead of the pipes. It puts more growth on them and holds a day longer, but it will not keep a fox off." },
  { id: "cart", name: "Pony and cart", cost: 74, what: "Market costs no tap." },
  { id: "saltlick", name: "Salt lick", cost: 28, what: "Set it on the hill and they take a quarter less grass for the same growth." },
  { id: "oilskin", name: "Waxed oilskin", cost: 36, what: "You can shear through a haar in this. Rain is still rain." },
  { id: "lamp", name: "Storm lantern", cost: 44, what: "One more tap every day. The evening stretches." },
  // §7: gives nothing away. Do not explain it anywhere in the UI.
  { id: "sword", name: "Highland broadsword", cost: 185, what: "Hangs well above the fire. Bonny thing. Not much use for keeping foxes off, mind." },
  { id: "watch", name: "Brass pocket watch", cost: 165, what: "Set a day's work to it once and it will keep that day for you after." },
] as const;

/**
 * The croft is built, not bought.
 *
 * Paying for it was a pure money sink that cost no part of the day, so the
 * whole road to winning never once competed with the work — and a player who
 * kept a small flock never met any tap pressure at all. The money buys the
 * materials; `work` is the days of your own labour it then takes, so the
 * thing you are playing for is made of the same scarce stuff as everything
 * else.
 *
 * The ring is the exception that proves it: you do not build a ring, you walk
 * to Inverness for it, and that is the two days.
 */
export const CROFT = [
  { id: "roof", name: "Slate the cottage roof", cost: 240, work: 3, need: null, what: "The thatch has been letting water since before you came." },
  { id: "hearth", name: "Build up the hearth", cost: 330, work: 4, need: "roof", what: "A proper fire, a settle, a place that is not just shelter." },
  { id: "byre", name: "Raise a stone byre", cost: 420, work: 5, need: "hearth", what: "Somewhere to bring them in out of the worst of it." },
  { id: "ring", name: "A silver ring, Inverness", cost: 520, work: 2, need: "byre", what: "You have known for a while now. You just had nothing to offer." },
] as const;

export const ANIM_MS: Record<string, number> = {
  gather: 1400,
  shear: 1600,
  market: 1900,
  pipe: 2200,
  music: 2000,
  // the pub and the night are the two set pieces worth sitting in: an £8
  // pint should feel like an evening, and the dark is where the game's
  // tension lives. SKELP halves all of this for anyone in a hurry.
  pub: 4200,
  move: 1200,
  sleep: 2600, // dusk down into the dark
  dawn: 2000, // and back up out of it
  tend: 1700,
  muck: 1600,
  build: 1700,
  buysheep: 1200,
  fox: 2800,
  wolf: 6000,
  wolflost: 5000,
  quit: 7000,
  bark: 900,
};
