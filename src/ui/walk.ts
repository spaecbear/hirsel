/**
 * Sending the shepherd somewhere.
 *
 * Hold a finger on the pasture and he walks to it. It costs no tap and
 * changes nothing in the sim — it is there because a hill you can only
 * look at feels like a menu, and one you can wander feels like a place.
 *
 * The position lives here rather than in the game state for exactly that
 * reason: it is not part of the run, it doesn't belong in a save, and it
 * must never be something a player can lose progress over. Both the art and
 * the hit-testing read it from here, so the man you tap is the man you see.
 */
const SPEED = 26; // logical pixels a second — a walk, not a sprint

export class Walk {
  private from: { x: number; y: number } | null = null;
  private to: { x: number; y: number } | null = null;
  private started = 0;
  private duration = 0;
  private current: { x: number; y: number } | null = null;

  /** send him to a point, starting from wherever he is standing now */
  go(fromX: number, fromY: number, toX: number, toY: number, now: number) {
    const start = this.current ?? { x: fromX, y: fromY };
    const dist = Math.hypot(toX - start.x, toY - start.y);
    if (dist < 3) return;
    this.from = start;
    this.to = { x: toX, y: toY };
    this.started = now;
    this.duration = Math.max(220, (dist / SPEED) * 1000);
  }

  /** call once a frame; returns where he is, or null to use the default spot */
  tick(now: number): { x: number; y: number } | null {
    if (!this.to || !this.from) return this.current;
    const t = Math.min(1, (now - this.started) / this.duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.current = {
      x: this.from.x + (this.to.x - this.from.x) * e,
      y: this.from.y + (this.to.y - this.from.y) * e,
    };
    if (t >= 1) {
      this.from = null;
      this.to = null;
    }
    return this.current;
  }

  get walking() {
    return this.to !== null;
  }

  get position() {
    return this.current;
  }

  /** he goes back to his mark when the ground changes under him */
  reset() {
    this.from = null;
    this.to = null;
    this.current = null;
  }
}
