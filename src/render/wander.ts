/**
 * The hill breathing.
 *
 * Sheep and the dog stood on exact marks, which made the flock read as
 * furniture. They drift now: each animal wanders a little around its own
 * spot, and over a day the whole flock edges towards wherever the shepherd
 * is standing — slowly, and never all the way, so they gather round him
 * without piling into one heap.
 *
 * None of this touches the simulation. It is pure presentation, computed
 * from the clock and the animal's id, so it needs no state, survives a
 * reload, and cannot desync from anything that matters.
 */
import { hash } from "./sprites";

/** how far an animal strays from its mark, in logical pixels */
const ROAM_X = 7;
const ROAM_Y = 3;
/** how far towards the shepherd the flock will drift, as a fraction */
const PULL_MAX = 0.34;
/** they only notice him within this distance */
const PULL_RANGE = 90;

export interface Drift {
  dx: number;
  dy: number;
  /** which way this animal happens to be facing */
  flip: boolean;
  /** true while it is actually moving, for the leg animation */
  moving: boolean;
}

/**
 * Where one animal is relative to its mark.
 *
 * `seed` keeps each animal on its own rhythm — without it the whole flock
 * sways in unison like a chorus line. The periods are deliberately not
 * multiples of each other so the pattern does not visibly repeat.
 */
export function driftFor(seed: number, time: number, toward?: { dx: number; dy: number }): Drift {
  const a = hash(seed * 1.7) * Math.PI * 2;
  const b = hash(seed * 3.1) * Math.PI * 2;
  const slow = time / (5200 + hash(seed) * 2600);
  const slower = time / (7900 + hash(seed * 2) * 3100);

  let dx = Math.sin(slow + a) * ROAM_X;
  let dy = Math.cos(slower + b) * ROAM_Y;
  const moving = Math.abs(Math.cos(slow + a)) > 0.55;

  if (toward) {
    // ease off with distance: they notice him nearby, not across the glen
    const dist = Math.hypot(toward.dx, toward.dy);
    if (dist > 1 && dist < PULL_RANGE) {
      // each animal keeps its own comfortable distance, so they cluster
      // around him rather than converging on the same pixel
      const share = PULL_MAX * (0.55 + hash(seed * 5) * 0.45) * (1 - dist / PULL_RANGE);
      dx += toward.dx * share;
      dy += toward.dy * share;
    }
  }
  return { dx, dy, flip: (toward ? toward.dx : Math.sin(slow + a)) < 0, moving };
}
