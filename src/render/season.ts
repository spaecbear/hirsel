/**
 * What the time of year does to the hill. Shared by both interfaces.
 *
 * Laid over the terrain rather than built into it: the three pastures are
 * drawn from real places with their own palettes (see terrain.ts), and a
 * season is a change of light and cover on top of a place, not a different
 * place. Drawn after the ground and before anything standing on it, so the
 * croft, the cart and the flock keep their own colours.
 *
 * Spring and summer are the hill as it was always drawn.
 */
import type { Painter } from "./painter";
import { hash } from "./sprites";
import { seasonOf } from "../sim/rules";
import type { GameState } from "../sim/types";

export function drawSeasonLand(g: Painter, W: number, top: number, H: number, st: GameState) {
  const s = seasonOf(st.day).id;
  const snowing = st.forecast[0] === "snow";
  const h = H - top;
  if (h <= 0) return;

  if (s === "autumn") {
    // the bracken turned: a rust wash, and flecks of it through the grass
    g.a(0, top, W, h, 156, 92, 44, 0.09);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(hash(i * 3.1) * W);
      const y = top + Math.floor(hash(i * 7.7) * h);
      g.px(x, y, 2, 1, i % 3 ? "#8a5a2c" : "#a8703a");
    }
  }

  if (s === "winter") {
    /*
     * Hoar frost on every day of it, stippled in single pixels; lying snow on
     * a day of snow, in small drifts. Never long flat dashes: a field of
     * horizontal lines reads as scan lines over the picture (see the sky's
     * note in art/glen.ts), which is how the first version of this looked.
     */
    g.a(0, top, W, h, 214, 224, 232, snowing ? 0.4 : 0.1);
    const frost = snowing ? 260 : 420;
    for (let i = 0; i < frost; i++) {
      const x = Math.floor(hash(i * 5.3) * W);
      const y = top + Math.floor(hash(i * 2.9) * h);
      g.px(x, y, 1, 1, i % 4 ? "#dfe6ea" : "#f2f5f6");
    }
    if (snowing) {
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(hash(i * 3.7 + 1) * W);
        const y = top + 6 + Math.floor(hash(i * 8.1 + 2) * (h - 6));
        const w = 5 + Math.floor(hash(i * 1.3) * 8);
        // a drift: wider at the foot, a lit crown on top
        g.px(x, y, w, 2, "#e6ecef");
        g.px(x + 1, y - 1, w - 2, 1, "#f4f7f8");
        g.px(x + 2, y + 2, w - 4, 1, "#c7d0d6");
      }
    }
  }
}

/** snow coming down, drifting a little as it falls */
export function drawSnowfall(g: Painter, W: number, H: number, time: number) {
  for (let i = 0; i < 110; i++) {
    const fall = time * (0.018 + hash(i) * 0.02);
    const x = Math.round((i * 37 + Math.sin(time / 1300 + i) * 6 + fall * 0.4) % W);
    const y = Math.round((i * 53 + fall) % H);
    const big = hash(i * 9) > 0.8;
    g.a(x, y, big ? 2 : 1, big ? 2 : 1, 240, 244, 246, 0.85);
  }
}

/**
 * The barn's stock, stacked where it can be seen: nothing when the barn is
 * empty, up to four courses when it will see a big flock through.
 */
export function drawHaystack(g: Painter, x: number, baseY: number, bales: number) {
  if (bales <= 0) return;
  const tiers = Math.min(4, 1 + Math.floor(bales / 30));
  for (let i = 0; i < tiers; i++) {
    const w = 16 - i * 3;
    const y = baseY - (i + 1) * 4;
    g.px(Math.round(x - w / 2), y, w, 4, i % 2 ? "#b89448" : "#c9a95a");
    g.px(Math.round(x - w / 2), y, w, 1, "#dcc07a");
  }
}
