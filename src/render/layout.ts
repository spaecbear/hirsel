/**
 * Where everything in the glen sits, for a canvas of any shape.
 *
 * The full-screen scene has no fixed resolution — the logical size comes from
 * the viewport, so a phone in portrait gets a tall hillside and a desktop gets
 * a wide one. Nothing can be drawn at hardcoded coordinates any more, so this
 * is the single place that decides where the croft, the cart, the flock and
 * the shepherd are, and it hands back the same rectangles as tap targets.
 *
 * One layout function, two consumers: the art pack draws from it and the world
 * UI hit-tests against it. They cannot disagree about where the house is.
 */
import type { GameState } from "../sim/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HotspotId =
  | "croft"
  | "cart"
  | "flock"
  | "shepherd"
  | "ground"
  | "hills"
  | "sky"
  /* inside the house */
  | "bed"
  | "hearth"
  | "door"
  | "kit";

export interface Hotspot {
  id: HotspotId;
  /**
   * One target can be several rectangles. The flock is the reason: as a
   * single bounding box it swallowed the whole field, so tapping the grass
   * between two sheep opened flock work and the pasture's own work became
   * almost unreachable. Each animal is its own small target, and the gaps
   * between them fall through to the ground underneath.
   */
  rects: Rect[];
  /** shown in the tap hint and read by screen readers */
  label: string;
}

export interface WorldLayout {
  W: number;
  H: number;
  /** tall screens get a different composition, not just a different crop */
  portrait: boolean;
  /** the skyline: where the far hills meet the sky */
  horizonY: number;
  /** where the near ground begins, below the hill band */
  groundY: number;
  croft: Rect;
  byre: Rect;
  cart: Rect;
  shepherd: { x: number; y: number };
  dog: { x: number; y: number };
  saltlick: { x: number; y: number };
  flock: { x: number; y: number }[];
  flockBox: Rect;
  hotspots: Hotspot[];
}

/**
 * How much sky you can see, by pasture. Standing higher means seeing further,
 * so the horizon drops and the sky opens up — the Low Field is hemmed in by
 * the hills, the High Corrie is mostly sky. This is the "background height
 * changes with the pasture" the scene is built around.
 */
const HORIZON_BY_PASTURE = [0.5, 0.4, 0.29];

export interface LayoutOpts {
  /** where the shepherd has walked to, if he has been sent somewhere */
  shepherdAt?: { x: number; y: number } | null;
}

export function layoutWorld(W: number, H: number, st: GameState, opts: LayoutOpts = {}): WorldLayout {
  /*
   * Orientation changes the composition, not just the crop. A desktop in
   * landscape gets a wide vista: the croft at one end, the cart at the other,
   * the flock strung out between them. A phone in portrait gets a hillside
   * receding upward, with the same things stacked in depth and more rows of
   * sheep between them. Same world, framed for the screen it is on.
   */
  const portrait = H > W * 1.15;
  /*
   * On a tall screen those fractions put half the viewport into empty sky.
   * Squash them towards the top as the canvas gets tall, so a phone gets a
   * long hillside to work rather than a lot of weather.
   */
  const tallness = clamp(H / W, 0.6, 2.2);
  // portrait: squash the sky hard, there is a lot of height to fill.
  // landscape: squash it some, or the near ground gets too shallow to work in
  // once the croft (44 tall) is standing in it.
  const squash = tallness > 1.1 ? 1 - (tallness - 1.1) * 0.42 : 0.78;
  const horizonY = Math.round(H * (HORIZON_BY_PASTURE[st.at] ?? 0.42) * clamp(squash, 0.5, 1));
  const hillBand = Math.round(H * 0.13);
  const groundY = horizonY + hillBand;
  const field = H - groundY; // the near ground, where the work happens

  // depth: things further up the hill sit higher on screen. Portrait gets a
  // long hillside to spread them down; landscape squashes the same order.
  const croftY = groundY + field * (portrait ? 0.04 : 0.06);
  const croft: Rect = { x: Math.round(W * 0.04), y: Math.round(croftY), w: 58, h: 44 };
  const byre: Rect = { x: croft.x + 60, y: Math.round(croftY) + 14, w: 36, h: 30 };
  // landscape puts the cart across the vista; portrait sets it further back
  // up the hill, where the road would come in
  const cart: Rect = {
    x: Math.round(W * (portrait ? 0.55 : 0.66)),
    y: Math.round(groundY + field * (portrait ? 0.14 : 0.24)),
    w: 62,
    h: 26,
  };

  const homeShepherd = {
    x: Math.round(W * (portrait ? 0.34 : 0.4)),
    y: Math.round(groundY + field * (portrait ? 0.66 : 0.6)),
  };
  const shepherd = opts.shepherdAt
    ? { x: Math.round(opts.shepherdAt.x), y: Math.round(opts.shepherdAt.y) }
    : homeShepherd;
  const dog = { x: shepherd.x - 26, y: shepherd.y + 16 };
  const saltlick = { x: Math.round(W * 0.18), y: Math.round(groundY + field * 0.45) };

  // the flock grazes across the middle of the field, in rows so they overlap
  // the way animals on a slope do rather than sitting on one line
  // more rows in portrait, because there is depth to spread them into
  const rows = portrait ? 4 : 3;
  const flock: { x: number; y: number }[] = [];
  const count = Math.max(1, st.flock.length);
  const cols = Math.max(1, Math.ceil(count / rows));
  const spanX = Math.max(40, W - 46);
  for (let i = 0; i < count; i++) {
    const row = i % rows;
    const col = Math.floor(i / rows);
    // rows offset by half a column, so they read as a scattered flock rather
    // than a grid, and the whole width of the hill gets used
    const step = spanX / cols;
    const spread = portrait ? 0.3 + row * 0.12 : 0.32 + row * 0.17;
    flock.push({
      x: Math.round(10 + (col + (row % 2) * 0.5) * step),
      y: Math.round(groundY + field * spread + (col % 2) * 3),
    });
  }
  /*
   * Nothing grazes through a wall. Sheep laid out on top of the croft, the
   * byre or the cart looked like they were standing in mid-air on the roof,
   * so anything landing on a building gets nudged clear of it — downhill
   * first, since that is toward the camera, then sideways if it has to be.
   */
  const solid = [croft, byre, cart].filter((r) => r.w > 0);
  for (const f of flock) {
    for (const r of solid) {
      const box = { x: f.x - 2, y: f.y - 6, w: 22, h: 20 };
      const overlaps =
        box.x < r.x + r.w + 4 && box.x + box.w > r.x - 4 && box.y < r.y + r.h + 2 && box.y + box.h > r.y - 4;
      if (!overlaps) continue;
      const below = r.y + r.h + 6;
      if (below < H - 16) f.y = below;
      else f.x = r.x > W / 2 ? Math.max(4, r.x - 26) : Math.min(W - 24, r.x + r.w + 6);
    }
  }

  const fx = flock.map((f) => f.x);
  const fy = flock.map((f) => f.y);
  const flockBox: Rect = {
    x: Math.min(...fx) - 6,
    y: Math.min(...fy) - 8,
    w: Math.max(...fx) - Math.min(...fx) + 30,
    h: Math.max(...fy) - Math.min(...fy) + 24,
  };

  /*
   * Hit-test order matters: this list is searched front to back, so the
   * small deliberate things (house, cart, the man) win over the big
   * background bands they sit inside.
   */
  const hotspots: Hotspot[] = [
    { id: "croft", rects: [pad(croft, 4)], label: "The croft" },
    { id: "cart", rects: [pad(cart, 6)], label: "The cart" },
    { id: "shepherd", rects: [{ x: shepherd.x - 10, y: shepherd.y - 8, w: 34, h: 40 }], label: "Yourself" },
    { id: "flock", rects: flock.map((f) => ({ x: f.x - 4, y: f.y - 8, w: 24, h: 24 })), label: "The flock" },
    // the hills are the band between the skyline and the near ground; the sky
    // is everything above it. They must not overlap or the one listed first
    // swallows every tap meant for the other.
    { id: "hills", rects: [{ x: 0, y: horizonY - 8, w: W, h: groundY - horizonY + 8 }], label: "The hills" },
    { id: "ground", rects: [{ x: 0, y: groundY, w: W, h: H - groundY }], label: "The pasture" },
    { id: "sky", rects: [{ x: 0, y: 0, w: W, h: Math.max(10, horizonY - 8) }], label: "The sky" },
  ];

  return { W, H, portrait, horizonY, groundY, croft, byre, cart, shepherd, dog, saltlick, flock, flockBox, hotspots };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function pad(r: Rect, n: number): Rect {
  return { x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 };
}

/** works on any laid-out scene — the hill outside or the room inside */
export function hitTest(layout: { hotspots: Hotspot[] }, x: number, y: number): Hotspot | null {
  for (const h of layout.hotspots) {
    for (const r of h.rects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return h;
    }
  }
  return null;
}

/** the box round every part of a target, for drawing the highlight */
export function boundsOf(h: Hotspot): Rect {
  const x = Math.min(...h.rects.map((r) => r.x));
  const y = Math.min(...h.rects.map((r) => r.y));
  const x2 = Math.max(...h.rects.map((r) => r.x + r.w));
  const y2 = Math.max(...h.rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}


/* ------------------------------------------------------------------ *
 * inside the house
 * ------------------------------------------------------------------ */

export interface InteriorLayout {
  W: number;
  H: number;
  /** where the floor begins */
  floorY: number;
  hearth: Rect;
  bed: Rect;
  door: Rect;
  /** the wall where bought kit gets hung up */
  shelf: Rect;
  hotspots: Hotspot[];
}

/**
 * The inside of the croft. You come in here to sleep, and everything you have
 * bought is on the walls: the point is that a purchase changes a room you
 * stand in rather than a line in a list.
 */
export function layoutInterior(W: number, H: number): InteriorLayout {
  // a tall screen gets a lower floor line, or the room is all bare boards
  const portrait = H > W * 1.15;
  const floorY = Math.round(H * (portrait ? 0.72 : 0.62));
  const bedW = Math.min(58, Math.round(W * 0.32));
  const bed: Rect = { x: Math.round(W * 0.62), y: floorY - 20, w: bedW, h: 30 };
  const hearth: Rect = { x: Math.round(W * 0.06), y: floorY - 46, w: 48, h: 50 };
  const door: Rect = { x: Math.round(W * 0.44), y: floorY - 40, w: 24, h: 44 };
  const shelf: Rect = {
    x: Math.round(W * 0.2),
    y: Math.round(H * (portrait ? 0.34 : 0.2)),
    w: Math.round(W * 0.6),
    h: 26,
  };

  return {
    W,
    H,
    floorY,
    hearth,
    bed,
    door,
    shelf,
    hotspots: [
      { id: "bed", rects: [pad(bed, 6)], label: "The bed" },
      { id: "hearth", rects: [pad(hearth, 4)], label: "The hearth" },
      { id: "door", rects: [pad(door, 4)], label: "Out to the hill" },
      { id: "kit", rects: [pad(shelf, 6)], label: "What you have" },
    ],
  };
}
