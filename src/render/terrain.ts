/**
 * The three pastures as three real places.
 *
 * They were the same hillside in three tints, which made moving the flock a
 * number change rather than a journey. Each is now drawn from somewhere:
 *
 *  Low Field    Rannoch Moor. Flat wet bog, a burn winding through tussocks
 *               and rushes, and dark hills with the cloud sitting down on
 *               them. Hemmed in — you cannot see out of it.
 *  Hill Slope   A glen in heather. Ridge behind ridge going back into haze,
 *               each one paler than the last, purple banks on the slope.
 *  High Corrie  The Quiraing. Tawny gold grass over stepped rock terraces,
 *               with the land dropping away and a great deal of sky. You are
 *               above the weather here rather than under it.
 *
 * Atmospheric perspective does most of the work: on the slope each ridge is
 * mixed further toward the sky colour, which is what makes distance read.
 */
import type { Painter } from "./painter";
import { C, hash, shade } from "./sprites";

export interface TerrainProfile {
  /** turf colours, dark to light */
  grass: [string, string, string];
  /** the same ground when the grass has been eaten down */
  dry: [string, string, string];
  /** the near hill band behind the field */
  hill: string;
  /** the far tops */
  far: string;
}

export const TERRAIN: TerrainProfile[] = [
  {
    // wet moor green, dark and a little blue from standing water
    grass: ["#46603a", "#547040", "#65834a"],
    dry: ["#4c5638", "#5a6440", "#6b7449"],
    hill: "#33422c",
    far: "#3d4750",
  },
  {
    // hill grass going over to heather
    grass: ["#54683a", "#647842", "#77894d"],
    dry: ["#5a5c38", "#6a6c40", "#7b7d4a"],
    hill: "#3a4a30",
    far: "#4a5260",
  },
  {
    // the tawny gold of high ground in late summer
    grass: ["#7a6c3a", "#8e7e44", "#a89552"],
    dry: ["#6e6238", "#807044", "#96854e"],
    hill: "#6a6242",
    far: "#555c66",
  },
];

/* ------------------------------------------------------------------ *
 * the far tops
 * ------------------------------------------------------------------ */

/** cloud sitting down on the hills, the way it does over the moor */
export function drawCloudCap(g: Painter, W: number, capY: number, time: number) {
  /*
   * Cloud lying *on* the tops, not a row of boxes above them. Many small
   * overlapping puffs at low alpha build up into something soft, and the
   * band is thickest in the middle so it looks caught on the summits rather
   * than ruled across them.
   */
  for (let i = 0; i < 70; i++) {
    const drift = Math.sin(time / 6000 + i * 0.7) * 4;
    const x = ((i * 29) % (W + 40)) - 20 + drift;
    const across = Math.abs((x / W) * 2 - 1); // 0 mid-screen, 1 at the edges
    const sag = Math.round((1 - across) * -3);
    const y = capY + sag + Math.round((hash(i * 5) - 0.5) * 13);
    const w = 6 + Math.round(hash(i * 3) * 14);
    const h = 2 + Math.round(hash(i * 7) * 4);
    g.a(x, y, w, h, 214, 218, 216, 0.13);
    if (hash(i * 11) > 0.45) g.a(x + 1, y - 1, Math.max(2, w - 4), Math.max(1, h - 1), 232, 235, 232, 0.11);
  }
}

/**
 * Ridge behind ridge, each mixed further toward the sky. The slope's whole
 * character is depth, so the ridges have to actually recede rather than just
 * stack up in the same colour.
 */
export function drawLayeredRidges(g: Painter, W: number, horizonY: number, base: string, skyLow: string, layers = 4) {
  for (let l = layers - 1; l >= 0; l--) {
    const depth = l / Math.max(1, layers - 1); // 1 = furthest back
    const col = mix(base, skyLow, depth * 0.62);
    const lit = shade(col, 12);
    const top = horizonY - 4 - l * 7;
    const amp = 5 + l * 3;
    for (let x = 0; x < W; x += 2) {
      const y = top + Math.round(Math.sin(x / (34 + l * 19) + l * 2.1) * amp + Math.sin(x / 11) * 1.5);
      g.px(x, y, 2, horizonY + 10 - y, col);
      g.px(x, y, 2, 1, lit);
    }
  }
}

/** the stepped terraces of an escarpment, seen from up on it */
export function drawTerraces(g: Painter, W: number, horizonY: number, groundY: number, base: string) {
  const bands = 3;
  for (let b = 0; b < bands; b++) {
    const top = horizonY + Math.round(((groundY - horizonY) * b) / bands);
    const col = shade(base, b * 8);
    for (let x = 0; x < W; x += 2) {
      const wob = Math.round(Math.sin(x / (40 - b * 8) + b * 1.7) * (4 - b));
      const y = top + wob;
      g.px(x, y, 2, Math.round((groundY - horizonY) / bands) + 4, col);
      // the lip of each terrace catches the light hard and drops a shadow
      // under it — that edge is the whole reason an escarpment reads as one
      g.px(x, y, 2, 2, shade(col, 34));
      g.px(x, y + 2, 2, 1, shade(col, -30));
      // grass holds on along the top of each step, bare rock breaks through
      if (hash(x + b * 41) > 0.55) g.px(x, y, 2, 1, shade("#8e8144", b * 6));
      if (hash(x + b * 90) > 0.88) g.px(x, y + 3, 2, 4, C.rockLit);
    }
  }
}

/* ------------------------------------------------------------------ *
 * what is underfoot
 * ------------------------------------------------------------------ */

/**
 * The burn: a thread of water winding down through the bog, widening as it
 * comes toward you. It is the thing that makes the Low Field read as wet
 * ground rather than a lawn.
 */
export function drawBurn(g: Painter, W: number, groundY: number, H: number, time: number) {
  const top = groundY + 2;
  const span = Math.max(1, H - top);
  for (let y = top; y < H; y++) {
    const t = (y - top) / span;
    /*
     * Two meanders of different lengths, so it wanders like water finding its
     * way rather than running off at an angle. A single sine over a short
     * field just reads as a diagonal stick.
     */
    const wander = Math.sin(t * 5.6) * 0.11 + Math.sin(t * 2.1 + 1.4) * 0.07;
    const cx = W * (0.28 + wander);
    // it widens hard as it comes towards you — that is what gives it depth
    const w = Math.max(2, Math.round(1 + Math.pow(t, 1.4) * 11));
    const x0 = Math.round(cx - w / 2);
    g.px(x0 - 1, y, 1, 1, "#3b3324"); // peat-stained banks
    g.px(x0 + w, y, 1, 1, "#3b3324");
    g.px(x0, y, w, 1, C.water);
    // the light catches the riffles, and the far end is paler with sky in it
    if (Math.sin(y / 3.5 + time / 600) > 0.45) {
      g.px(x0 + 1, y, Math.max(1, w - 2), 1, C.waterLit);
    }
    if (t < 0.25) g.a(x0, y, w, 1, 150, 170, 180, 0.35);
  }
}

/**
 * Broad patches of lighter and darker ground. Real hillside is never one
 * colour — it is drier here, wetter there, and without this the field reads
 * as a painted floor no matter how much detail sits on top of it.
 */
export function drawMottle(g: Painter, W: number, groundY: number, H: number, pal: [string, string, string]) {
  const span = H - groundY;
  for (let i = 0; i < 22; i++) {
    const x = Math.round(hash(i * 1.9) * W) - 20;
    const y = groundY + Math.round(hash(i * 4.1) * span);
    const w = 24 + Math.round(hash(i * 6.7) * 46);
    const h = 6 + Math.round(hash(i * 8.3) * 14);
    const lighter = hash(i * 12.1) > 0.5;
    const col = lighter ? pal[2] : pal[0];
    // soft-edged by stepping the width in, rather than one hard rectangle
    for (let b = 0; b < 3; b++) {
      g.a(
        x + b * 3,
        y + b,
        Math.max(2, w - b * 6),
        Math.max(1, h - b * 2),
        parseInt(col.slice(1, 3), 16),
        parseInt(col.slice(3, 5), 16),
        parseInt(col.slice(5, 7), 16),
        0.1,
      );
    }
  }
}

/** tussocks and rushes: the clumpy, ankle-turning cover of a wet moor */
export function drawTussocks(g: Painter, W: number, groundY: number, H: number, pal: TerrainProfile["grass"]) {
  const span = H - groundY;
  for (let i = 0; i < 90; i++) {
    const x = Math.round(hash(i * 2.3) * W);
    const y = groundY + 4 + Math.round(hash(i * 5.1) * (span - 6));
    const h = 3 + Math.round(hash(i * 7.7) * 4);
    g.px(x, y - h, 2, h, pal[2]);
    g.px(x + 2, y - h + 1, 2, h - 1, pal[1]);
    g.px(x - 1, y, 5, 2, shade(pal[0], -8));
    if (hash(i * 11) > 0.72) {
      // rushes standing above the clump
      g.px(x + 1, y - h - 3, 1, 3, "#8a8a4e");
      g.px(x + 3, y - h - 2, 1, 2, "#7a7a44");
    }
  }
}

/** peat pools lying in the hollows, dark and rimmed */
export function drawPools(g: Painter, W: number, groundY: number, H: number) {
  const span = H - groundY;
  /*
   * Fewer, darker and narrower than they were. As bright slabs sitting on
   * flat grass they read as floating rectangles rather than water lying in
   * a hollow — the ground has to close over the ends of them.
   */
  for (let i = 0; i < 5; i++) {
    const x = Math.round(hash(i * 17) * (W - 26));
    const y = groundY + 10 + Math.round(hash(i * 23) * (span - 20));
    const w = 7 + Math.round(hash(i * 5) * 9);
    g.px(x - 2, y - 1, w + 4, 4, "#41432f"); // the wet ground round it
    g.px(x, y, w, 2, "#33454e"); // peat-dark standing water
    g.px(x + 2, y, w - 5, 1, "#4a6470"); // just a little sky in it
    g.px(x - 2, y + 3, w + 4, 1, "#4a5238"); // grass closing over the near edge
  }
}

/**
 * Heather.
 *
 * It used to be flat rectangles with a lit top edge and a dark bottom, which
 * is exactly how the scree in the same file is drawn — so it read as purple
 * rocks lying on the grass. Real heather is a low mat of tiny flowers: no
 * hard edge anywhere, a spread of speckle over a darker base, in banks rather
 * than scattered evenly. This draws the bank first and stipples the bloom
 * over it, so there is no silhouette to mistake for a stone.
 */
const BLOOM = ["#9a6fa8", "#8a6a9c", "#a87fb4", "#7d5e91"];

export function drawHeather(g: Painter, W: number, groundY: number, H: number, density = 1) {
  const span = H - groundY;
  const banks = Math.max(4, Math.round(10 * density));

  for (let b = 0; b < banks; b++) {
    // where this bank of it lies, and how far it spreads
    const cx = hash(b * 4.1) * W;
    const cy = groundY + 4 + hash(b * 7.3) * (span - 8);
    const rx = 18 + hash(b * 9.7) * 34;
    const ry = 4 + hash(b * 11.3) * 7;

    // the woody base it grows out of, dark and soft-edged
    for (let i = 0; i < 40; i++) {
      const a = hash(b * 100 + i) * Math.PI * 2;
      const r = Math.sqrt(hash(b * 200 + i));
      const x = Math.round(cx + Math.cos(a) * rx * r);
      const y = Math.round(cy + Math.sin(a) * ry * r);
      g.px(x, y, 2, 1, "#4a4436");
    }
    // the bloom: single pixels, thickest in the middle of the bank
    for (let i = 0; i < 130; i++) {
      const a = hash(b * 300 + i) * Math.PI * 2;
      const r = Math.pow(hash(b * 400 + i), 0.7);
      const x = Math.round(cx + Math.cos(a) * rx * r);
      const y = Math.round(cy + Math.sin(a) * ry * r);
      const tone = BLOOM[Math.floor(hash(b * 500 + i) * BLOOM.length)];
      g.px(x, y, 1, 1, tone);
      // the odd taller sprig standing proud of the mat
      if (hash(b * 600 + i) > 0.93) g.px(x, y - 1, 1, 1, "#b98fc4");
    }
  }
}

/** scree and broken rock, for ground that is more stone than soil */
export function drawScree(g: Painter, W: number, groundY: number, H: number) {
  const span = H - groundY;
  for (let i = 0; i < 26; i++) {
    const x = Math.round(hash(i * 3) * (W - 14));
    const y = groundY + 3 + Math.round(hash(i * 5) * (span - 8));
    const w = 4 + Math.round(hash(i * 7) * 7);
    g.px(x, y, w, 4, C.rock);
    g.px(x, y, w, 2, C.rockLit);
    g.px(x, y + 4, w, 1, C.rockDark);
  }
}

/* ------------------------------------------------------------------ */

/** blend two hex colours; `t` of 0 keeps `a`, 1 gives `b` */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * t) & 255;
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
