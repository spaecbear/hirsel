/**
 * Picking the next thing in a direction — the whole of spatial navigation.
 *
 * Used for both kinds of target: buttons on a DOM sheet or menu, and the
 * things on the hill you can tap. It only sees boxes, so it is the same
 * question in both places and can be tested without a page.
 */
import type { Dir } from "./controls";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * The nearest candidate that lies in `dir` from `from`.
 *
 * "Lies in" means its centre is past `from`'s centre along that axis. Among
 * those, distance along the direction counts once and drift across it counts
 * double, so pressing down picks the thing under you rather than something a
 * little lower and far off to the side. Candidates overlapping `from`'s
 * centre along the axis are ignored, which is what stops a row of buttons
 * from answering "down" with the button next door.
 */
export function nearestInDirection<T extends { box: Box }>(from: Box, cands: T[], dir: Dir): T | null {
  const o = centre(from);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of cands) {
    if (c.box === from) continue;
    const p = centre(c.box);
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    let along: number;
    let across: number;
    switch (dir) {
      case "up":
        along = -dy;
        across = Math.abs(dx);
        break;
      case "down":
        along = dy;
        across = Math.abs(dx);
        break;
      case "left":
        along = -dx;
        across = Math.abs(dy);
        break;
      case "right":
        along = dx;
        across = Math.abs(dy);
        break;
    }
    if (along <= 1) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
