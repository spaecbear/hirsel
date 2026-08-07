import { describe, expect, it } from "vitest";
import { DORIAN_D, HARP_FIGURES, HIRSEL_AIR, LONG_ROAD_HOME, MIXOLYDIAN_D, TOD_JIG, sequence } from "../src/audio/tunes";

const inMode = (scale: number[]) => new Set(scale.map((n) => n % 12));

describe("the tunes", () => {
  it.each([HIRSEL_AIR, TOD_JIG, LONG_ROAD_HOME])("$name fills every bar exactly", (tune) => {
    // a mistyped duration would quietly put the tune out of time
    for (const [name, part] of Object.entries(tune.parts)) {
      part.bars.forEach((bar, i) => {
        const beats = bar.reduce((a, n) => a + n.d, 0);
        expect(beats, `${name} bar ${i + 1}`).toBe(tune.beatsPerBar);
      });
      expect(part.roots).toHaveLength(part.bars.length);
    }
  });

  it.each([
    [HIRSEL_AIR, DORIAN_D],
    [TOD_JIG, MIXOLYDIAN_D],
    [LONG_ROAD_HOME, DORIAN_D],
  ])("$0.name stays in its mode", (tune, scale) => {
    const classes = inMode(scale as number[]);
    for (const part of Object.values((tune as typeof HIRSEL_AIR).parts)) {
      for (const bar of part.bars) {
        for (const note of bar) {
          if (note.n === null) continue;
          expect(classes.has(note.n % 12), `pitch ${note.n}`).toBe(true);
        }
      }
    }
  });

  it("gives every tune the harp shapes and pulse its own metre needs", () => {
    for (const tune of [HIRSEL_AIR, TOD_JIG]) {
      for (const root of new Set(Object.values(tune.parts).flatMap((p) => p.roots))) {
        expect(tune.harp[root], `${tune.name} root ${root}`).toBeDefined();
      }
      expect(tune.pulse.every((b) => b < tune.beatsPerBar)).toBe(true);
      expect(tune.harpStep).toBeGreaterThan(0);
    }
  });

  it("makes The Tod the opposite of The Hirsel: compound time, major third, quicker", () => {
    expect(TOD_JIG.beatsPerBar).toBe(6);
    expect(HIRSEL_AIR.beatsPerBar).toBe(4);
    // F sharp against the air's F natural
    expect(MIXOLYDIAN_D).toContain(66);
    expect(DORIAN_D).toContain(65);
    // a bar of the jig goes by faster than a bar of the air
    const bar = (t: typeof TOD_JIG) => (60 / t.bpm) * t.beatsPerBar;
    expect(bar(TOD_JIG)).toBeLessThan(bar(HIRSEL_AIR));
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
