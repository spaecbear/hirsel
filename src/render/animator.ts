import { ANIM_MS } from "../sim/config";
import type { AnimId } from "../sim/types";

interface Job {
  anim: AnimId;
  after?: () => void;
}

/**
 * One animation at a time, with a queue and a completion callback.
 * The fox raid runs after the night; the watch's routine chains off completion.
 */
export class Animator {
  current: AnimId | null = null;
  p = 0;
  private start = 0;
  private dur = 0;
  private after?: () => void;
  private queue: Job[] = [];
  reduced = false;
  onStart: (anim: AnimId) => void = () => {};
  onIdle: () => void = () => {};

  get busy() {
    return this.current !== null || this.queue.length > 0;
  }

  play(anim: AnimId, after?: () => void) {
    if (this.current) {
      this.queue.push({ anim, after });
      return;
    }
    this.begin({ anim, after });
  }

  private begin(job: Job) {
    this.current = job.anim;
    this.after = job.after;
    this.dur = this.reduced ? 1 : (ANIM_MS[job.anim] ?? 1200);
    this.start = performance.now();
    this.p = 0;
    this.onStart(job.anim);
  }

  /** call once per frame */
  tick(now: number) {
    if (!this.current) return;
    this.p = (now - this.start) / this.dur;
    if (this.p < 1) return;
    this.p = 1;
    const done = this.after;
    this.current = null;
    this.after = undefined;
    done?.();
    const next = this.queue.shift();
    if (next) this.begin(next);
    else this.onIdle();
  }

  /** cut everything short — used when starting a new game mid-animation */
  clear() {
    this.queue.length = 0;
    this.current = null;
    this.after = undefined;
    this.p = 0;
  }
}
