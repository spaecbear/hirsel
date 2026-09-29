import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/game";
import { FLOCK_SPOT, layoutWorld } from "../src/render/layout";
import type { GameState, Sheep } from "../src/sim/types";

const sheep = (n: number): Sheep[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, fleece: 3, breed: "blackface", age: 0 }));

/** the screens the glen is laid out for, in logical pixels: desktop, wide, a phone, a tall phone */
const SCREENS = [
  [427, 267],
  [480, 270],
  [180, 390],
  [213, 460],
] as const;

function run(seed: number, patch: Partial<GameState> = {}) {
  return Object.assign(newGame({ seed }), { flock: sheep(8) }, patch);
}

const centreOf = (pts: { x: number; y: number }[]) => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});

describe("where the flock grazes", () => {
  it("is the same every time a run is loaded", () => {
    const a = layoutWorld(427, 267, run(42), { time: 0 }).flock;
    const b = layoutWorld(427, 267, run(42), { time: 0 }).flock;
    expect(a).toEqual(b);
  });

  it("is somewhere different from run to run, across the field", () => {
    const xs = Array.from({ length: 60 }, (_, i) => centreOf(layoutWorld(427, 267, run(1000 + i * 31), { time: 0 }).flock).x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeGreaterThan(427 * 0.25);
    expect(new Set(xs.map((x) => Math.round(x / 10))).size).toBeGreaterThan(6);
  });

  it("moves when they are moved to other ground", () => {
    const low = centreOf(layoutWorld(427, 267, run(7, { at: 0 }), { time: 0 }).flock);
    const high = centreOf(layoutWorld(427, 267, run(7, { at: 2 }), { time: 0 }).flock);
    expect(low).not.toEqual(high);
  });

  it("does not send the flock across the field when one is bought", () => {
    const few = centreOf(layoutWorld(427, 267, run(9, { flock: sheep(6) }), { time: 0 }).flock);
    const more = centreOf(layoutWorld(427, 267, run(9, { flock: sheep(7) }), { time: 0 }).flock);
    expect(Math.abs(few.x - more.x)).toBeLessThan(12);
    expect(Math.abs(few.y - more.y)).toBeLessThan(12);
  });

  it("keeps clear of the croft and the cart, off him but within reach of him, on every screen", () => {
    for (const [W, H] of SCREENS) {
      for (let i = 0; i < 40; i++) {
        for (const at of [0, 1, 2]) {
          const L = layoutWorld(W, H, run(500 + i * 17, { at }), { time: 0 });
          const c = centreOf(L.flock);
          const him = { x: L.shepherd.x, y: L.shepherd.y };
          const d = Math.hypot(c.x - him.x, c.y - him.y);
          const where = `${W}×${H} seed ${500 + i * 17} pasture ${at}`;
          expect(d, where).toBeGreaterThan(W * FLOCK_SPOT.nearestToHim * 0.6);
          expect(d, where).toBeLessThan(W * FLOCK_SPOT.furthestFromHim * 1.3);
          // no sheep's mark inside the croft, the byre or the cart
          for (const f of L.flock) {
            for (const r of [L.croft, L.byre, L.cart]) {
              const inside = f.x + 8 > r.x && f.x + 8 < r.x + r.w && f.y + 6 > r.y && f.y + 6 < r.y + r.h;
              expect(inside, `${where}: a sheep on a building`).toBe(false);
            }
          }
          // and every one of them in the frame, on the near ground
          for (const f of L.flock) {
            expect(f.x, where).toBeGreaterThanOrEqual(0);
            expect(f.x, where).toBeLessThanOrEqual(W - 16);
            expect(f.y, where).toBeGreaterThan(L.groundY);
            expect(f.y, where).toBeLessThan(H);
          }
        }
      }
    }
  });
});
