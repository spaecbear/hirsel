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
  | "pipe"
  | "music"
  | "pub"
  | "ask";

export type BuffId = "tended" | "steady hands" | "settled flock" | "hale";

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
  | "pipe"
  | "music"
  | "pub"
  | "move"
  | "sleep"
  | "buysheep"
  | "fox"
  | "wolf"
  | "wolflost";

export interface GameState {
  day: number;
  taps: number;
  money: number;
  wool: number;
  flock: Sheep[];
  nextSheepId: number;
  at: number;
  pastures: Pasture[];
  owned: Partial<Record<OwnedId, boolean>>;
  buffs: Partial<Record<BuffId, number>>;
  forecast: WeatherId[];
  log: LogLine[];
  gatheredToday: boolean;
  actsToday: number;
  pubs: number;
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
    shears: number;
    daysHungry: number;
    wolfMaulings: number;
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
