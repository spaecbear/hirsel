import { describe, expect, it } from "vitest";
import { DORIAN_D, HARP_FIGURES, HIRSEL_AIR, sequence } from "../src/audio/tunes";

/** a note is in the mode if its pitch class is one of D Dorian's seven */
const classes = new Set(DORIAN_D.map((n) => n % 12));

describe("the tunes", () => {
  it("fills every bar exactly — a mistyped duration would put the tune out of time", () => {
    for (const [name, part] of Object.entries(HIRSEL_AIR.parts)) {
      part.bars.forEach((bar, i) => {
        const beats = bar.reduce((a, n) => a + n.d, 0);
        expect(beats, `${name} bar ${i + 1}`).toBe(HIRSEL_AIR.beatsPerBar);
      });
      expect(part.roots).toHaveLength(part.bars.length);
    }
  });

  it("stays in D Dorian", () => {
    for (const part of Object.values(HIRSEL_AIR.parts)) {
      for (const bar of part.bars) {
        for (const note of bar) {
          if (note.n === null) continue;
          expect(classes.has(note.n % 12), `pitch ${note.n}`).toBe(true);
        }
      }
    }
  });

  it("moves on the double tonic — D and C, not D and A", () => {
    const roots = new Set(Object.values(HIRSEL_AIR.parts).flatMap((p) => p.roots));
    expect([...roots].sort()).toEqual([36, 38]);
    for (const root of roots) expect(HARP_FIGURES[root]).toBeDefined();
  });

  it("sequences the form into a continuous, gapless timeline", () => {
    const { events, roots, beats } = sequence(HIRSEL_AIR);
    expect(roots).toHaveLength(HIRSEL_AIR.form.length * 4);
    expect(beats).toBe(roots.length * HIRSEL_AIR.beatsPerBar);
    let at = 0;
    for (const e of events) {
      expect(e.at).toBeCloseTo(at);
      expect(e.bar).toBe(Math.floor(at / HIRSEL_AIR.beatsPerBar));
      at += e.d;
    }
    expect(at).toBe(beats);
  });
});
