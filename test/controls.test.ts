import { describe, expect, it } from "vitest";
import { keyIntent, PadReader, REPEAT_EVERY, REPEAT_FIRST, stickDir, type PadLike } from "../src/ui/controls";
import { nearestInDirection, type Box } from "../src/ui/spatial";

function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadLike {
  return { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes };
}

describe("keys", () => {
  it("move with the arrows and with WASD, choose with Enter or Space, back with Escape", () => {
    expect(["ArrowUp", "w", "W"].map(keyIntent)).toEqual(["up", "up", "up"]);
    expect(["ArrowLeft", "a"].map(keyIntent)).toEqual(["left", "left"]);
    expect(["ArrowDown", "s"].map(keyIntent)).toEqual(["down", "down"]);
    expect(["ArrowRight", "d"].map(keyIntent)).toEqual(["right", "right"]);
    expect(["Enter", " "].map(keyIntent)).toEqual(["confirm", "confirm"]);
    expect(["Escape", "Backspace"].map(keyIntent)).toEqual(["back", "back"]);
    expect(keyIntent("f")).toBe("sky");
    expect(keyIntent("q")).toBeNull();
    expect(keyIntent("Tab")).toBeNull(); // left to the browser
  });
});

describe("the pad", () => {
  it("fires a button once when it goes down, not every frame it is held", () => {
    const r = new PadReader();
    expect(r.read(pad([0]), 0).intents).toEqual(["confirm"]);
    expect(r.read(pad([0]), 16).intents).toEqual([]);
    expect(r.read(pad([]), 32).intents).toEqual([]);
    expect(r.read(pad([0]), 48).intents).toEqual(["confirm"]);
  });

  it("maps B to back, Start to the menu and View to the sky", () => {
    const r = new PadReader();
    expect(r.read(pad([1, 9, 8]), 0).intents.sort()).toEqual(["back", "menu", "sky"]);
  });

  it("repeats a held direction the way a held key does", () => {
    const r = new PadReader();
    expect(r.read(pad([13]), 0).intents).toEqual(["down"]);
    expect(r.read(pad([13]), REPEAT_FIRST - 1).intents).toEqual([]);
    expect(r.read(pad([13]), REPEAT_FIRST).intents).toEqual(["down"]);
    expect(r.read(pad([13]), REPEAT_FIRST + REPEAT_EVERY - 1).intents).toEqual([]);
    expect(r.read(pad([13]), REPEAT_FIRST + REPEAT_EVERY).intents).toEqual(["down"]);
  });

  it("reads the left stick as a direction, past a deadzone, and the d-pad over it", () => {
    expect(stickDir(0.2, 0.1)).toBeNull();
    expect(stickDir(0.9, 0.2)).toBe("right");
    expect(stickDir(-0.1, -0.8)).toBe("up");
    const r = new PadReader();
    expect(r.read(pad([14], [0.9, 0, 0, 0]), 0).intents).toEqual(["left"]);
  });

  it("hands the right stick over for walking, and nothing when it rests", () => {
    const r = new PadReader();
    expect(r.read(pad([], [0, 0, 0.8, -0.2]), 0).walk).toEqual({ x: 0.8, y: -0.2 });
    expect(r.read(pad([], [0, 0, 0.05, 0.05]), 16).walk).toBeNull();
  });

  it("knows when it has been picked up", () => {
    expect(PadReader.active(pad())).toBe(false);
    expect(PadReader.active(pad([2]))).toBe(true);
    expect(PadReader.active(pad([], [0.9, 0, 0, 0]))).toBe(true);
  });
});

describe("picking the next thing in a direction", () => {
  const at = (x: number, y: number, w = 10, h = 10): Box => ({ x, y, w, h });
  const cands = (boxes: Record<string, Box>) => Object.entries(boxes).map(([id, box]) => ({ id, box }));

  it("takes the thing under you over something lower and far to the side", () => {
    const from = at(100, 100);
    const got = nearestInDirection(from, cands({ under: at(105, 140), wide: at(300, 120) }), "down");
    expect(got?.id).toBe("under");
  });

  it("ignores anything level with you, so a row does not answer down with its neighbour", () => {
    const from = at(100, 100);
    expect(nearestInDirection(from, cands({ beside: at(130, 101) }), "down")).toBeNull();
    expect(nearestInDirection(from, cands({ beside: at(130, 101) }), "right")?.id).toBe("beside");
  });

  it("finds nothing past the edge", () => {
    const from = at(0, 0);
    expect(nearestInDirection(from, cands({ a: at(50, 50) }), "up")).toBeNull();
    expect(nearestInDirection(from, cands({ a: at(50, 50) }), "left")).toBeNull();
  });

  it("works in all four directions over a grid", () => {
    const grid = cands({ n: at(50, 0), s: at(50, 100), w: at(0, 50), e: at(100, 50) });
    const from = at(50, 50);
    expect(nearestInDirection(from, grid, "up")?.id).toBe("n");
    expect(nearestInDirection(from, grid, "down")?.id).toBe("s");
    expect(nearestInDirection(from, grid, "left")?.id).toBe("w");
    expect(nearestInDirection(from, grid, "right")?.id).toBe("e");
  });
});
