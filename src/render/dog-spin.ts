/**
 * Arrow's spin.
 *
 * A sheltie who is pleased to see you turns on the spot, so the spin is not
 * something the dog does on a timer any more — you have to tap her, and only
 * the Shetland sheepdog does it. The border collie has her own habit (see the
 * hearth in the interior).
 *
 * This is presentation state, not simulation: it holds nothing the save needs
 * and nothing the rules read. It lives here rather than in a component so the
 * painter and the tap handler agree about whether she is mid-turn.
 */

/** how long one full turn takes */
export const SPIN_MS = 800;
/** two turns inside this window is "in quick succession" — the Arrow */
export const QUICK_MS = 2600;

let startedAt = -Infinity;
/** how many turns this sequence runs for: one, or two if she was asked again */
let turns = 1;

/**
 * She was tapped. Returns true if this makes two turns back to back.
 *
 * The sequence is a start time and a number of turns, rather than a start
 * time that gets pushed about. Chaining used to add a turn's length to
 * `startedAt`, which sent `spinNow` negative for the rest of the first turn —
 * so asking for the second one stopped her dead, left a gap, and then played
 * a single turn. Two barks, one spin.
 *
 * A tap landing while she is already turning is queued rather than dropped,
 * because mashing her twice is what anyone will do; she cannot be wound past
 * two, so she is not a toy.
 */
export function startSpin(time: number): boolean {
  const into = time - startedAt;
  if (into >= 0 && into < turns * SPIN_MS) {
    if (turns >= 2) return false;
    turns = 2;
    return true;
  }
  // a fresh sequence: it pairs with the last one if that was recent
  const quick = into <= QUICK_MS;
  startedAt = time;
  turns = 1;
  return quick;
}

/** progress through the turn she is in, 0 when she is not turning */
export function spinNow(time: number): number {
  const into = time - startedAt;
  if (into < 0 || into >= turns * SPIN_MS) return 0;
  // never exactly 0 while turning, or the painter reads it as "not spinning"
  return Math.max(0.001, (into % SPIN_MS) / SPIN_MS);
}

/** for a fresh run, so a spin does not carry across games */
export function resetSpin() {
  startedAt = -Infinity;
  turns = 1;
}
