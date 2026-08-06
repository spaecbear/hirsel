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

export const HIRSEL_AIR: Tune = {
  name: "The Hirsel",
  bpm: 68,
  beatsPerBar: 4,
  parts: { A: A_PART, A2: A2_PART, B: B_PART },
  form: ["A", "A2", "B", "A2"],
};

/** D Dorian, for the harp figures under the melody */
export const DORIAN_D = [62, 64, 65, 67, 69, 71, 72];

/** the chord the harp arpeggiates over each drone root */
export const HARP_FIGURES: Record<number, number[]> = {
  [D_]: [50, 57, 62, 65], // D3 A3 D4 F4
  [C_]: [48, 55, 60, 64], // C3 G3 C4 E4
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
