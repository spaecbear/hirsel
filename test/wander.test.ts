import { describe, expect, it } from "vitest";
import { herdCircuit } from "../src/render/wander";

/*
 * A working dog does not wag while she is working. The tail used to go
 * whenever she was on the move, so it swept the whole way round a herding
 * circuit and read as a toy being pulled along on a string. The wag belongs
 * to the stop between laps: she comes in, stands a moment, wags, stands
 * again, and goes back out.
 */
describe("the dog's circuit", () => {
  const at = (t: number) => herdCircuit(t, 100, 100, 60, 20);

  it("never wags while she is running", () => {
    for (let t = 0; t < 60000; t += 50) {
      const c = at(t);
      if (c.running) expect(c.wagging, `t=${t}`).toBe(false);
    }
  });

  it("does wag, and only in the middle of the stop", () => {
    // one full cycle: some of it running, some stopped, some of the stop wagging
    const cycle = Array.from({ length: 400 }, (_, i) => at(i * 50));
    expect(cycle.some((c) => c.running)).toBe(true);
    expect(cycle.some((c) => !c.running)).toBe(true);
    expect(cycle.some((c) => c.wagging)).toBe(true);
    // she settles before the wag and settles again before she goes back out
    const stopped = cycle.filter((c) => !c.running);
    expect(stopped[0].wagging).toBe(false);
    expect(stopped[stopped.length - 1].wagging).toBe(false);
  });

  it("faces the way she is running, both ways round", () => {
    const facings = new Set(Array.from({ length: 400 }, (_, i) => at(i * 50).facing));
    expect(facings.has(1)).toBe(true);
    expect(facings.has(-1)).toBe(true);
  });

  it("stands still at the same spot for the whole stop", () => {
    const stopped = Array.from({ length: 600 }, (_, i) => at(i * 50)).filter((c) => !c.running);
    const first = stopped[0];
    for (const c of stopped) {
      expect(c.x).toBeCloseTo(first.x);
      expect(c.y).toBeCloseTo(first.y);
    }
  });
});
