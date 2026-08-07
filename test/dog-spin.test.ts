import { beforeEach, describe, expect, it } from "vitest";
import { QUICK_MS, SPIN_MS, resetSpin, spinNow, startSpin } from "../src/render/dog-spin";

/*
 * Arrow spun in circles when she was pleased to see you, so the trick is
 * two turns back to back — and the game has to be forgiving about how you
 * ask for them, because mashing the dog twice is what anyone will do.
 */
describe("the sheltie's spin", () => {
  beforeEach(() => resetSpin());

  it("turns for exactly one turn and then stops", () => {
    startSpin(1000);
    expect(spinNow(1000)).toBeGreaterThan(0);
    expect(spinNow(1000 + SPIN_MS / 2)).toBeCloseTo(0.5);
    expect(spinNow(1000 + SPIN_MS - 1)).toBeLessThan(1);
    expect(spinNow(1000 + SPIN_MS)).toBe(0);
  });

  it("is never reported as zero while she is actually turning", () => {
    // the painter reads 0 as "not spinning", so the first frame must not be 0
    startSpin(1000);
    expect(spinNow(1000)).toBeGreaterThan(0);
  });

  it("counts a second tap after the first turn as the pair", () => {
    expect(startSpin(1000)).toBe(false); // nothing to pair with
    expect(startSpin(1000 + SPIN_MS + 200)).toBe(true);
  });

  it("queues a tap that lands while she is still turning", () => {
    // the natural double-tap: both land inside the first turn
    startSpin(1000);
    expect(startSpin(1200)).toBe(true);
    // and the queued turn really does run on past where one turn would end
    expect(spinNow(1000 + SPIN_MS + 100)).toBeGreaterThan(0);
  });

  it("will not let her be held into a spinning top", () => {
    startSpin(1000);
    expect(startSpin(1200)).toBe(true);
    expect(startSpin(1300)).toBe(false);
    expect(startSpin(1400)).toBe(false);
  });

  it("does not count two turns far apart", () => {
    startSpin(1000);
    expect(startSpin(1000 + QUICK_MS + 500)).toBe(false);
  });

  it("stops after the queued second turn rather than running on", () => {
    startSpin(1000);
    startSpin(1200);
    expect(spinNow(1000 + SPIN_MS * 2)).toBe(0);
  });
});
