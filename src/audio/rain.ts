/**
 * Rain, synthesized: a steady filtered-noise hush for rain on the ground and
 * the roof, with individual drip ticks layered over it. No audio files.
 *
 * The drips are short and high-frequency — which is exactly the shape that
 * read as a watermark the last time this project had that bug (see the note
 * in score.ts). The difference here is the schedule: each drip's timing is
 * drawn from a randomised interval, never a fixed subdivision, so a listener
 * hears weather rather than a clock. Do not change `scheduleDrips` to a fixed
 * interval to "make it more even" — irregularity is the point.
 */
import type { AudioEngine } from "./engine";

const HUSH_GAIN = 0.05;
const FADE_SECONDS = 1.4;
const LOOKAHEAD = 0.5;
const DRIP_MIN_GAP = 0.05;
const DRIP_JITTER = 0.16;

export class Rain {
  private hiss: GainNode | null = null;
  private active = false;
  private timer: number | null = null;
  private nextDrip = 0;

  constructor(private engine: AudioEngine) {}

  start() {
    if (this.hiss || !this.engine.ac) return;
    this.hiss = this.engine.noiseBed("lowpass", 700, 0.5, this.engine.sfxBus);
    if (this.hiss) this.hiss.gain.value = this.active ? HUSH_GAIN : 0; // pick up state set before the first gesture
    this.nextDrip = this.engine.now;
    this.timer = window.setInterval(() => this.scheduleDrips(), 120);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** ramps the ambience in or out; does nothing if it's already in that state */
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) this.nextDrip = this.engine.now; // start fresh, no catch-up burst of backlogged drips
    if (!this.engine.ac || !this.hiss) return; // start() will pick up `active` once audio begins
    const t = this.engine.now;
    const g = this.hiss.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? HUSH_GAIN : 0, t + FADE_SECONDS);
  }

  private scheduleDrips() {
    const ac = this.engine.ac;
    if (!ac || !this.active) return;
    while (this.nextDrip < ac.currentTime + LOOKAHEAD) {
      const t = this.nextDrip;
      const freq = 2600 + Math.random() * 2200; // pitch wanders, drip to drip
      const gain = 0.02 + Math.random() * 0.03;
      this.engine.noise(t, 0.015 + Math.random() * 0.02, "bandpass", freq, 4 + Math.random() * 3, gain, this.engine.sfxBus);
      this.nextDrip += DRIP_MIN_GAP + Math.random() * DRIP_JITTER;
    }
  }
}
