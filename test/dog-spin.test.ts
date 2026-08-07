import { beforeEach, describe, expect, it } from "vitest";
import { QUICK_MS, SPIN_MS, resetSpin, spinNow, startSpin } from "../src/render/dog-spin";

/*
 * Arrow's two turns. This has been wrong twice — first because a tap landing
 * mid-turn was dropped, so mashing her did nothing, and then because the bark
 * the tap sets off made the world busy for longer than the window the second
 * turn had to land in. The logic is small and pure, so it gets pinned here.
 */
describe("the sheltie's spin", () => {
  beforeEach(() => resetSpin());

  it("turns once for one tap, and says it is not a pair", () => {
    expect(startSpin(1000)).toBe(false);
    expect(spinNow(1000)).toBeGreaterThan(0);
    expect(spinNow(1000 + SPIN_MS / 2)).toBeCloseTo(0.5, 1);
    expect(spinNow(1000 + SPIN_MS)).toBe(0);
  });

  it("queues a tap that lands while she is still turning", () => {
    startSpin(1000);
    // the obvious way anyone tries this: two taps in quick succession
    expect(startSpin(1200)).toBe(true);
    // and the second turn runs on from the first rather than restarting it
    expect(spinNow(1000 + SPIN_MS + 10)).toBeGreaterThan(0);
    expect(spinNow(1000 + SPIN_MS * 2)).toBe(0);
  });

  it("counts a second turn taken just after the first as a pair", () => {
    startSpin(1000);
    expect(startSpin(1000 + SPIN_MS + 100)).toBe(true);
  });

  it("will not be wound up into a spinning top", () => {
    startSpin(1000);
    expect(startSpin(1100)).toBe(true);
    expect(startSpin(1200)).toBe(false);
    expect(startSpin(1300)).toBe(false);
  });

  it("is not a pair once she has had time to settle", () => {
    startSpin(1000);
    expect(startSpin(1000 + QUICK_MS + 1)).toBe(false);
  });
});
