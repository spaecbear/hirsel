import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/game";
import { hitTest, layoutWorld } from "../src/render/layout";
import { haystackTiers } from "../src/render/season";

describe("the haystack as a target", () => {
  it("is there to point at while there is hay, and gone with the last bale", () => {
    for (const [W, H] of [[427, 267], [180, 390]] as const) {
      const g = Object.assign(newGame({ seed: 3 }), { hay: 40 });
      const L = layoutWorld(W, H, g, { time: 0 });
      // the middle of the stack, one tier up from its base
      expect(hitTest(L, L.haystack.x, L.haystack.y - 3)?.id, `${W}×${H}`).toBe("hay");
      g.hay = 0;
      expect(layoutWorld(W, H, g, { time: 0 }).hotspots.some((h) => h.id === "hay")).toBe(false);
    }
  });

  it("grows with the stack", () => {
    const box = (hay: number) =>
      layoutWorld(427, 267, Object.assign(newGame({ seed: 3 }), { hay }), { time: 0 }).hotspots.find((h) => h.id === "hay")!.rects[0];
    expect(box(120).h).toBeGreaterThan(box(5).h);
    expect(box(120).h).toBe(haystackTiers(120) * 4 + 6);
  });
});
