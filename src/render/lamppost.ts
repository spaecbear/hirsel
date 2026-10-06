/**
 * The storm lantern, hung on a post in the field. Shared by both interfaces.
 *
 * It used to be in his hand all day, burning in full sun. Bought, it goes up
 * on a post out on the hill and stays dark until the light goes; at night it
 * is the one warm thing out there besides the croft window.
 *
 * Two halves, because the light has to land on top of the dark: the post and
 * the unlit lantern are painted with everything else standing in the field,
 * sorted by `foot` like the flock, and the light is painted after the night
 * has been laid over the scene: laid under it, the dark ate it.
 */
import type { Painter } from "./painter";

/** how tall the post stands, foot to crossarm */
export const POST_H = 30;

/** the post and the lantern hanging off it, dark. `foot` is where it meets the ground */
export function drawLampPost(g: Painter, x: number, foot: number) {
  const top = foot - POST_H;
  g.a(x - 3, foot - 1, 10, 2, 0, 0, 0, 0.22); // it stands on the grass
  g.px(x, top, 3, POST_H, "#5b4a30"); // the post
  g.px(x, top, 1, POST_H, "#6d5a3c"); // lit down one side
  g.px(x - 1, foot - 3, 5, 3, "#4a3a26"); // a stone packed round its foot
  g.px(x, top - 1, 10, 2, "#5b4a30"); // the crossarm, out towards the field
  g.px(x + 8, top + 1, 1, 2, "#3a3226"); // the hook
  // the lantern
  const lx = x + 6;
  const ly = top + 3;
  g.px(lx + 1, ly, 3, 1, "#6d7263"); // the bail
  g.px(lx, ly + 1, 5, 2, "#8a8f88"); // the cap
  g.px(lx, ly + 3, 1, 5, "#8a8f88"); // the frame
  g.px(lx + 4, ly + 3, 1, 5, "#8a8f88");
  g.px(lx + 1, ly + 3, 3, 5, "#3a3f3c"); // the glass, the wick out
  g.px(lx, ly + 8, 5, 1, "#6d7263"); // the oil font
}

/**
 * The one pool of light the lantern throws, shared by the dark and the glow
 * so they are the same shape: centred a little under the glass, wider than
 * it is tall, in three stepped rings. The dark used to be cut away round one
 * point and the glow drawn round another, the glass, so the lantern seemed
 * to throw two lights, a warm one up at the post and a pale one on the grass.
 */
export function lampRings(x: number, foot: number, time: number) {
  const flicker = 1 + Math.sin(time / 170) * 0.03;
  return {
    cx: x + 8,
    cy: foot - 12,
    squash: 0.75,
    /** half-widths outermost first, and how much of the night's dark is left inside each */
    rings: [
      [Math.round(34 * flicker), 0.66],
      [Math.round(24 * flicker), 0.42],
      [Math.round(14 * flicker), 0.24],
    ] as [number, number][],
  };
}

/**
 * The light, after the dark: nothing by day, and growing with the night. A
 * warm tint over the same rings the dark was thinned in, and a small halo
 * round the flame itself.
 */
export function drawLampLight(g: Painter, x: number, foot: number, night: number, time: number) {
  if (night <= 0) return;
  const { cx, cy, squash, rings } = lampRings(x, foot, time);
  const flicker = 1 + Math.sin(time / 170) * 0.06 + Math.sin(time / 53) * 0.03;
  const n = night * flicker;
  rings.forEach(([r], k) => disc(g, cx, cy, r, squash, 244, 196, 104, (0.035 + k * 0.03) * n));
  // and the flame itself, bright through the glass, with a little halo of its own
  const gx = x + 8;
  const gy = foot - POST_H + 8;
  disc(g, gx, gy, 4, 1, 255, 214, 120, 0.25 * n);
  g.a(gx - 1, gy - 2, 3, 5, 255, 214, 120, Math.min(1, 0.3 + night * 0.7));
}

/** a filled ellipse, row by row: `squash` flattens it (1 is round) */
function disc(g: Painter, cx: number, cy: number, r: number, squash: number, red: number, gr: number, b: number, a: number) {
  const rows = Math.max(1, Math.round(r * squash));
  for (let dy = -rows; dy <= rows; dy++) {
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / (rows + 0.5)) ** 2)));
    if (half > 0) g.a(cx - half, cy + dy, half * 2, 1, red, gr, b, a);
  }
}

/**
 * The dark, laid over the field with the lantern's pool left in it.
 *
 * The light used to go on after the dark as a warm glow on top, so a sheep or
 * the man standing right under the lantern stayed as black as the rest of the
 * hill with a yellow haze over them. The night is laid row by row instead, a
 * little thinner in each ring towards the lantern, so whatever is under it
 * shows in its own colours. Stepped rings, not a smooth gradient: the game is
 * pixels all the way down.
 */
export function drawNightWithLamp(
  g: Painter,
  W: number,
  H: number,
  dark: number,
  x: number,
  foot: number,
  time: number,
  rgb: [number, number, number] = [10, 13, 24],
) {
  const { cx, cy, squash, rings } = lampRings(x, foot, time);
  const top = cy - Math.ceil(rings[0][0] * squash);
  const bottom = cy + Math.ceil(rings[0][0] * squash);
  const [r, gr, b] = rgb;
  if (top > 0) g.a(0, 0, W, top, r, gr, b, dark);
  if (bottom + 1 < H) g.a(0, bottom + 1, W, H - bottom - 1, r, gr, b, dark);
  for (let y = Math.max(0, top); y <= Math.min(H - 1, bottom); y++) {
    const dy = (y - cy) / squash;
    const halves = rings.map(([rr]) => Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy))));
    // from the outside in: full dark, then each ring's share of it
    let left = 0;
    let right = W;
    let share = 1;
    for (let k = 0; k < rings.length; k++) {
      const h = halves[k];
      if (h <= 0) break;
      const l = cx - h;
      const rt = cx + h;
      g.a(left, y, l - left, 1, r, gr, b, dark * share);
      g.a(rt, y, right - rt, 1, r, gr, b, dark * share);
      left = l;
      right = rt;
      share = rings[k][1];
    }
    g.a(left, y, right - left, 1, r, gr, b, dark * share);
  }
}
