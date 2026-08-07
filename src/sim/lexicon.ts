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
  /** what each breed is known for, in this run's vocabulary */
  breedNotes: Record<BreedId, string>;
  raidLine: (dog: boolean) => string;

  /* lines the sim says, which have to turn over with everything else */
  driveUp: (place: string) => string;
  hungry: (place: string) => string;
  strike: string;
  lastGone: { title: string; body: string };
  soldLast: { title: string; body: string };
  maulSurvivors: (lost: number, keep: number) => string;
  winBody: (flock: number, days: number) => string;
  /** the fleece-quality words the flock roster shows */
  fleeceWord: string;
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
  breedNotes: {
    blackface: "Hardy hill sheep. Coarse fleece, but she'll thrive on ground that beats the others.",
    cheviot: "Grows fleece fast. Wants decent grazing to do it.",
    hebridean: "Small and black. Little wool, but it fetches a price.",
    shetland: "The finest fleece in Scotland. Worth more than she looks.",
  },
  raidLine: (dog) =>
    dog
      ? "A fox came off the hill. She drove it off, but not before it took one."
      : "A fox came off the hill in the night. One sheep lost.",
  driveUp: (place) => `You drive the flock up to the ${place}.`,
  hungry: (place) => `Grass is thin on the ${place}. The flock went hungry.`,
  strike: "Strike in a matted fleece. You found her too late.",
  lastGone: { title: "The last of them gone", body: "You are a shepherd with no sheep. The croft goes quiet." },
  soldLast: { title: "You sold the last of them", body: "There is no shepherd without a flock. You take the road down." },
  maulSurvivors: (lost, keep) =>
    `He went through them. ${lost} gone. ${keep === 1 ? "One ewe" : `${keep} ewes`} left standing.`,
  winBody: (flock, days) =>
    `Slated roof, a hearth, a byre of your own, and ${flock} sheep on the hill. ` +
    `You lasted ${days} days, and you are not doing the rest of it alone.`,
  fleeceWord: "fleece",
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
  breedNotes: {
    blackface: "Hardy hill tod. Coarse brush, but she'll thrive on ground that beats the others.",
    cheviot: "Grows brush fast. Wants decent grazing to do it.",
    hebridean: "Small and black. Little brush, but it fetches a price.",
    shetland: "The finest brush in Scotland. Worth more than she looks.",
  },
  raidLine: (dog) =>
    dog
      ? "A ram came down off the hill. She saw it away, but not before it had one."
      : "A ram came down off the hill in the night. One fox lost.",
  driveUp: (place) => `You drive the skulk up to the ${place}.`,
  hungry: (place) => `Grass is thin on the ${place}. The skulk went hungry.`,
  strike: "Canker in a matted brush. You found her too late.",
  lastGone: { title: "The last of them gone", body: "You are a tod-keeper with nothing left to keep. The croft goes quiet." },
  soldLast: { title: "You sold the last of them", body: "There is no keeper without a skulk. You take the road down." },
  maulSurvivors: (lost, keep) =>
    `He went through them. ${lost} gone. ${keep === 1 ? "One vixen" : `${keep} vixens`} left standing.`,
  winBody: (flock, days) =>
    `Slated roof, a hearth, a byre of your own, and ${flock} foxes on the hill. ` +
    `You lasted ${days} days, and you are not doing the rest of it alone.`,
  fleeceWord: "brush",
};

export const lexicon = (inverse: boolean) => (inverse ? INVERSE : NORMAL);
