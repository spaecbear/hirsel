/** the scale a run is played at; see DIFFICULTY in config.ts */
export type Difficulty = "gentle" | "steady" | "hard";

export type BreedId = "blackface" | "cheviot" | "hebridean" | "shetland";

export interface Breed {
  id: BreedId;
  name: string;
  cost: number;
  growth: number;
  value: number;
  wool: string;
  face: string;
  note: string;
}

export interface Sheep {
  id: number;
  fleece: number;
  breed: BreedId;
  /** days in the flock — surfaced on hover, and the hook for a future ageing system */
  age: number;
}

export type WeatherId = "sun" | "overcast" | "rain" | "mist";

export interface Weather {
  id: WeatherId;
  name: string;
  graze: number;
  shear: boolean;
  foxBias: number;
  sky: string;
  light: string;
}

export interface Pasture {
  name: string;
  grass: number;
  cap: number;
  quality: number;
  risk: number;
  regen: number;
}

export type ToolId =
  | "crook"
  | "boots"
  | "shears"
  | "lamp"
  | "dog"
  | "collie"
  | "fiddle"
  | "cart"
  | "watch"
  | "sword"
  | "saltlick"
  | "oilskin";

export type CroftId = "roof" | "hearth" | "byre" | "ring";

/** everything ownable, including the pelt, which is won rather than bought */
export type OwnedId = ToolId | CroftId | "pelt";

export type ActionId =
  | "gather"
  | "shear"
  | "market"
  | "tend"
  | "muck"
  | "build"
  | "pipe"
  | "music"
  | "pub"
  | "ask";

export type BuffId = "tended" | "steady hands" | "settled flock" | "hale" | "fiddled";

export type LogClass = "" | "hi" | "bad" | "gold" | "cozy";

export interface LogLine {
  t: string;
  cls: LogClass;
  day: number;
}

export type RoutineEntry = { kind: "move"; to: number } | { kind: "act"; act: ActionId };

export type AnimId =
  | "gather"
  | "shear"
  | "market"
  | "tend"
  | "muck"
  | "build"
  | "pipe"
  | "music"
  | "pub"
  | "move"
  | "sleep"
  /** the sky coming back up, played after anything that happens in the dark */
  | "dawn"
  | "buysheep"
  | "fox"
  | "wolf"
  | "wolflost"
  /** the dog seeing something off in the dark */
  | "bark"
  /** the day you walked out, played once at the start of a run */
  | "quit"
  | "propose";

export interface GameState {
  day: number;
  taps: number;
  money: number;
  wool: number;
  flock: Sheep[];
  nextSheepId: number;
  /** the scale this run is being played at; fixed when the run starts */
  difficulty: Difficulty;
  at: number;
  pastures: Pasture[];
  owned: Partial<Record<OwnedId, boolean>>;
  buffs: Partial<Record<BuffId, number>>;
  forecast: WeatherId[];
  log: LogLine[];
  gatheredToday: boolean;
  /**
   * What has actually been done today, by action id, and which pastures have
   * been mucked. Recorded rather than inferred: working it out from side
   * effects got both the fiddle (which sets a different buff from the pipes)
   * and mucking (which was reading "the grass is high" as "you did this")
   * wrong. Cleared every night.
   */
  didToday: Partial<Record<ActionId, number>>;
  muckedToday: number[];
  /**
   * The croft milestone paid for and now being worked on, and how many days
   * of work have gone into it. Money buys the materials; the days are yours.
   */
  building: { id: CroftId; done: number } | null;
  actsToday: number;
  pubs: number;
  /** the inn is once a night — you cannot drink the day away */
  pubToday: boolean;
  /** win / loss bookkeeping */
  over: null | { kind: "win" | "lose"; title: string; body: string };
  /** pocket watch */
  routine: RoutineEntry[] | null;
  draft: RoutineEntry[];
  recording: boolean;
  /** run stats, for achievements and the end screen */
  stats: {
    woolSold: number;
    earned: number;
    foxLosses: number;
    strikeLosses: number;
    sheepBought: number;
    sheepSold: number;
    shears: number;
    daysHungry: number;
    wolfMaulings: number;
    /** the sheltie was tapped into two turns hard on each other — Arrow */
    spunTwice: boolean;
    /** you have stood in the room and seen the collie settle at the fire — Tippy */
    sawTippy: boolean;
  };
  achievements: string[];
  seed: number;
}

/** every mutation the sim performs goes through this, so the UI can animate it */
export interface SimEvent {
  anim?: AnimId;
  /** applied when the animation for this event finishes, not before */
  after?: () => void;
}
