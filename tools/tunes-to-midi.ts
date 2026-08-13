/**
 * Write the game's tunes out as Standard MIDI Files.
 *
 * The tunes live in src/audio/tunes.ts as note data — MIDI numbers and
 * durations in beats — and the game turns them into sound at runtime with
 * oscillators. That same data is all a .mid file holds, so this reads the
 * real tune and emits it, rather than anyone transcribing it by ear into a
 * second copy that can drift.
 *
 *   npx vite-node tools/tunes-to-midi.ts
 *
 * Each tune comes out as a format-1 file with the melody, the drone and the
 * harp on separate named tracks, so they land in GarageBand as three
 * instruments you can mute, swap or throw away independently.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { HIRSEL_AIR, LONG_ROAD_HOME, TOD_JIG, type Tune } from "../src/audio/tunes";

/** ticks per quarter note — 480 is the usual, and divides every duration here */
const TPQ = 480;

/* ---------- the bytes ---------- */

/** MIDI's variable-length quantity: seven bits at a time, high bit as "more" */
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  let v = n >> 7;
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return out;
}

const str = (s: string) => [...s].map((c) => c.charCodeAt(0));

function chunk(id: string, body: number[]): number[] {
  const n = body.length;
  return [...str(id), (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, ...body];
}

interface Ev {
  at: number;
  /** note-offs sort before note-ons at the same tick, or a repeated note is cut */
  order: number;
  bytes: number[];
}

function track(name: string, evs: Ev[], head: number[] = []): number[] {
  const sorted = [...evs].sort((a, b) => a.at - b.at || a.order - b.order);
  const body: number[] = [...head];
  // the track name, so GarageBand labels it
  body.push(...vlq(0), 0xff, 0x03, name.length, ...str(name));
  let last = 0;
  for (const e of sorted) {
    body.push(...vlq(e.at - last), ...e.bytes);
    last = e.at;
  }
  body.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track
  return chunk("MTrk", body);
}

const on = (at: number, ch: number, n: number, v: number): Ev => ({ at, order: 1, bytes: [0x90 | ch, n, v] });
const off = (at: number, ch: number, n: number): Ev => ({ at, order: 0, bytes: [0x80 | ch, n, 0] });

/** a note, as the pair of events it really is */
function note(evs: Ev[], ch: number, pitch: number, at: number, dur: number, vel: number) {
  // clipped a hair short so repeated notes of the same pitch re-articulate
  const end = at + Math.max(1, dur - 6);
  evs.push(on(at, ch, pitch, vel), off(end, ch, pitch));
}

/* ---------- the tune ---------- */

/**
 * `beatUnit` is what one of the tune's beats is worth as a fraction of a
 * quarter note. The air and the waltz count in quarters; the jig's durations
 * are eighths, which is why its bpm reads 300.
 */
function toMidi(tune: Tune, beatUnit: number, timeSig: [number, number]): Uint8Array {
  const tick = (beats: number) => Math.round(beats * beatUnit * TPQ);
  const melody: Ev[] = [];
  const drone: Ev[] = [];
  const harp: Ev[] = [];

  let t = 0; // in beats
  for (const partName of tune.form) {
    const part = tune.parts[partName];
    part.bars.forEach((bar, i) => {
      const root = part.roots[i];
      const barStart = t;

      // the drone, held under the whole bar
      note(drone, 1, root, tick(barStart), tick(tune.beatsPerBar), 52);
      // and the octave above it, which is what a drone actually sounds like
      note(drone, 1, root + 12, tick(barStart), tick(tune.beatsPerBar), 40);

      // the harp figure, walking the chord over the bar
      const chord = tune.harp[root] ?? [];
      if (chord.length) {
        for (let k = 0; k * tune.harpStep < tune.beatsPerBar; k++) {
          const at = barStart + k * tune.harpStep;
          note(harp, 2, chord[k % chord.length], tick(at), tick(tune.harpStep), 46);
        }
      }

      // the melody itself
      let at = barStart;
      for (const n of bar) {
        if (n.n !== null) note(melody, 0, n.n, tick(at), tick(n.d), 92);
        at += n.d;
      }
      t = barStart + tune.beatsPerBar;
    });
  }

  // µs per quarter note, from the tune's own tempo
  const usPerQuarter = Math.round(60_000_000 / (tune.bpm * beatUnit));
  const [num, den] = timeSig;
  const header = [
    ...vlq(0), 0xff, 0x58, 0x04, num, Math.round(Math.log2(den)), 24, 8, // time signature
    ...vlq(0), 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff,
  ];

  const bytes = [
    ...chunk("MThd", [0, 1, 0, 4, (TPQ >> 8) & 0xff, TPQ & 0xff]), // format 1, 4 tracks
    ...track(tune.name, [], header), // a conductor track: tempo and metre only
    ...track("Melody", melody),
    ...track("Drone", drone),
    ...track("Harp", harp),
  ];
  return Uint8Array.from(bytes);
}

/* ---------- write them out ---------- */

const OUT = new URL("../music/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const jobs: [Tune, number, [number, number], string][] = [
  [HIRSEL_AIR, 1, [4, 4], "the-hirsel.mid"],
  [LONG_ROAD_HOME, 1, [3, 4], "the-long-road-home.mid"],
  [TOD_JIG, 0.5, [6, 8], "the-tod.mid"],
];

for (const [tune, beatUnit, sig, file] of jobs) {
  const data = toMidi(tune, beatUnit, sig);
  writeFileSync(OUT + file, data);
  const bars = tune.form.reduce((a, p) => a + tune.parts[p].bars.length, 0);
  console.log(`${file.padEnd(24)} ${tune.name.padEnd(20)} ${bars} bars  ${sig[0]}/${sig[1]}  ${tune.bpm}bpm  ${data.length} bytes`);
}
