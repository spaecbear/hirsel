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
/** true while the current turn is the second of a pair, so it cannot chain on */
let chained = false;

/**
 * She was tapped. Returns true if this makes two turns back to back.
 *
 * A tap landing while she is still turning used to be dropped, which meant
 * mashing her twice — the obvious way anyone would try this — did nothing at
 * all. It queues instead: the second turn starts the instant the first ends,
 * so two quick taps read as two turns, and the pair cannot be extended into
 * a spinning top by holding the tap down.
 */
export function startSpin(time: number): boolean {
  const spinning = time - startedAt < SPIN_MS;
  if (spinning) {
    if (chained) return false; // already a pair; she is not a toy
    startedAt += SPIN_MS; // chain the second turn straight onto the first
    chained = true;
    return true;
  }
  const quick = time - startedAt <= QUICK_MS;
  startedAt = time;
  chained = quick;
  return quick;
}

/** progress through the current turn, 0 when she is not turning */
export function spinNow(time: number): number {
  const into = time - startedAt;
  if (into < 0 || into >= SPIN_MS) return 0;
  // never exactly 0 while turning, or the painter reads it as "not spinning"
  return Math.max(0.001, into / SPIN_MS);
}

/** for a fresh run, so a spin does not carry across games */
export function resetSpin() {
  startedAt = -Infinity;
  chained = false;
}
