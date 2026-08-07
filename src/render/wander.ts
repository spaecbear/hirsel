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
  /*
   * Which way it is *going*, not where it happens to be. dx is a sine, so the
   * direction of travel is the sign of its derivative — the cosine. Facing was
   * read off the position before, which is why a whole flock could be walking
   * left while every animal faced right.
   */
  const vx = Math.cos(slow + a);
  const moving = Math.abs(vx) > 0.55;

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
  return { dx, dy, flip: vx < 0, moving };
}


/* ------------------------------------------------------------------ *
 * the dog working
 * ------------------------------------------------------------------ */

export interface Circuit {
  x: number;
  y: number;
  facing: 1 | -1;
  running: boolean;
  /** she is stopped, settled, and pleased with herself */
  wagging: boolean;
}

/**
 * A dog does not stand about near her shepherd — she works the outside of the
 * flock, which is the whole picture of a hirsel. She runs a lap round them,
 * then holds at the edge and watches, then goes again.
 *
 * The ellipse is flattened because the hill is drawn in something close to
 * three-quarter view: a circle would read as her rising up into the sky at the
 * back of it. Her facing is the sign of the derivative of x, so she is always
 * looking the way she is running, and the lap starts and finishes at the same
 * point so the hold never teleports her.
 */
/*
 * A slower lap. At nine seconds she crossed the glen faster than a small
 * sprite can reasonably be tapped, which made her spin impossible to ask for.
 */
const LAP_MS = 14000;
const HOLD_MS = 6000;
/** she settles for a moment before the wag starts, and again before she goes */
const WAG_AFTER = 1400;
const WAG_BEFORE = 1600;

export function herdCircuit(time: number, cx: number, cy: number, rx: number, ry: number): Circuit {
  const cycle = time % (LAP_MS + HOLD_MS);
  const running = cycle < LAP_MS;
  // during the hold she sits at the top of the lap, where it began
  const th = (running ? cycle / LAP_MS : 0) * Math.PI * 2;
  /*
   * A working dog does not wag while she is working — she is watching the
   * flock, and a tail going the whole way round the circuit read as a toy
   * being pulled along on a string. The wag belongs to the stop: she comes
   * in, stands a moment, wags, stands again, and goes back out.
   */
  const held = cycle - LAP_MS;
  const wagging = !running && held > WAG_AFTER && held < HOLD_MS - WAG_BEFORE;
  return {
    x: cx + Math.cos(th) * rx,
    y: cy + Math.sin(th) * ry,
    facing: -Math.sin(th) < 0 ? -1 : 1,
    running,
    wagging,
  };
}

/* ------------------------------------------------------------------ *
 * what he does with his hands when there is nothing in them
 * ------------------------------------------------------------------ */

export type TickKind = "brow" | "stretch" | "look";

/**
 * How often one happens, and how long it lasts.
 *
 * At 13s apart he was doing something a quarter of every idle minute, which
 * starts to read as fidgeting rather than a man waiting on his sheep. About
 * one minute in six is enough to keep him alive without drawing the eye off
 * whatever the player is actually doing.
 */
const TICK_EVERY = 17000;
const TICK_FOR = 3000;

/**
 * An idle gesture, or nothing.
 *
 * Derived from the clock like everything else in this file, so it holds no
 * state and cannot drift. `look` turns him to face out over the hill, which
 * is why it hands back a facing as well — a man looking at a view is not
 * looking at the camera.
 */
export function idleTick(time: number): { kind: TickKind; t: number; facing: 1 | -1 } | null {
  const slot = Math.floor(time / TICK_EVERY);
  const into = time % TICK_EVERY;
  if (into > TICK_FOR) return null;

  const roll = hash(slot * 7.3);
  // looking out over the hill is the commonest, and the quietest
  const kind: TickKind = roll < 0.45 ? "look" : roll < 0.75 ? "brow" : "stretch";
  return {
    kind,
    t: into / TICK_FOR,
    facing: hash(slot * 3.1) > 0.5 ? 1 : -1,
  };
}
