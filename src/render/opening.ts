/**
 * The day you walked out. Runs once, at the start of a new run, and can be
 * skipped with a tap or a key.
 *
 * Four beats, and they take their time, because the whole of the game is
 * what he walked out of the office for:
 *
 *  1. the office at dusk: rain on the glass, the city lit behind it, a desk
 *     with a spreadsheet glowing on it. He puts the envelope in the tray,
 *     stands, and goes. He is in a suit here, the only time he ever is
 *  2. the sleeper north: the carriage window, the city lights running out,
 *     the dark, and the dawn coming up over moor and loch
 *  3. the climb: a long, slow walk up the hill in his coat and bunnet,
 *     with one stop halfway to look back the way he came
 *  4. over the crest: the glen opens out below him, the burn and the old
 *     croft and a few sheep, and the name of the game comes up over it
 *
 * The words (the captions, the quote and the title) are DOM text over the
 * canvas, like every other line in the game; see updateCaption in main.ts,
 * which reads OPENING to know when each one shows.
 */
import { clamp01, ease, type Painter } from "./painter";
import { drawSheep, drawShepherd, hash } from "./sprites";

/** where each beat starts and ends, as a fraction of the scene */
export const OPENING = {
  office: [0, 0.25],
  train: [0.25, 0.42],
  climb: [0.42, 0.81],
  crest: [0.81, 1],
} as const;

/**
 * The line over the climb. Burns, from 1789: a Highland song by a lowland
 * poet, about a man who is somewhere else and wishes he were not. It is the
 * office he is leaving, said on the hill he is walking up.
 */
export const OPENING_QUOTE = "My heart's in the Highlands, my heart is not here.\nRobert Burns";

type Beat = keyof typeof OPENING;

/** how far through a beat p is, 0 to 1 */
const through = (p: number, b: Beat) => clamp01((p - OPENING[b][0]) / (OPENING[b][1] - OPENING[b][0]));

export function drawOpening(g: Painter, W: number, H: number, p: number, time: number) {
  if (p < OPENING.office[1]) office(g, W, H, through(p, "office"), time);
  else if (p < OPENING.train[1]) train(g, W, H, through(p, "train"), time);
  else if (p < OPENING.climb[1]) climb(g, W, H, through(p, "climb"), time);
  else crest(g, W, H, through(p, "crest"), time);
}

/* ------------------------------------------------------------------ *
 * shared
 * ------------------------------------------------------------------ */

/** fade from and to black at the edges of a beat */
function fadeEdges(g: Painter, W: number, H: number, t: number, inFor = 0.08, outFor = 0.08) {
  const a = Math.max(t < inFor ? 1 - t / inFor : 0, t > 1 - outFor ? (t - (1 - outFor)) / outFor : 0);
  if (a > 0) g.a(0, 0, W, H, 0, 0, 0, Math.min(1, a));
}

/** a sky in flat bands, top colour to bottom, with a dithered seam between each */
function sky(g: Painter, x: number, y: number, w: number, h: number, top: [number, number, number], low: [number, number, number], bands = 7) {
  const bh = Math.ceil(h / bands);
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const c = top.map((v, j) => Math.round(v + (low[j] - v) * k));
    g.a(x, y + i * bh, w, bh, c[0], c[1], c[2], 1);
    if (i > 0) {
      const prev = top.map((v, j) => Math.round(v + (low[j] - v) * ((i - 1) / (bands - 1))));
      for (let xx = x; xx < x + w; xx += 2) g.a(xx + (i % 2), y + i * bh, 1, 1, prev[0], prev[1], prev[2], 1);
    }
  }
}

/** a ridge line across the screen, filled below. `seed` keeps each one its own shape */
function ridge(
  g: Painter, W: number, H: number, baseY: number, amp: number, seed: number, scroll: number, c: string, edge?: string, jag = 1,
) {
  for (let x = 0; x < W; x += 2) {
    const u = x + scroll;
    const y = Math.round(
      baseY - Math.abs(Math.sin(u / (61 + seed * 7) + seed)) * amp * jag - Math.sin(u / (23 + seed * 3)) * amp * 0.25 - Math.sin(u / 9) * jag,
    );
    g.px(x, y, 2, H - y, c);
    if (edge) g.px(x, y, 2, 1, edge);
  }
}

/** a round blob of colour, row by row */
function disc(g: Painter, cx: number, cy: number, r: number, red: number, gr: number, b: number, a: number) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half > 0) g.a(cx - half, cy + dy, half * 2, 1, red, gr, b, a);
  }
}

/** a soft cloud: a few overlapping flat ellipses */
function cloud(g: Painter, x: number, y: number, w: number, r: number, gr: number, b: number, a: number) {
  const h = Math.max(3, Math.round(w / 6));
  g.a(x, y, w, h, r, gr, b, a);
  g.a(x + w * 0.15, y - h * 0.6, w * 0.45, h * 0.8, r, gr, b, a);
  g.a(x + w * 0.45, y - h * 0.9, w * 0.35, h, r, gr, b, a);
}

/**
 * Him in the office: suit and tie, no bunnet. The only time he is drawn
 * like this. Built on the same 12x26 frame as the shepherd, so the figure
 * that walks out of the door is plainly the one that walks up the hill.
 */
function drawClerk(g: Painter, x: number, y: number, o: { walk?: number; facing?: 1 | -1 } = {}) {
  const step = o.walk ? (Math.sin(o.walk * Math.PI * 8) > 0 ? 1 : 0) : 0;
  const flip = o.facing === -1;
  const px = (dx: number, dy: number, w: number, h: number, c: string) => g.px(flip ? x + 12 - dx - w : x + dx, y + dy, w, h, c);
  g.a(x - 1, y + 26, 14, 2, 0, 0, 0, 0.25);
  px(1, 23, 4, 3, "#16181b"); // shoes
  px(7, 23 - step, 4, 3, "#16181b");
  px(1, 15, 10, 9, "#33363c"); // trousers
  px(5, 17, 2, 7, "#2a2d32");
  px(0, 6, 12, 11, "#4a4f57"); // the jacket
  px(0, 6, 12, 1, "#5a606a");
  px(4, 6, 4, 5, "#d9d6cc"); // shirt
  px(5, 7, 2, 6, "#8a2f2a"); // the tie
  px(3, 6, 1, 6, "#3d4249"); // lapels
  px(8, 6, 1, 6, "#3d4249");
  px(2, 0, 8, 6, "#c9a583"); // head
  if (o.facing) {
    px(8, 2, 1, 1, "#26201a");
    px(2, -1, 8, 2, "#3a2b1f"); // hair, short and kept
    px(2, 0, 2, 3, "#3a2b1f");
  } else {
    px(3, 2, 1, 1, "#26201a");
    px(7, 2, 1, 1, "#26201a");
    px(2, -1, 8, 2, "#3a2b1f");
    px(2, 0, 1, 2, "#3a2b1f");
    px(9, 0, 1, 2, "#3a2b1f");
  }
}

/* ------------------------------------------------------------------ *
 * 1. the office
 * ------------------------------------------------------------------ */

function office(g: Painter, W: number, H: number, t: number, time: number) {
  const floorY = Math.round(H * 0.7);
  // the room: a back wall the colour of nothing in particular, and carpet
  g.px(0, 0, W, floorY, "#2b3036");
  g.px(0, floorY, W, H - floorY, "#22262a");
  for (let y = floorY + 3; y < H; y += 4) g.a(0, y, W, 1, 0, 0, 0, 0.12);

  // the window: the city at dusk, behind the rain
  const wx = Math.round(W * 0.34);
  const wy = Math.round(H * 0.07);
  const ww = Math.round(W * 0.6);
  const wh = Math.round(floorY * 0.62);
  sky(g, wx, wy, ww, wh, [22, 28, 42], [74, 64, 78], 6);
  for (let i = 0, x = wx; x < wx + ww; i++) {
    const bw = 10 + Math.floor(hash(i * 3.7) * 22);
    const bh = Math.round(wh * (0.25 + hash(i * 9.1) * 0.6));
    const by = wy + wh - bh;
    g.px(x, by, bw - 1, bh, i % 3 ? "#151a22" : "#1a2029");
    // lit windows, a few going out as the evening goes on
    for (let yy = by + 3; yy < wy + wh - 2; yy += 4) {
      for (let xx = x + 2; xx < x + bw - 3; xx += 4) {
        const h = hash(xx * 1.3 + yy * 7.7);
        if (h > 0.62 && h - t * 0.15 > 0.62) g.px(xx, yy, 2, 2, h > 0.86 ? "#8fa7bd" : "#d9b866");
      }
    }
    x += bw;
  }
  // rain running down the glass
  for (let i = 0; i < 40; i++) {
    const rx = wx + Math.floor(hash(i * 5.3) * ww);
    const ry = wy + ((hash(i * 2.1) * wh + time * (0.04 + hash(i) * 0.05)) % wh);
    g.a(rx, ry, 1, 3, 180, 200, 215, 0.35);
  }
  g.a(wx, wy, ww, wh, 120, 140, 160, 0.06); // the glass itself
  // the frame and its mullions
  g.px(wx - 2, wy - 2, ww + 4, 2, "#1d2126");
  g.px(wx - 2, wy + wh, ww + 4, 3, "#1d2126");
  g.px(wx - 2, wy, 2, wh, "#1d2126");
  g.px(wx + ww, wy, 2, wh, "#1d2126");
  for (let k = 1; k < 3; k++) g.px(wx + Math.round((ww * k) / 3), wy, 2, wh, "#1d2126");

  // the strip light, buzzing, and once in a while not quite on
  const flick = hash(Math.floor(time / 70)) > 0.96 ? 0.4 : 1;
  g.px(Math.round(W * 0.2), 2, Math.round(W * 0.6), 2, "#cfd8d6");
  for (let i = 1; i <= 3; i++) {
    g.a(Math.round(W * (0.2 - i * 0.03)), 4, Math.round(W * (0.6 + i * 0.06)), i * 6, 210, 225, 220, 0.025 * flick);
  }

  // the door out, on the left, with its green sign over it
  const dx = Math.round(W * 0.05);
  const dw = Math.max(18, Math.round(W * 0.09));
  const dh = Math.round(floorY * 0.62);
  const dy = floorY - dh;
  const open = ease(clamp01((t - 0.74) / 0.1));
  g.px(dx - 2, dy - 2, dw + 4, dh + 2, "#1d2126");
  g.px(dx, dy, dw, dh, "#0d0f12"); // the dark of the stairwell
  g.px(dx, dy, Math.round(dw * (1 - open * 0.8)), dh, "#4a3b2c"); // the door, swinging in
  g.px(dx + Math.round(dw * (1 - open * 0.8)) - 3, dy + dh / 2, 2, 2, "#b5a46a");
  g.px(dx + dw / 2 - 5, dy - 7, 10, 4, "#1f6b45");
  g.a(dx + dw / 2 - 8, dy - 9, 16, 8, 60, 200, 120, 0.08);

  // the partitions, and somebody else's screen still on over one
  const py = floorY - Math.round(H * 0.14);
  const px0 = Math.round(W * 0.22);
  g.px(px0, py, W - px0, floorY - py, "#3a424b");
  g.px(px0, py, W - px0, 1, "#4d5762");
  for (let x = px0; x < W; x += 46) g.px(x, py, 1, floorY - py, "#2f363d");
  g.a(Math.round(W * 0.8), py - 8, 22, 8, 120, 170, 200, 0.18);

  // him
  const sitX = Math.round(W * 0.36);
  const deskY = Math.round(H * 0.74);
  const rise = ease(clamp01((t - 0.5) / 0.1));
  const walkT = clamp01((t - 0.62) / 0.24);
  const doorX = dx + dw / 2 - 6;
  const hx = sitX + (doorX - sitX) * ease(walkT);
  const hy = deskY - 18 - rise * 6 + walkT * 0;
  const gone = t > 0.88;
  const walking = walkT > 0 && walkT < 1;

  // the desk, in front of him: monitor, keyboard, a mug, a stack of files
  const dX = Math.round(W * 0.26);
  const dW = Math.round(W * 0.42);
  const behind = () => {
    if (gone) return;
    if (walkT > 0) drawClerk(g, Math.round(hx), Math.round(hy + walkT * 6), { walk: walking ? time / 120 : 0, facing: -1 });
    else drawClerk(g, sitX, Math.round(hy), {});
  };
  // he is behind the desk while he sits; once he is up and away he passes in front of it
  if (walkT < 0.25) behind();
  g.px(dX, deskY, dW, 4, "#6a5d4c");
  g.px(dX, deskY, dW, 1, "#7d7060");
  g.px(dX + 2, deskY + 4, dW - 4, H - deskY - 4, "#4d4438");
  // the monitor and its spreadsheet, glowing at him
  const mx = Math.round(W * 0.47);
  const my = deskY - 22;
  g.px(mx, my, 30, 20, "#1b1e22");
  g.px(mx + 2, my + 2, 26, 15, "#a9c9d3");
  for (let r = 0; r < 5; r++) g.px(mx + 2, my + 4 + r * 3, 26, 1, "#7f9eaa");
  for (let c = 0; c < 4; c++) g.px(mx + 8 + c * 6, my + 2, 1, 15, "#7f9eaa");
  g.px(mx + 13, my + 20, 4, 3, "#1b1e22");
  g.a(mx - 4, my - 3, 38, 26, 150, 200, 220, 0.04);
  g.px(mx + 2, deskY - 2, 22, 2, "#2a2d31"); // keyboard
  g.px(dX + 8, deskY - 6, 6, 6, "#c8c2b0"); // the mug
  g.px(dX + 14, deskY - 4, 2, 3, "#c8c2b0");
  g.px(dX + dW - 30, deskY - 10, 14, 10, "#7a6a4c"); // files
  g.px(dX + dW - 30, deskY - 12, 14, 2, "#8a7a5a");
  // the in-tray, and the envelope travelling to it
  const tx = dX + dW - 14;
  g.px(tx, deskY - 4, 12, 4, "#3a3e44");
  g.px(tx + 1, deskY - 5, 10, 1, "#d9d6cc");
  const slide = ease(clamp01((t - 0.18) / 0.22));
  if (t > 0.12) {
    const ex = Math.round(sitX + 10 + (tx + 2 - sitX - 10) * slide);
    const ey = deskY - 4 - Math.round(Math.sin(slide * Math.PI) * 4) - (slide >= 1 ? 1 : 0);
    g.px(ex, ey, 9, 5, "#efece2");
    g.px(ex + 1, ey + 1, 3, 1, "#b9b4a4"); // the flap
    g.px(ex + 4, ey + 2, 1, 1, "#b9b4a4");
    g.px(ex + 5, ey + 1, 3, 1, "#b9b4a4");
  }
  if (walkT >= 0.25) behind();
  g.wash("#0b0d10", 0.18); // evening in the whole room
  fadeEdges(g, W, H, t, 0.06, 0.08);
}

/* ------------------------------------------------------------------ *
 * 2. the sleeper north
 * ------------------------------------------------------------------ */

function train(g: Painter, W: number, H: number, t: number, time: number) {
  const judder = Math.floor(time / 260) % 2;
  g.px(0, 0, W, H, "#1b1d22");
  const fx = Math.round(W * 0.1);
  const fy = Math.round(H * 0.16) + judder;
  const fw = Math.round(W * 0.8);
  const fh = Math.round(H * 0.5);

  // what is outside: night giving way to dawn as the city falls behind
  const dawn = clamp01((t - 0.35) / 0.55);
  const top: [number, number, number] = [Math.round(10 + dawn * 50), Math.round(14 + dawn * 70), Math.round(28 + dawn * 92)];
  const low: [number, number, number] = [Math.round(26 + dawn * 190), Math.round(30 + dawn * 140), Math.round(48 + dawn * 70)];
  sky(g, fx, fy, fw, fh, top, low, 6);
  const scroll = time * 0.05 + t * 600;
  const sub = (cb: () => void) => {
    // everything outside is drawn clipped to the glass
    g.cx.save();
    g.cx.beginPath();
    g.cx.rect(fx, fy, fw, fh);
    g.cx.clip();
    cb();
    g.cx.restore();
  };
  sub(() => {
    // far mountains, coming up with the light
    if (dawn > 0) {
      const c = `rgba(${40 + dawn * 50},${48 + dawn * 50},${70 + dawn * 40},${dawn})`;
      ridge(g, W, fy + fh, fy + fh * 0.62, fh * 0.28, 2, scroll * 0.1, c, undefined, 1.4);
    }
    // the city's last lights, running out
    const city = clamp01(1 - t / 0.35);
    if (city > 0) {
      for (let i = 0; i < 40; i++) {
        const x = fx + ((i * 47 - scroll * 0.9) % (fw + 60) + fw + 60) % (fw + 60) - 30;
        const bh = fh * (0.2 + hash(i * 3.3) * 0.45);
        g.a(x, fy + fh - bh, 18, bh, 14, 17, 24, city);
        for (let k = 0; k < 6; k++) if (hash(i * 11 + k) > 0.5) g.a(x + 3 + (k % 3) * 5, fy + fh - bh + 4 + Math.floor(k / 3) * 6, 2, 2, 217, 184, 102, city * 0.9);
      }
    }
    // the moor, and a loch catching the dawn
    const moor = clamp01((t - 0.3) / 0.3);
    if (moor > 0) {
      ridge(g, W, fy + fh, fy + fh * 0.8, fh * 0.1, 5, scroll * 0.4, `rgba(${30 + dawn * 30},${36 + dawn * 40},${30 + dawn * 20},${moor})`);
      if (t > 0.55) g.a(fx, fy + fh * 0.86, fw, 3, 200 * dawn, 160 * dawn, 130 * dawn, 0.35 * dawn);
    }
    // the telegraph poles, going by fast
    for (let i = 0; i < 4; i++) {
      const x = fx + (((i * 140 - scroll * 3.2) % (fw + 140)) + fw + 140) % (fw + 140) - 70;
      g.px(x, fy + 6, 2, fh, "#0d0e10");
      g.px(x - 4, fy + 10, 10, 1, "#0d0e10");
    }
    g.a(fx, fy + 12, fw, 1, 13, 14, 16, 0.8); // the wires
  });
  // the window frame, the blind rolled up above it, and his reflection, faint
  g.px(fx - 4, fy - 4, fw + 8, 4, "#2c2f36");
  g.px(fx - 4, fy + fh, fw + 8, 6, "#2c2f36");
  g.px(fx - 4, fy, 4, fh, "#2c2f36");
  g.px(fx + fw, fy, 4, fh, "#2c2f36");
  g.px(fx, fy - 8, fw, 4, "#5c4a3a");
  g.a(fx + fw * 0.62, fy + fh * 0.42, 12, 16, 220, 220, 230, 0.06 * (1 - dawn));
  // the table under the window, and a cup on it rattling
  g.px(fx + fw * 0.25, fy + fh + 10, fw * 0.5, 4, "#3a3128");
  g.px(fx + fw * 0.5, fy + fh + 6 - judder, 5, 5, "#c8c2b0");
  // the seat backs either side
  g.px(fx - 4, fy + fh * 0.55, 14, H, "#4a2f2f");
  g.px(fx + fw - 10, fy + fh * 0.55, 14, H, "#4a2f2f");
  fadeEdges(g, W, H, t, 0.1, 0.12);
}

/* ------------------------------------------------------------------ *
 * 3. the climb
 * ------------------------------------------------------------------ */

/** the hill's surface, rising left to right across a world twice the screen wide */
function slopeY(x: number, W: number, H: number) {
  const worldW = W * 2.2;
  return H * 0.92 - (x / worldW) * H * 0.48 - Math.sin(x / 37) * 3 - Math.sin(x / 11) * 1;
}

function climb(g: Painter, W: number, H: number, t: number, time: number) {
  const worldW = W * 2.2;
  // he walks, stops a while to look back down, and walks on
  const PAUSE = [0.5, 0.64] as const;
  const walkT = t < PAUSE[0] ? t / PAUSE[0] * 0.55 : t < PAUSE[1] ? 0.55 : 0.55 + ((t - PAUSE[1]) / (1 - PAUSE[1])) * 0.45;
  const heroX = W * 0.2 + walkT * (worldW - W * 0.55);
  const cam = Math.max(0, Math.min(worldW - W, heroX - W * 0.38));
  const stopped = t >= PAUSE[0] && t < PAUSE[1];

  // a morning sky, and clouds going over slower than he walks
  sky(g, 0, 0, W, Math.round(H * 0.7), [63, 106, 126], [176, 196, 190], 7);
  // the sun, low and pale, with a haze round it
  disc(g, Math.round(W * 0.74), Math.round(H * 0.12), 16, 255, 240, 200, 0.08);
  disc(g, Math.round(W * 0.74), Math.round(H * 0.12), 8, 255, 244, 214, 0.75);
  for (let i = 0; i < 6; i++) {
    const cx = ((hash(i * 4.1) * W * 2 - time * 0.006 * (1 + i * 0.2) - cam * 0.08) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
    cloud(g, cx, H * (0.08 + hash(i * 2.7) * 0.22), 30 + hash(i) * 40, 240, 242, 236, 0.55);
  }
  // birds, high up, a pair of them
  for (let i = 0; i < 2; i++) {
    const bx = (W * 0.3 + i * 14 + time * 0.012) % (W + 40) - 20;
    const by = H * 0.18 + Math.sin(time / 400 + i) * 3;
    const flap = Math.floor(time / 180 + i) % 2;
    g.px(bx, by + flap, 2, 1, "#2a2e2a");
    g.px(bx + 2, by, 1, 1, "#2a2e2a");
    g.px(bx + 3, by + flap, 2, 1, "#2a2e2a");
  }

  // the far bens, blue with distance and streaked with old snow
  ridge(g, W, H, H * 0.5, H * 0.18, 3, cam * 0.12, "#6b7d8c", "#8a9aa6", 1.3);
  for (let x = 0; x < W; x += 6) {
    const u = x + cam * 0.12;
    if (hash(Math.floor(u / 6)) > 0.8) g.a(x, H * 0.38 + hash(u) * H * 0.06, 3, 2, 230, 236, 240, 0.5);
  }
  // the nearer hills, greener
  ridge(g, W, H, H * 0.64, H * 0.1, 6, cam * 0.4, "#4f6447", "#5f7553", 1);

  // the hill he is on: the slope, its heather, its stones, the dyke and the burn
  for (let x = 0; x < W; x += 2) {
    const wxp = x + cam;
    const y = Math.round(slopeY(wxp, W, H));
    g.px(x, y, 2, H - y, "#3f5233");
    g.px(x, y, 2, 1, "#5a6e43");
    // heather and bracken in drifts
    const h = hash(Math.floor(wxp / 4) * 1.7);
    if (h > 0.55) g.px(x, y + 2 + Math.floor(h * 10), 2, 2, h > 0.8 ? "#6e4a6e" : "#7d6a3c");
    if (h > 0.7) g.px(x, y + 14 + Math.floor(h * 20), 2, 2, "#36472c");
  }
  // the sheep path he follows, worn pale into the slope
  for (let x = 0; x < W; x += 3) {
    const y = slopeY(x + cam, W, H);
    g.px(x, Math.round(y) + 1, 2, 1, "#6c7656");
  }
  // stones lying about
  for (let i = 0; i < 12; i++) {
    const sx = ((i * 97.3) % worldW) - cam;
    if (sx < -10 || sx > W + 10) continue;
    const sy = slopeY(sx + cam, W, H) + 4 + hash(i) * 14;
    const sw = 5 + Math.floor(hash(i * 3) * 6);
    g.px(sx, sy, sw, 3, "#7a7d74");
    g.px(sx, sy, sw, 1, "#93968c");
  }
  // a dry-stane dyke running up the hill, with a gap where the path goes through
  const dykeX = worldW * 0.3 - cam;
  if (dykeX > -60 && dykeX < W + 60) {
    for (let k = -50; k < 50; k += 3) {
      const x = dykeX + k * 0.6;
      if (Math.abs(k) < 6) continue; // the gap
      const y = slopeY(x + cam, W, H) + k * 0.9 - 5;
      g.px(x, y, 4, 5, k % 2 ? "#7c7f76" : "#696c63");
      g.px(x, y, 4, 1, "#9a9d93");
    }
  }
  // a burn coming down, and the stepping stones across it
  const burnX = worldW * 0.62 - cam;
  if (burnX > -40 && burnX < W + 40) {
    for (let k = -30; k < 30; k++) {
      const x = burnX + k * 0.25 + Math.sin(k / 4) * 3;
      const y = slopeY(x + cam, W, H) + k * 0.9 + 4;
      g.px(x, y, 4, 2, k % 5 === 0 ? "#a8c4c8" : "#5f8a96");
    }
    for (let s = 0; s < 3; s++) g.px(burnX - 6 + s * 5, slopeY(burnX + cam, W, H) - 1, 3, 2, "#8a8d84");
  }
  // three blackface ewes, who have seen men come up the hill before
  for (let i = 0; i < 3; i++) {
    const sx = worldW * (0.42 + i * 0.13) - cam;
    if (sx < -20 || sx > W + 20) continue;
    const sy = slopeY(sx + cam, W, H) + 10 + i * 6;
    drawSheep(g, sx, sy - 14, { id: 900 + i, fleece: 6, breed: "blackface", age: 50 }, { graze: i !== 1, flip: heroX - cam < sx });
  }

  // him: in his coat and bunnet now, crook in hand, taking his time
  const hx = Math.round(heroX - cam);
  const hy = Math.round(slopeY(heroX, W, H)) - 26 + 1;
  drawShepherd(g, hx, hy, {
    crook: true,
    walk: stopped ? 0 : time / 150,
    facing: stopped && t > PAUSE[0] + 0.02 && t < PAUSE[1] - 0.02 ? -1 : 1,
  });

  // a little haze over everything far off, so the near hill stands out
  g.a(0, 0, W, H * 0.6, 220, 230, 230, 0.05);
  fadeEdges(g, W, H, t, 0.06, 0);
}

/* ------------------------------------------------------------------ *
 * 4. over the crest
 * ------------------------------------------------------------------ */

function crest(g: Painter, W: number, H: number, t: number, time: number) {
  // the sky over the glen, opening up, and the sun coming through
  sky(g, 0, 0, W, Math.round(H * 0.62), [70, 116, 138], [196, 206, 194], 8);
  for (let i = 0; i < 4; i++) {
    const cx = ((hash(i * 7.3) * W * 1.4 - time * 0.004 * (1 + i * 0.3)) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
    cloud(g, cx, H * (0.06 + hash(i * 1.9) * 0.18), 40 + hash(i * 5) * 50, 245, 245, 238, 0.6);
  }

  // the far side of the glen: bens behind, a long ridge in front of them
  ridge(g, W, H, H * 0.44, H * 0.16, 4, 0, "#71838f", "#94a3ac", 1.3);
  for (let x = 0; x < W; x += 5) if (hash(x * 0.37) > 0.82) g.a(x, H * 0.33 + hash(x) * H * 0.07, 3, 2, 235, 240, 242, 0.55);
  ridge(g, W, H, H * 0.54, H * 0.07, 8, 0, "#5a6f50", "#6b8160", 1);

  // the glen floor, falling away in front of him
  const floorTop = Math.round(H * 0.58);
  g.px(0, floorTop, W, H - floorTop, "#55703f");
  for (let y = floorTop; y < H; y += 3) {
    for (let x = (y % 2) * 3; x < W; x += 6) if (hash(x * 1.1 + y * 3.3) > 0.7) g.px(x, y, 2, 1, "#4c6538");
  }
  // the burn, winding down the middle, wider as it comes nearer
  for (let y = floorTop; y < H * 0.86; y++) {
    const k = (y - floorTop) / (H * 0.86 - floorTop);
    const x = W * 0.52 + Math.sin(k * 5.5) * W * 0.08 * (0.4 + k);
    g.px(Math.round(x), y, Math.max(1, Math.round(1 + k * 5)), 1, k > 0.5 ? "#7fa6b0" : "#9cbcc2");
  }
  // the croft, small and far down, roofed in old thatch and cold in the hearth
  const cx = Math.round(W * 0.34);
  const cy = Math.round(H * 0.66);
  g.a(cx - 2, cy + 9, 26, 2, 0, 0, 0, 0.2);
  g.px(cx, cy, 22, 10, "#8f8c80"); // the walls
  g.px(cx, cy, 22, 1, "#a6a395");
  g.px(cx - 2, cy - 5, 26, 6, "#8a6a3c"); // the thatch, sagging
  g.px(cx + 4, cy - 6, 8, 1, "#9c7a48");
  g.px(cx + 14, cy - 4, 4, 3, "#3d3226"); // where it has fallen in
  g.px(cx + 18, cy - 9, 3, 5, "#7c7a70"); // the chimney, no smoke in it
  g.px(cx + 4, cy + 4, 3, 6, "#3a2c1e"); // the door
  g.px(cx + 12, cy + 3, 3, 3, "#2a2f33"); // a window
  // the old dyke round its field
  for (let x = cx - 18; x < cx + 46; x += 2) g.px(x, cy + 13 + Math.round(Math.sin(x / 9) * 1), 2, 1, "#8a8d84");
  // a few sheep, specks of white
  for (let i = 0; i < 5; i++) {
    const sx = cx + 30 + hash(i * 3.1) * 40 + Math.sin(time / 1800 + i) * 1;
    const sy = cy + 4 + hash(i * 1.7) * 12;
    g.px(sx, sy, 3, 2, "#e8e4d8");
    g.px(sx + 3, sy, 1, 1, "#2a2a28");
  }

  // light coming through the clouds, sweeping over the glen
  const sweep = ease(clamp01(t * 1.2));
  for (let i = 0; i < 3; i++) {
    const bx = W * (0.15 + i * 0.22) + sweep * W * 0.12;
    for (let y = 0; y < H * 0.9; y += 2) g.a(bx + y * 0.35, y, 10 + i * 4, 2, 255, 240, 200, 0.035);
  }

  // the crest in the foreground, heather and stone, and him on it
  for (let x = 0; x < W; x += 2) {
    const y = Math.round(H * 0.84 - Math.sin(x / 31) * 4 - Math.sin(x / 9) * 1.5 + Math.abs(x - W * 0.5) * 0.04);
    g.px(x, y, 2, H - y, "#33422a");
    g.px(x, y, 2, 1, "#4a5c38");
    if (hash(x * 0.71) > 0.6) g.px(x, y + 2 + Math.floor(hash(x) * 6), 2, 2, hash(x * 3) > 0.5 ? "#6e4a6e" : "#7d6a3c");
  }
  // he comes up over the brow, and stops, and looks
  const up = ease(clamp01(t / 0.3));
  const hx = Math.round(W * 0.5 - 6);
  const hy = Math.round(H * 0.84 - 26 + (1 - up) * 30);
  drawShepherd(g, hx, hy, { crook: true, back: true, walk: up < 1 ? time / 150 : 0 });
  // the ground in front of his boots, so he rises out of it rather than through it
  for (let x = hx - 8; x < hx + 22; x += 2) {
    const y = Math.round(H * 0.84 - Math.sin(x / 31) * 4 - Math.sin(x / 9) * 1.5 + Math.abs(x - W * 0.5) * 0.04);
    if (hy + 26 > y + 1) g.px(x, y + 1, 2, hy + 27 - y, "#33422a");
  }

  // in from the dark at the start, and up into the light at the end
  fadeEdges(g, W, H, t, 0.08, 0);
  const out = clamp01((t - 0.9) / 0.1);
  if (out > 0) g.a(0, 0, W, H, 245, 242, 230, out * 0.9);
}
