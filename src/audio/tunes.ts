/**
 * The tunes, written out as notes rather than generated.
 *
 * "The Hirsel" is a slow air in D Dorian — the mode most Highland and Hebridean
 * airs sit in, and the reason the C is natural rather than sharp. The harmony
 * moves between D and C rather than D and A: the double tonic, which is the
 * single most Scottish thing you can do to a tune.
 *
 * Pitches are MIDI numbers, durations are beats. Every part fills whole bars —
 * `tunes.test.ts` checks that, so a typo in a melody fails the suite instead of
 * quietly knocking the tune out of time.
 */

export interface Note {
  /** MIDI number, or null for a rest */
  n: number | null;
  /** duration in beats */
  d: number;
}

export interface Part {
  bars: Note[][];
  /** the drone root under each bar — the double tonic lives here */
  roots: number[];
}

export interface Tune {
  name: string;
  bpm: number;
  beatsPerBar: number;
  parts: Record<string, Part>;
  /** the order the parts are played in, looping */
  form: string[];
  /** the chord the harp arpeggiates over each drone root */
  harp: Record<number, number[]>;
  /** spacing of the harp figure, in beats */
  harpStep: number;
  /** which beats of the bar the drum lands on */
  pulse: number[];
}

const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const C5 = 72;
const D5 = 74;

/** drone roots, two octaves down: D2 and C2 */
const D_ = 38;
const C_ = 36;

/**
 * A — the statement. Falls from A down to E, then climbs back through the
 * octave. Bar 4 leaves a beat of air; the tune should breathe.
 */
const A_PART: Part = {
  roots: [D_, D_, C_, C_],
  bars: [
    [{ n: D4, d: 1 }, { n: F4, d: 1 }, { n: A4, d: 2 }],
    [{ n: G4, d: 1 }, { n: F4, d: 1 }, { n: E4, d: 2 }],
    [{ n: F4, d: 1 }, { n: A4, d: 1 }, { n: C5, d: 1 }, { n: A4, d: 1 }],
    [{ n: G4, d: 2 }, { n: F4, d: 1.5 }, { n: null, d: 0.5 }],
  ],
};

/** A2 — the same shape, answered, and closed on the tonic */
const A2_PART: Part = {
  roots: [D_, D_, C_, D_],
  bars: [
    [{ n: A4, d: 1 }, { n: C5, d: 1 }, { n: D5, d: 2 }],
    [{ n: C5, d: 1 }, { n: A4, d: 1 }, { n: G4, d: 2 }],
    [{ n: F4, d: 1 }, { n: G4, d: 1 }, { n: A4, d: 1 }, { n: C5, d: 1 }],
    [{ n: E4, d: 1 }, { n: D4, d: 2.5 }, { n: null, d: 0.5 }],
  ],
};

/** B — the turn. Sits an octave up and leans on the C, which is where the
 *  mode shows itself. Traditional B parts go high; this one does too. */
const B_PART: Part = {
  roots: [C_, C_, D_, D_],
  bars: [
    [{ n: D5, d: 1 }, { n: D5, d: 1 }, { n: C5, d: 1 }, { n: A4, d: 1 }],
    [{ n: C5, d: 2 }, { n: A4, d: 2 }],
    [{ n: G4, d: 1 }, { n: A4, d: 1 }, { n: C5, d: 1 }, { n: D5, d: 1 }],
    [{ n: A4, d: 3 }, { n: null, d: 1 }],
  ],
};

/** D Dorian, for the harp figures under the melody */
export const DORIAN_D = [62, 64, 65, 67, 69, 71, 72];

/** the chord the harp arpeggiates over each drone root */
export const HARP_FIGURES: Record<number, number[]> = {
  [D_]: [50, 57, 62, 65], // D3 A3 D4 F4
  [C_]: [48, 55, 60, 64], // C3 G3 C4 E4
};

export const HIRSEL_AIR: Tune = {
  name: "The Hirsel",
  bpm: 68,
  beatsPerBar: 4,
  parts: { A: A_PART, A2: A2_PART, B: B_PART },
  form: ["A", "A2", "B", "A2"],
  harp: HARP_FIGURES,
  harpStep: 0.5,
  pulse: [0, 2],
};

/* ------------------------------------------------------------------ *
 * "The Tod" — what plays when the glen is turned over (the TOD code).
 *
 * Written in the idiom of the old folk song about the fox that goes out on a
 * chilly night: a 6/8 lilt, brisk and loping, in mixolydian with the flat
 * seventh doing the work. It is an original tune rather than that one — the
 * traditional melody is public domain, but every recorded arrangement of it
 * is somebody's, and this way the tune is ours.
 *
 * Everything is deliberately the opposite of The Hirsel: compound time
 * instead of four, mixolydian instead of dorian, a major third instead of a
 * minor one, and roughly half again the pace. Durations here are eighths.
 * ------------------------------------------------------------------ */

/** D mixolydian: D E F# G A B C. The F sharp and the C natural together. */
export const MIXOLYDIAN_D = [62, 64, 66, 67, 69, 71, 72];

const TOD_HARP: Record<number, number[]> = {
  [D_]: [50, 57, 62, 66], // D3 A3 D4 F#4 — major third, and it should sound it
  [C_]: [48, 55, 60, 64], // C3 G3 C4 E4 — the flat seventh chord, I to bVII
};

/** A — out on a chilly night, at a trot */
const TOD_A: Part = {
  roots: [D_, D_, C_, D_],
  bars: [
    [{ n: 69, d: 2 }, { n: 69, d: 1 }, { n: 71, d: 2 }, { n: 69, d: 1 }],
    [{ n: 74, d: 2 }, { n: 74, d: 1 }, { n: 71, d: 2 }, { n: 69, d: 1 }],
    [{ n: 67, d: 2 }, { n: 69, d: 1 }, { n: 71, d: 2 }, { n: 67, d: 1 }],
    [{ n: 66, d: 3 }, { n: 62, d: 3 }],
  ],
};

/** A2 — the same road, answered and closed */
const TOD_A2: Part = {
  roots: [D_, D_, C_, D_],
  bars: [
    [{ n: 69, d: 2 }, { n: 71, d: 1 }, { n: 74, d: 2 }, { n: 74, d: 1 }],
    [{ n: 76, d: 2 }, { n: 74, d: 1 }, { n: 71, d: 2 }, { n: 69, d: 1 }],
    [{ n: 67, d: 2 }, { n: 66, d: 1 }, { n: 64, d: 2 }, { n: 66, d: 1 }],
    [{ n: 62, d: 4 }, { n: null, d: 2 }],
  ],
};

/** B — the refrain, up an octave, where the tag lines would fall */
const TOD_B: Part = {
  roots: [C_, C_, D_, D_],
  bars: [
    [{ n: 74, d: 2 }, { n: 76, d: 1 }, { n: 78, d: 2 }, { n: 76, d: 1 }],
    [{ n: 74, d: 2 }, { n: 71, d: 1 }, { n: 69, d: 3 }],
    [{ n: 67, d: 2 }, { n: 69, d: 1 }, { n: 71, d: 2 }, { n: 72, d: 1 }], // the flat seventh
    [{ n: 69, d: 3 }, { n: 62, d: 3 }],
  ],
};

export const TOD_JIG: Tune = {
  name: "The Tod",
  bpm: 300, // eighths — about 100 dotted-quarters a minute, a good trotting pace
  beatsPerBar: 6,
  parts: { A: TOD_A, A2: TOD_A2, B: TOD_B },
  form: ["A", "A2", "B", "A2"],
  harp: TOD_HARP,
  harpStep: 1,
  pulse: [0, 3], // the two strong beats of a 6/8 bar
};

/** one flat event stream for a whole pass of the form */
export interface Event {
  /** beats from the start of the pass */
  at: number;
  n: number | null;
  d: number;
  bar: number;
}

export function sequence(tune: Tune): { events: Event[]; roots: number[]; beats: number } {
  const events: Event[] = [];
  const roots: number[] = [];
  let at = 0;
  let bar = 0;
  for (const partName of tune.form) {
    const part = tune.parts[partName];
    part.bars.forEach((notes, i) => {
      roots.push(part.roots[i]);
      for (const note of notes) {
        events.push({ at, n: note.n, d: note.d, bar });
        at += note.d;
      }
      bar++;
    });
  }
  return { events, roots, beats: bar * tune.beatsPerBar };
}
