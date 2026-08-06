/**
 * Inverse mode ("TOD") swaps who is who. The simulation is untouched — the
 * numbers were tuned and stay tuned — but the words and the sprites turn over:
 * you keep a skulk of foxes, and it is sheep that come off the hill at night.
 */
import type { BreedId } from "./types";

export interface Lexicon {
  flock: string;
  flockCap: string;
  beast: string;
  beasts: string;
  raider: string;
  wool: string;
  woolCap: string;
  gather: string;
  shear: string;
  /** what the steading is selling, and what one of them is called */
  stock: string;
  unit: string;
  breeds: Record<BreedId, string>;
  raidLine: (dog: boolean) => string;
}

export const NORMAL: Lexicon = {
  flock: "flock",
  flockCap: "Flock",
  beast: "sheep",
  beasts: "sheep",
  raider: "fox",
  wool: "wool",
  woolCap: "Wool",
  gather: "Gather the flock",
  shear: "Shear",
  stock: "Stock — buy as many as you can afford",
  unit: "ewe",
  breeds: {
    blackface: "Scottish Blackface",
    cheviot: "Cheviot",
    hebridean: "Hebridean",
    shetland: "Shetland",
  },
  raidLine: (dog) =>
    dog
      ? "A fox came off the hill. She drove it off, but not before it took one."
      : "A fox came off the hill in the night. One sheep lost.",
};

export const INVERSE: Lexicon = {
  flock: "skulk",
  flockCap: "Skulk",
  beast: "fox",
  beasts: "foxes",
  raider: "ram",
  wool: "brush",
  woolCap: "Brush",
  gather: "Gather the skulk",
  shear: "Comb the brushes",
  stock: "Earths — take on as many as you can afford",
  unit: "vixen",
  // the same four beasts underneath: growth and value are untouched, so the
  // hill tod is the hardy one and the silver is the one worth the money
  breeds: {
    blackface: "Hill tod",
    cheviot: "Border tod",
    hebridean: "Black tod",
    shetland: "Silver tod",
  },
  raidLine: (dog) =>
    dog
      ? "A ram came down off the hill. She saw it away, but not before it had one."
      : "A ram came down off the hill in the night. One fox lost.",
};

export const lexicon = (inverse: boolean) => (inverse ? INVERSE : NORMAL);
