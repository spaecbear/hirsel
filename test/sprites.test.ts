import { describe, expect, it } from "vitest";
import { Painter } from "../src/render/painter";
import { drawDog } from "../src/render/sprites";

/**
 * A painter that records rectangles instead of drawing them, so a sprite can
 * be compared frame to frame without a canvas.
 */
function recorder() {
  const calls: string[] = [];
  const cx = {
    fillStyle: "",
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push(`${x},${y},${w},${h},${cx.fillStyle}`);
    },
  };
  return { painter: new Painter(cx as unknown as CanvasRenderingContext2D, 200, 200), calls };
}

const frame = (wag: number) => {
  const r = recorder();
  drawDog(r.painter, 40, 40, 0, 0, 1, wag);
  return r.calls.join("|");
};

/*
 * The tail read Date.now() itself, which made it the only motion in the
 * renderer not driven by the scene's own clock — it could not be frozen or
 * stepped the way everything else can, and a test like this one could not be
 * written at all.
 */
describe("the dog's tail runs on the scene clock", () => {
  it("is perfectly still when she is not wagging, whatever the time", () => {
    expect(frame(0)).toBe(frame(0));
  });

  it("moves as the clock moves", () => {
    // a quarter of a sweep apart: the tail is at a different height
    expect(frame(1000)).not.toBe(frame(1000 + 120));
  });

  it("comes back round to the same place one sweep later", () => {
    // sin(t / 78), so a full period is 2π × 78 ≈ 490ms
    const period = 2 * Math.PI * 78;
    expect(frame(1000)).toBe(frame(1000 + period));
  });

  it("is the same drawing at the same clock, every time", () => {
    expect(frame(4321)).toBe(frame(4321));
  });
});
