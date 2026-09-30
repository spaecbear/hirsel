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
 * has been laid over the scene — laid under it, the dark ate it.
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
 * The light, after the dark: nothing by day, and growing with the night. It
 * throws a pool on the grass under it as well as the glow round the glass.
 */
export function drawLampLight(g: Painter, x: number, foot: number, night: number, time: number) {
  if (night <= 0) return;
  const cx = x + 8; // the middle of the glass
  const cy = foot - POST_H + 8;
  const flicker = 1 + Math.sin(time / 170) * 0.06 + Math.sin(time / 53) * 0.03;
  const n = night * flicker;
  // a round glow in falling-off rings, and a flattened one on the grass under it
  for (const [r, a] of [[22, 0.05], [16, 0.07], [11, 0.1], [6, 0.14]] as const) disc(g, cx, cy, r, 1, 244, 196, 104, a * n);
  for (const [r, a] of [[24, 0.08], [15, 0.1], [8, 0.12]] as const) disc(g, cx, foot, r, 0.25, 240, 190, 90, a * n);
  // and the flame itself, bright through the glass
  g.a(cx - 1, cy - 2, 3, 5, 255, 214, 120, Math.min(1, 0.3 + night * 0.7));
}

/** a filled ellipse, row by row: `squash` flattens it (1 is round) */
function disc(g: Painter, cx: number, cy: number, r: number, squash: number, red: number, gr: number, b: number, a: number) {
  const rows = Math.max(1, Math.round(r * squash));
  for (let dy = -rows; dy <= rows; dy++) {
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / (rows + 0.5)) ** 2)));
    if (half > 0) g.a(cx - half, cy + dy, half * 2, 1, red, gr, b, a);
  }
}
